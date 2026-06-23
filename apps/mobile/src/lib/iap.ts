/**
 * Mobile IAP (In-App Purchase) bridge for StoreKit2 (iOS) + Play Billing (Android).
 *
 * Uses `expo-iap`. This module:
 *   - Opens a connection on first call, shares it across the session.
 *   - Exposes `fetchSubscriptionProducts` so the UI can render real prices.
 *   - Exposes `purchaseSubscription` which requests purchase AND waits for
 *     the resulting transaction, then posts it to /api/mobile/iap/verify for
 *     backend verification (the server is the single source of truth).
 *
 * NOTE: expo-iap is a native module — it requires a dev client build. It will
 * NOT work inside Expo Go.
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { isMobileStorePurchasesEnabledForPlatform } from "@/lib/billing-flags";
import { captureException } from "@/lib/sentry";
import { deriveIapAccountToken } from "@locateflow/shared";
import {
  buildSubscriptionPurchaseRequest,
  IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE,
  normalizeSubscriptionProduct,
  type SubscriptionProduct,
} from "@/lib/iap-offers";

type ExpoIapModule = typeof import("expo-iap");

declare const require: (moduleName: string) => unknown;

type VerifyResponse = {
  success?: boolean;
  entitlement?: unknown;
  subscription?: unknown;
  error?: string;
};

let connectionReady = false;
let connecting: Promise<boolean> | null = null;
let iapModule: ExpoIapModule | null | undefined;

function reportIapIssue(message: string, error: unknown) {
  captureException(error, { area: "iap", message });
  if (__DEV__) {
    console.warn(message, error);
  }
}

function getIapModule(): ExpoIapModule | null {
  if (Platform.OS === "web") return null;
  if (iapModule !== undefined) return iapModule;

  try {
    iapModule = require("expo-iap") as ExpoIapModule;
  } catch (err) {
    reportIapIssue("[IAP] expo-iap native module unavailable", err);
    iapModule = null;
  }

  return iapModule;
}

/**
 * Lazily read the authed userId from the zustand auth store.
 *
 * Loaded via `require` (not a top-level import) on purpose: the auth store
 * transitively pulls in `expo-secure-store`, a native module that cannot be
 * evaluated in the node test env. A static import would drag that into this
 * module's graph and break the (native-free) IAP unit tests; a lazy require
 * keeps it out until an actual purchase runs. Defensive — any failure yields a
 * null userId, in which case no account token is attached (request unchanged).
 */
function getAuthedUserId(): string | null {
  try {
    const mod = require("@/lib/auth-store") as typeof import("@/lib/auth-store");
    return mod.useAuthStore.getState().user?.id ?? null;
  } catch (err) {
    reportIapIssue("[IAP] auth-store unavailable for account-token binding", err);
    return null;
  }
}

async function ensureConnection(): Promise<boolean> {
  if (connectionReady) return true;
  if (connecting) return connecting;
  connecting = (async () => {
    const IAP = getIapModule();
    if (!IAP) return false;

    try {
      await IAP.initConnection();
      connectionReady = true;
      return true;
    } catch (err) {
      reportIapIssue("[IAP] initConnection failed", err);
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

export async function closeConnection() {
  if (!connectionReady) return;
  const IAP = getIapModule();
  if (!IAP) return;

  try {
    await IAP.endConnection();
  } catch {
    /* noop */
  }
  connectionReady = false;
}

export async function fetchSubscriptionProducts(skus: string[]): Promise<SubscriptionProduct[]> {
  if (!isMobileStorePurchasesEnabledForPlatform()) return [];
  if (skus.length === 0) return [];
  const ok = await ensureConnection();
  if (!ok) return [];
  const IAP = getIapModule();
  if (!IAP) return [];

  try {
    const products = await IAP.fetchProducts({ skus, type: "subs" });
    return (products || []).map(normalizeSubscriptionProduct);
  } catch (err) {
    reportIapIssue("[IAP] fetchProducts failed", err);
    return [];
  }
}

export type PurchaseResult =
  | { status: "ok"; subscription: unknown; entitlement: unknown }
  | { status: "cancelled" }
  | { status: "duplicate" }
  | { status: "error"; message: string };

export const IAP_PURCHASE_FAILED_MESSAGE = "IAP_PURCHASE_FAILED";
export const IAP_VERIFICATION_ERROR_MESSAGE = "IAP_VERIFICATION_ERROR";
export const IAP_STORE_UNAVAILABLE_MESSAGE = "IAP_STORE_UNAVAILABLE";
export { IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE };

const IAP_PURCHASE_TIMEOUT_MS = 120_000;

function getPurchaseProductId(purchase: any): string | undefined {
  if (typeof purchase?.productId === "string" && purchase.productId) return purchase.productId;
  if (Array.isArray(purchase?.ids)) return purchase.ids.find((id: unknown): id is string => typeof id === "string");
  return undefined;
}

function getIosSignedTransaction(purchase: any): string | undefined {
  return (
    purchase?.purchaseToken ||
    purchase?.jwsRepresentation ||
    purchase?.jwsRepresentationIOS ||
    purchase?.jwsRepresentationIos ||
    undefined
  );
}

function getIosTransactionId(purchase: any): string | undefined {
  return purchase?.transactionId || purchase?.id || undefined;
}

export function buildVerifyBodyForPurchase(
  purchase: any,
  platform: "ios" | "android" | string = Platform.OS,
): Record<string, unknown> {
  if (platform === "ios") {
    const transactionId = getIosTransactionId(purchase);
    return {
      platform: "ios",
      signedTransaction: getIosSignedTransaction(purchase),
      ...(transactionId ? { transactionId } : {}),
    };
  }

  return {
    platform: "android",
    purchaseToken: purchase?.purchaseToken || purchase?.purchaseTokenAndroid,
    productId: getPurchaseProductId(purchase),
  };
}

function getAndroidPackageName() {
  return (
    (Constants.expoConfig as any)?.android?.package ||
    (Constants.manifest as any)?.android?.package ||
    "com.locateflow.mobile"
  );
}

/**
 * Kick off a subscription purchase and wait for backend verification.
 *
 * The flow:
 *   1. Register a single-fire purchase listener (resolves the waiter).
 *   2. Call requestPurchase — user sees the native sheet.
 *   3. When the transaction fires, send the proof to /api/mobile/iap/verify.
 *   4. Only after the server confirms, call finishTransaction.
 */
export async function purchaseSubscription(opts: {
  productId: string;
  offerToken?: string | null;
}): Promise<PurchaseResult> {
  if (!isMobileStorePurchasesEnabledForPlatform()) {
    return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };
  }

  const ok = await ensureConnection();
  if (!ok) return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };
  const IAP = getIapModule();
  if (!IAP) return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };

  // Receipt↔account binding (audit fix 1.1): derive a stable per-user token
  // from the authed userId and attach it to the purchase request. Additive —
  // if no user is resolvable (should not happen on this authed screen) we
  // simply omit it and the request is unchanged. The server recomputes the
  // same value and matches it against the verified receipt.
  const accountToken = deriveIapAccountToken(getAuthedUserId());

  return new Promise<PurchaseResult>((resolve) => {
    let settled = false;
    let handlingPurchase = false;
    let updateSub: { remove: () => void } | null = null;
    let errorSub: { remove: () => void } | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      finish({ status: "error", message: IAP_PURCHASE_FAILED_MESSAGE });
    }, IAP_PURCHASE_TIMEOUT_MS);

    const finish = (value: PurchaseResult) => {
      if (settled) return;
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        updateSub?.remove();
      } catch {}
      try {
        errorSub?.remove();
      } catch {}
      resolve(value);
    };

    const handlePurchase = async (purchase: any) => {
      if (settled || handlingPurchase) return;
      const purchaseProductId = getPurchaseProductId(purchase);
      if (purchaseProductId && purchaseProductId !== opts.productId) return;
      handlingPurchase = true;
      try {
        const verifyBody = buildVerifyBodyForPurchase(purchase, Platform.OS);
        if (Platform.OS === "android" && !verifyBody.productId) {
          verifyBody.productId = opts.productId;
        }

        if (Platform.OS === "ios" && !verifyBody.signedTransaction) {
          finish({
            status: "error",
            message: "StoreKit signed transaction is missing. Please try again.",
          });
          return;
        }

        const res = await api.post<VerifyResponse>("/api/mobile/iap/verify", verifyBody);

        if (res.error || !res.data?.success) {
          // Don't finishTransaction — StoreKit/Play will retry next session.
          finish({
            status: "error",
            message: res.error || res.data?.error || "Verification failed",
          });
          return;
        }

        // Only ack once the server has the entitlement.
        try {
          await IAP.finishTransaction({ purchase, isConsumable: false });
        } catch (err) {
          reportIapIssue("[IAP] finishTransaction failed", err);
        }

        finish({
          status: "ok",
          subscription: res.data.subscription,
          entitlement: res.data.entitlement,
        });
      } catch (err: any) {
        finish({
          status: "error",
          message: err?.message || IAP_VERIFICATION_ERROR_MESSAGE,
        });
      } finally {
        handlingPurchase = false;
      }
    };

    updateSub = IAP.purchaseUpdatedListener((purchase: any) => {
      void handlePurchase(purchase);
    });

    errorSub = IAP.purchaseErrorListener((err: any) => {
      if (IAP.isUserCancelledError(err)) {
        finish({ status: "cancelled" });
        return;
      }
      finish({
        status: "error",
        message: IAP.getUserFriendlyErrorMessage(err) || err?.message || IAP_PURCHASE_FAILED_MESSAGE,
      });
    });

    (async () => {
      try {
        const directResult = await IAP.requestPurchase(
          buildSubscriptionPurchaseRequest({
            platform: Platform.OS === "ios" ? "ios" : "android",
            productId: opts.productId,
            offerToken: opts.offerToken,
            accountToken,
          }),
        );
        const directPurchases = Array.isArray(directResult)
          ? directResult
          : directResult
            ? [directResult]
            : [];
        const matchingPurchase =
          directPurchases.find((purchase: any) => getPurchaseProductId(purchase) === opts.productId) ||
          directPurchases[0];
        if (matchingPurchase && !settled) {
          await handlePurchase(matchingPurchase);
        }
      } catch (err: any) {
        if (err?.message === IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE) {
          finish({ status: "error", message: IAP_ANDROID_OFFER_TOKEN_MISSING_MESSAGE });
          return;
        }
        if (IAP.isUserCancelledError(err)) {
          finish({ status: "cancelled" });
        } else {
          finish({
            status: "error",
            message: IAP.getUserFriendlyErrorMessage(err) || err?.message || IAP_PURCHASE_FAILED_MESSAGE,
          });
        }
      }
    })();
  });
}

/**
 * Ask the store what's currently owned, then push each transaction to the
 * backend verify endpoint. Useful on "Restore purchases" and on app launch
 * to recover a subscription after reinstall.
 */
export async function restorePurchases(): Promise<PurchaseResult[]> {
  if (!isMobileStorePurchasesEnabledForPlatform()) return [];

  const ok = await ensureConnection();
  if (!ok) return [];
  const IAP = getIapModule();
  if (!IAP) return [];

  let items: any[] = [];
  try {
    const nativeRestore = (IAP as any).restorePurchases;
    items =
      (typeof nativeRestore === "function"
        ? await nativeRestore({ onlyIncludeActiveItemsIOS: true })
        : await IAP.getAvailablePurchases()) || [];
  } catch (err) {
    reportIapIssue("[IAP] getAvailablePurchases failed", err);
    return [];
  }

  const results: PurchaseResult[] = [];
  for (const purchase of items) {
    const body = buildVerifyBodyForPurchase(purchase, Platform.OS);

    try {
      if (Platform.OS === "ios" && !body.signedTransaction) {
        results.push({
          status: "error",
          message: "StoreKit signed transaction is missing.",
        });
        continue;
      }
      const res = await api.post<VerifyResponse>("/api/mobile/iap/verify", body);
      if (res.error || !res.data?.success) {
        results.push({
          status: "error",
          message: res.error || res.data?.error || "Restore failed",
        });
        continue;
      }
      results.push({
        status: "ok",
        subscription: res.data.subscription,
        entitlement: res.data.entitlement,
      });
    } catch (err: any) {
      results.push({ status: "error", message: err?.message || "Restore error" });
    }
  }
  return results;
}

/**
 * Cold-start "pending purchase reconciler".
 *
 * The per-purchase listener in `purchaseSubscription` is only registered for
 * the duration of an active buy. If verify fails on a transient network error
 * or the 120s timeout fires, the listener is torn down with the StoreKit/Play
 * transaction still UNFINISHED — the user has been charged but holds no
 * entitlement, and nothing in the app is listening when the store re-delivers
 * it next session. (Manual "Restore purchases" is the only recovery, and it
 * deliberately does NOT finishTransaction.)
 *
 * Call this once on app start (when a session exists). It asks the store for
 * everything currently owned/pending, pushes each to /api/mobile/iap/verify,
 * and — CRUCIALLY — calls `finishTransaction` after a successful verify so the
 * store stops re-delivering it. Best-effort and total: it never throws, returns
 * how many transactions it successfully reconciled, and a single failure does
 * not abort the rest.
 *
 * Distinct from `restorePurchases` (user-initiated, surfaces per-item UI
 * results, leaves transactions unfinished): this is the silent background
 * settle-up of charged-but-unverified purchases.
 */
/**
 * Pure decision for the reconciler: build the verify body for a pending
 * purchase, or return `null` when it can't be safely verified.
 *
 * An iOS transaction with no signed payload (JWS) is unverifiable — we must
 * NOT finish it (that would forfeit the store's retry), so it's skipped. On
 * Android we backfill the productId from the purchase's own id list when the
 * primary field is absent. Extracted + exported so the skip/keep logic is
 * unit-testable without the native `require("expo-iap")` (which can't be mocked
 * in the node test env).
 */
export function buildReconcileVerifyBody(
  purchase: any,
  platform: "ios" | "android" | string = Platform.OS,
): Record<string, unknown> | null {
  const body = buildVerifyBodyForPurchase(purchase, platform);
  if (platform === "ios" && !body.signedTransaction) return null;
  if (platform === "android" && !body.productId) {
    const pid = getPurchaseProductId(purchase);
    if (pid) body.productId = pid;
  }
  return body;
}

export async function reconcilePendingPurchases(): Promise<{ reconciled: number }> {
  if (!isMobileStorePurchasesEnabledForPlatform()) return { reconciled: 0 };

  const ok = await ensureConnection();
  if (!ok) return { reconciled: 0 };
  const IAP = getIapModule();
  if (!IAP) return { reconciled: 0 };

  let items: any[] = [];
  try {
    // Active items only: a finished/expired transaction has nothing left to
    // settle, and on iOS this avoids re-processing the full purchase history.
    items = (await IAP.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true })) || [];
  } catch (err) {
    reportIapIssue("[IAP] reconcile getAvailablePurchases failed", err);
    return { reconciled: 0 };
  }

  let reconciled = 0;
  for (const purchase of items) {
    const body = buildReconcileVerifyBody(purchase, Platform.OS);
    // null ⇒ unverifiable (e.g. iOS transaction missing its signed payload).
    // Skip rather than finishing it, so the store re-delivers it later.
    if (!body) continue;

    try {
      const res = await api.post<VerifyResponse>("/api/mobile/iap/verify", body);
      // Only finish once the server actually owns the entitlement. On failure
      // leave the transaction UNFINISHED so the store re-delivers it later.
      if (res.error || !res.data?.success) continue;
      try {
        await IAP.finishTransaction({ purchase, isConsumable: false });
        reconciled += 1;
      } catch (err) {
        reportIapIssue("[IAP] reconcile finishTransaction failed", err);
      }
    } catch (err) {
      reportIapIssue("[IAP] reconcile verify failed", err);
    }
  }
  return { reconciled };
}

export async function openNativeSubscriptionSettings(productId?: string) {
  if (!isMobileStorePurchasesEnabledForPlatform()) return;

  const IAP = getIapModule();
  if (!IAP) return;

  try {
    await IAP.deepLinkToSubscriptions(
      Platform.OS === "android"
        ? {
            skuAndroid: productId,
            packageNameAndroid: getAndroidPackageName(),
          }
        : undefined,
    );
  } catch (err) {
    reportIapIssue("[IAP] deepLinkToSubscriptions failed", err);
  }
}
