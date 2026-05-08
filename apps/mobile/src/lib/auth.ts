import * as SecureStore from "expo-secure-store";

export const AUTH_SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key, AUTH_SECURE_STORE_OPTIONS);
    } catch {
      await SecureStore.deleteItemAsync(key, AUTH_SECURE_STORE_OPTIONS);
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, AUTH_SECURE_STORE_OPTIONS);
    } catch {
      // SecureStore is not available on web
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, AUTH_SECURE_STORE_OPTIONS);
    } catch {
      // Ignore
    }
  },
};
