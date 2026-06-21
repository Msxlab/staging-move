import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SELECTED_WORKSPACE_ID_KEY,
  getSelectedWorkspaceId,
  normalizeWorkspaceId,
  setSelectedWorkspaceId,
} from "./workspace-selection";

describe("workspace-selection", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("normalizes only workspace ids accepted by the server resolver", () => {
    expect(normalizeWorkspaceId(" ws_123-ABC ")).toBe("ws_123-ABC");
    expect(normalizeWorkspaceId("bad id")).toBeNull();
    expect(normalizeWorkspaceId("x".repeat(31))).toBeNull();
    expect(normalizeWorkspaceId(null)).toBeNull();
  });

  it("persists and reads the selected workspace id", async () => {
    await setSelectedWorkspaceId("ws_123");

    expect(await getSelectedWorkspaceId()).toBe("ws_123");
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(SELECTED_WORKSPACE_ID_KEY, "ws_123");
  });

  it("clears the selection for null or invalid ids", async () => {
    await setSelectedWorkspaceId("ws_123");
    await setSelectedWorkspaceId(null);

    expect(await getSelectedWorkspaceId()).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SELECTED_WORKSPACE_ID_KEY);
  });

  it("drops corrupt stored values instead of sending them as headers", async () => {
    storage.set(SELECTED_WORKSPACE_ID_KEY, "bad id");

    expect(await getSelectedWorkspaceId()).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(SELECTED_WORKSPACE_ID_KEY);
  });

  it("returns null when storage read fails", async () => {
    (AsyncStorage.getItem as any).mockRejectedValueOnce(new Error("storage unavailable"));

    expect(await getSelectedWorkspaceId()).toBeNull();
  });
});
