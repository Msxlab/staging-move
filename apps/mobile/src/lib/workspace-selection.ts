import AsyncStorage from "@react-native-async-storage/async-storage";

export const SELECTED_WORKSPACE_ID_KEY = "locateflow.selectedWorkspaceId";

const WORKSPACE_ID_RE = /^[A-Za-z0-9_-]{1,30}$/;

export function normalizeWorkspaceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return WORKSPACE_ID_RE.test(trimmed) ? trimmed : null;
}

export async function getSelectedWorkspaceId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_WORKSPACE_ID_KEY);
    const normalized = normalizeWorkspaceId(raw);
    if (!normalized && raw !== null) {
      await AsyncStorage.removeItem(SELECTED_WORKSPACE_ID_KEY).catch(() => {});
    }
    return normalized;
  } catch {
    return null;
  }
}

export async function setSelectedWorkspaceId(workspaceId: string | null): Promise<void> {
  const normalized = normalizeWorkspaceId(workspaceId);
  if (!normalized) {
    await AsyncStorage.removeItem(SELECTED_WORKSPACE_ID_KEY);
    return;
  }
  await AsyncStorage.setItem(SELECTED_WORKSPACE_ID_KEY, normalized);
}
