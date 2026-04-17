declare module "expo-iap" {
  export function initConnection(): Promise<boolean>;
  export function endConnection(): Promise<void>;
  export function fetchProducts(params: { skus: string[]; type: "in-app" | "subs" }): Promise<any[]>;
  export function requestPurchase(params: any): Promise<void>;
  export function finishTransaction(params: { purchase: any; isConsumable?: boolean }): Promise<void>;
  export function getAvailablePurchases(params?: any): Promise<any[]>;
  export function deepLinkToSubscriptions(params?: any): Promise<void>;
  export function purchaseUpdatedListener(listener: (purchase: any) => void): { remove: () => void };
  export function purchaseErrorListener(listener: (error: any) => void): { remove: () => void };
  export function isUserCancelledError(error: any): boolean;
  export function getUserFriendlyErrorMessage(error: any): string;
}
