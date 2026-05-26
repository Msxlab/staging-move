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
