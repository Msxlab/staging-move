import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import { Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useAppLockStore } from "@/lib/app-lock-store";
import { useAuthStore } from "@/lib/auth-store";
import { clearSensitiveLocalState } from "@/lib/local-cleanup";
import { unregisterPushNotifications } from "@/lib/push";
import { useAppTheme, type Theme } from "@/lib/theme";

const BACKGROUND_LOCK_GRACE_MS = 15_000;

function isPublicSegment(segment: string) {
  return (
    segment === "(auth)" ||
    segment === "oauth" ||
    segment === "reset-password" ||
    segment === "blog"
  );
}

export function AppLockGate({ children }: { children: React.ReactNode }) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const clearSession = useAuthStore((s) => s.clearSession);
  const enabled = useAppLockStore((s) => s.enabled);
  const hydrated = useAppLockStore((s) => s.hydrated);
  const locked = useAppLockStore((s) => s.locked);
  const authenticating = useAppLockStore((s) => s.authenticating);
  const methodLabel = useAppLockStore((s) => s.methodLabel);
  const lockError = useAppLockStore((s) => s.error);
  const hydrate = useAppLockStore((s) => s.hydrate);
  const lock = useAppLockStore((s) => s.lock);
  const unlock = useAppLockStore((s) => s.unlock);
  const lastBackgroundAt = useRef<number | null>(null);
  const promptedForCurrentLock = useRef(false);
  const authenticatingRef = useRef(false);

  const currentSegment = String(segments[0] || "");
  const canProtect = Boolean(token) && !loading && !isPublicSegment(currentSegment);
  const shouldCover = canProtect && (!hydrated || (enabled && locked));
  const promptCopy = useMemo(() => ({
    promptMessage: t("settings.appLock_prompt", { method: methodLabel }),
    cancelLabel: t("common.cancel"),
    fallbackLabel: t("settings.appLock_usePasscode"),
  }), [methodLabel, t]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!canProtect || !hydrated || !enabled) return;

    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      // Bail while WE are showing the biometric prompt (it backgrounds the app)
      // or while already locked — either way an inactive/active blip must not
      // stamp a background time or re-fire lock(). Read `locked` live to dodge a
      // stale closure (it's not in the dep array).
      if (authenticatingRef.current || useAppLockStore.getState().locked) return;
      if (nextState === "background" || nextState === "inactive") {
        lastBackgroundAt.current = Date.now();
        return;
      }
      if (
        nextState === "active" &&
        lastBackgroundAt.current &&
        Date.now() - lastBackgroundAt.current > BACKGROUND_LOCK_GRACE_MS
      ) {
        lastBackgroundAt.current = null; // consume the stamp so it can't re-fire
        lock();
      }
    });

    return () => subscription.remove();
  }, [canProtect, enabled, hydrated, lock]);

  useEffect(() => {
    if (!canProtect || !locked) {
      promptedForCurrentLock.current = false;
      return;
    }
    if (!hydrated || !enabled || authenticating || promptedForCurrentLock.current) return;
    promptedForCurrentLock.current = true;
    // Set the guard SYNCHRONOUSLY (not via a render-mirrored effect) so the
    // prompt's immediate AppState=inactive can never slip past the listener
    // above. Clear it once the prompt resolves.
    authenticatingRef.current = true;
    void unlock(promptCopy).finally(() => {
      authenticatingRef.current = false;
    });
  }, [authenticating, canProtect, enabled, hydrated, locked, promptCopy, unlock]);

  const handleTryAgain = () => {
    void unlock(promptCopy);
  };

  const handleSignOut = async () => {
    await unregisterPushNotifications().catch(() => {});
    await api.post("/api/auth/logout").catch(() => {});
    await clearSession();
    await clearSensitiveLocalState(queryClient);
    router.replace("/(auth)/sign-in");
  };

  return (
    <>
      {children}
      {shouldCover ? (
        <View style={styles.overlay}>
          <View style={styles.lockIcon}>
            <Lock size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>{t("settings.appLock_lockedTitle")}</Text>
          <Text style={styles.description}>
            {lockError
              ? t("settings.appLock_unavailableDescription", { method: methodLabel })
              : t("settings.appLock_lockedDescription", { method: methodLabel })}
          </Text>
          {authenticating || !hydrated ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.busyText}>{t("common.loading")}</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleTryAgain}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{t("settings.appLock_unlockButton")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.textButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={styles.textButtonLabel}>{t("settings.appLock_signOut")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: theme.colors.background,
  },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
  },
  busyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    paddingHorizontal: 22,
    backgroundColor: theme.colors.primary,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  textButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textButtonLabel: {
    color: theme.colors.textTertiary,
    fontSize: 14,
    fontWeight: "700",
  },
});
