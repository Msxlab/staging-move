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
import { api } from "@/lib/api";
import { MOBILE_STORE_PURCHASES_ENABLED } from "@/lib/billing-flags";
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
  if (!MOBILE_STORE_PURCHASES_ENABLED) return [];
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
  if (!MOBILE_STORE_PURCHASES_ENABLED) {
    return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };
  }

  const ok = await ensureConnection();
  if (!ok) return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };
  const IAP = getIapModule();
  if (!IAP) return { status: "error", message: IAP_STORE_UNAVAILABLE_MESSAGE };

  return new Promise<PurchaseResult>((resolve) => {
    let settled = false;
    const finish = (value: PurchaseResult) => {
      if (settled) return;
      settled = true;
      try {
        updateSub.remove();
      } catch {}
      try {
        errorSub.remove();
      } catch {}
      resolve(value);
    };

    const updateSub = IAP.purchaseUpdatedListener(async (purchase: any) => {
      try {
        const verifyBody: Record<string, unknown> =
          Platform.OS === "ios"
            ? {
                platform: "ios",
                // Prefer the JWS representation — it's self-authenticating.
                signedTransaction:
                  purchase?.jwsRepresentation ||
                  purchase?.jwsRepresentationIos ||
                  undefined,
                transactionId: purchase?.transactionId || purchase?.originalTransactionIdentifierIOS,
              }
            : {
                platform: "android",
                purchaseToken: purchase?.purchaseToken,
                productId: purchase?.productId || opts.productId,
              };

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
      }
    });

    const errorSub = IAP.purchaseErrorListener((err: any) => {
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
        await IAP.requestPurchase(
          buildSubscriptionPurchaseRequest({
            platform: Platform.OS === "ios" ? "ios" : "android",
            productId: opts.productId,
            offerToken: opts.offerToken,
          }),
        );
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
  if (!MOBILE_STORE_PURCHASES_ENABLED) return [];

  const ok = await ensureConnection();
  if (!ok) return [];
  const IAP = getIapModule();
  if (!IAP) return [];

  let items: any[] = [];
  try {
    items = (await IAP.getAvailablePurchases()) || [];
  } catch (err) {
    reportIapIssue("[IAP] getAvailablePurchases failed", err);
    return [];
  }

  const results: PurchaseResult[] = [];
  for (const purchase of items) {
    const body: Record<string, unknown> =
      Platform.OS === "ios"
        ? {
            platform: "ios",
            signedTransaction:
              purchase?.jwsRepresentation ||
              purchase?.jwsRepresentationIos ||
              undefined,
            transactionId:
              purchase?.transactionId || purchase?.originalTransactionIdentifierIOS,
          }
        : {
            platform: "android",
            purchaseToken: purchase?.purchaseToken,
            productId: purchase?.productId,
          };

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
  if (!MOBILE_STORE_PURCHASES_ENABLED) return;

  const IAP = getIapModule();
  if (!IAP) return;

  try {
    await IAP.deepLinkToSubscriptions(productId ? { sku: productId } : undefined);
  } catch (err) {
    reportIapIssue("[IAP] deepLinkToSubscriptions failed", err);
  }
}
