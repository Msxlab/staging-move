import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Shield,
  Download,
  Trash2,
  Eye,
  Lock,
  Smartphone,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { api } from "@/lib/api";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { useAppLockStore } from "@/lib/app-lock-store";

interface AccountSecurityState {
  account: {
    hasPasswordLogin: boolean;
    emailVerified: boolean;
    mfaEnabled: boolean;
  };
  linkedMethods: Array<{
    type: string;
    label: string;
    enabled: boolean;
    linkedAt: string | null;
  }>;
  sessions: Array<{
    id: string;
    current: boolean;
    browser: string | null;
    os: string | null;
    deviceType: string | null;
    ipAddress: string | null;
    isActive: boolean;
    lastActivity: string;
    createdAt: string;
  }>;
}

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [security, setSecurity] = useState<AccountSecurityState | null>(null);
  const [loadingSecurity, setLoadingSecurity] = useState(true);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  const [loadingConsents, setLoadingConsents] = useState(true);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);
  const appLockEnabled = useAppLockStore((s) => s.enabled);
  const appLockHydrated = useAppLockStore((s) => s.hydrated);
  const appLockAvailable = useAppLockStore((s) => s.available);
  const appLockMethodLabel = useAppLockStore((s) => s.methodLabel);
  const appLockChecking = useAppLockStore((s) => s.checking);
  const appLockAuthenticating = useAppLockStore((s) => s.authenticating);
  const hydrateAppLock = useAppLockStore((s) => s.hydrate);
  const enableAppLock = useAppLockStore((s) => s.enable);
  const disableAppLock = useAppLockStore((s) => s.disable);

  async function loadSecurity() {
    setLoadingSecurity(true);
    const res = await api.get<AccountSecurityState>("/api/auth/security");
    if (res.data) setSecurity(res.data);
    setLoadingSecurity(false);
  }

  async function loadConsents() {
    const res = await api.get<any>("/api/consent");
    if (res.error) {
      setConsentError(res.error);
      setLoadingConsents(false);
      return;
    }
    const granted = res.data?.consents?.ANALYTICS?.granted === true;
    setAnalyticsConsent(granted);
    setAnalyticsEnabled(granted);
    setConsentError(null);
    setLoadingConsents(false);
  }

  useEffect(() => {
    loadSecurity();
    loadConsents().catch(() => {
      setConsentError("Privacy preferences could not be loaded.");
      setLoadingConsents(false);
    });
  }, []);

  useEffect(() => {
    void hydrateAppLock();
  }, [hydrateAppLock]);

  const updateAnalyticsConsent = async (granted: boolean) => {
    setConsentBusy(true);
    const res = await api.post<any>("/api/consent", {
      grants: [{ category: "ANALYTICS", granted }],
    });
    setConsentBusy(false);
    if (res.error) {
      setConsentError(res.error);
      Alert.alert("Privacy", res.error);
      return;
    }
    setAnalyticsConsent(granted);
    setAnalyticsEnabled(granted);
    setConsentError(null);
  };

  const updateAppLock = async (enabled: boolean) => {
    if (!enabled) {
      await disableAppLock();
      hapticSuccess();
      return;
    }

    const result = await enableAppLock({
      promptMessage: t("settings.appLock_prompt", { method: appLockMethodLabel }),
      cancelLabel: t("common.cancel"),
      fallbackLabel: t("settings.appLock_usePasscode"),
    });

    if (result.success) {
      hapticSuccess();
      return;
    }

    hapticError();
    Alert.alert(
      t("settings.appLock_enableFailedTitle"),
      result.reason === "not_enrolled" || result.reason === "no_hardware"
        ? t("settings.appLock_unavailable")
        : t("settings.appLock_enableFailedBody"),
    );
  };

  const requestSetPasswordEmail = async () => {
    setPasswordSetupBusy(true);
    const res = await api.post<AccountSecurityState & { success: boolean }>(
      "/api/auth/security",
      { action: "request_set_password" },
    );
    setPasswordSetupBusy(false);
    if (res.error) {
      Alert.alert("Password", res.error);
      return;
    }
    if (res.data) {
      setSecurity(res.data);
      Alert.alert("Password", "We sent a secure password setup link to your email.");
    }
  };

  const revokeOtherSessions = async () => {
    setSecurityBusy(true);
    const res = await api.post<AccountSecurityState & { success: boolean; revoked: number }>(
      "/api/auth/security",
      { action: "revoke_other_sessions" },
    );
    setSecurityBusy(false);
    if (res.error) {
      Alert.alert("Sessions", res.error);
      return;
    }
    if (res.data) {
      setSecurity(res.data);
      Alert.alert("Sessions", `${res.data.revoked || 0} other session(s) revoked.`);
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      t("settings.export"),
      t("settings.export_description"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          onPress: () => {
            router.push("/settings/export");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    hapticWarning();
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.delete_description"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.continue"),
          style: "destructive",
          onPress: () => {
            router.push("/settings/delete-account");
          },
        },
      ]
    );
  };

  const infoItems = [
    {
      icon: Eye,
      title: t("settings.privacy_title"),
      description: t("settings.privacy_description"),
    },
    {
      icon: Lock,
      title: t("settings.security"),
      description: t("settings.twoFactor_enabledDescription"),
    },
    {
      icon: Shield,
      title: t("settings.privacy"),
      description: t("settings.privacy_doNotSell_description"),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.privacy")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Card variant="default" style={{ marginBottom: 12 }}>
          <View style={styles.consentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>{t("settings.appLock_title")}</Text>
              <Text style={styles.infoDesc}>{t("settings.appLock_description")}</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={updateAppLock}
              disabled={
                !appLockHydrated ||
                appLockChecking ||
                appLockAuthenticating ||
                (!appLockAvailable && !appLockEnabled)
              }
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
          <Text style={[styles.mutedText, { marginTop: 10 }]}>
            {appLockAvailable
              ? t("settings.appLock_available", { method: appLockMethodLabel })
              : t("settings.appLock_unavailable")}
          </Text>
        </Card>

        <Card variant="default" style={{ marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.infoTitle}>Account security</Text>
              <Text style={styles.infoDesc}>
                Linked sign-in methods and real login sessions for this account.
              </Text>
            </View>
            <Shield size={18} color={theme.colors.primary} />
          </View>

          {loadingSecurity ? (
            <Text style={styles.mutedText}>Loading account security...</Text>
          ) : !security ? (
            <Text style={styles.errorText}>Account security could not be loaded.</Text>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={styles.badgeRow}>
                <Badge
                  label={security.account.emailVerified ? "Email verified" : "Email pending"}
                  variant={security.account.emailVerified ? "success" : "warning"}
                />
                <Badge
                  label={security.account.hasPasswordLogin ? "Password enabled" : "OAuth only"}
                  variant={security.account.hasPasswordLogin ? "success" : "warning"}
                />
                <Badge
                  label={security.account.mfaEnabled ? "MFA enabled" : "MFA off"}
                  variant={security.account.mfaEnabled ? "success" : "neutral"}
                />
              </View>

              <View>
                <Text style={styles.subheading}>Linked methods</Text>
                <View style={styles.methodList}>
                  {security.linkedMethods.map((method) => (
                    <View key={`${method.type}-${method.linkedAt || "none"}`} style={styles.methodRow}>
                      <Text style={styles.methodLabel}>{method.label}</Text>
                      <Text style={method.enabled ? styles.methodEnabled : styles.methodDisabled}>
                        {method.enabled ? "Enabled" : "Not set"}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {!security.account.hasPasswordLogin && (
                <View style={styles.passwordBox}>
                  <Text style={styles.subheading}>Set password</Text>
                  <Text style={styles.mutedText}>
                    We will email a secure setup link. OAuth sign-in remains linked.
                  </Text>
                  <Button
                    title="Email setup link"
                    onPress={requestSetPasswordEmail}
                    loading={passwordSetupBusy}
                    fullWidth
                  />
                </View>
              )}

              <View>
                <View style={styles.sessionHeader}>
                  <Text style={styles.subheading}>Login sessions</Text>
                  <Button
                    title="Revoke others"
                    onPress={revokeOtherSessions}
                    variant="outline"
                    size="sm"
                    loading={securityBusy}
                    disabled={security.sessions.filter((session) => session.isActive && !session.current).length === 0}
                  />
                </View>
                <View style={styles.methodList}>
                  {security.sessions.slice(0, 5).map((session) => (
                    <View key={session.id} style={styles.sessionRow}>
                      <Smartphone size={16} color={theme.colors.textMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodLabel}>
                          {session.browser || "Unknown browser"}{session.os ? ` / ${session.os}` : ""}
                        </Text>
                        <Text style={styles.mutedText}>
                          {session.current ? "Current · " : ""}{session.isActive ? "Active" : "Revoked"} · {new Date(session.lastActivity).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {security.sessions.length === 0 && (
                    <Text style={styles.mutedText}>No login sessions recorded yet.</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </Card>

        <Card variant="default" style={{ marginBottom: 12 }}>
          <View style={styles.consentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Analytics</Text>
              <Text style={styles.infoDesc}>
                Allow mobile usage analytics for product quality and reliability reporting.
              </Text>
            </View>
            <Switch
              value={analyticsConsent}
              onValueChange={updateAnalyticsConsent}
              disabled={consentBusy || loadingConsents || Boolean(consentError)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
          {loadingConsents ? (
            <Text style={styles.mutedText}>Loading privacy preferences...</Text>
          ) : consentError ? (
            <View style={styles.inlineErrorRow}>
              <Text style={styles.errorText}>{consentError}</Text>
              <Button
                title="Try again"
                onPress={() => {
                  setLoadingConsents(true);
                  setConsentError(null);
                  void loadConsents();
                }}
                variant="outline"
                size="sm"
              />
            </View>
          ) : null}
        </Card>

        {/* Info Cards */}
        {infoItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} variant="default" style={{ marginBottom: 12 }}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Icon size={18} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoTitle}>{item.title}</Text>
                  <Text style={styles.infoDesc}>{item.description}</Text>
                </View>
              </View>
            </Card>
          );
        })}

        {/* Actions */}
        <Text style={styles.sectionTitle}>{t("common.more")}</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} activeOpacity={0.6}>
          <Download size={18} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.actionLabel}>{t("settings.export")}</Text>
            <Text style={styles.actionDesc}>{t("settings.export_description")}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
          <Trash2 size={18} color={theme.colors.error} />
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerLabel}>{t("settings.deleteAccount")}</Text>
            <Text style={styles.dangerDesc}>{t("settings.delete_description")}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  infoRow: { flexDirection: "row", gap: 14 },
  infoIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center",
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  infoDesc: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mutedText: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 17 },
  errorText: { fontSize: 12, color: theme.colors.error, lineHeight: 17 },
  inlineErrorRow: { gap: 10, marginTop: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subheading: { fontSize: 12, fontWeight: "700", color: theme.colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  methodList: { gap: 8 },
  methodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  methodLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  methodEnabled: { fontSize: 12, color: theme.colors.success },
  methodDisabled: { fontSize: 12, color: theme.colors.warning },
  passwordBox: { gap: 10, padding: 12, borderWidth: 1, borderColor: "rgba(242, 196, 108,0.25)", borderRadius: theme.radius.lg, backgroundColor: theme.colors.warningFaded },
  sessionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  sectionTitle: {
    fontSize: 13, fontWeight: "600", color: theme.colors.textTertiary,
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: 24, marginBottom: 12, marginLeft: 4,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10,
  },
  actionLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  actionDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: theme.colors.errorFaded, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)", marginTop: 8,
  },
  dangerLabel: { fontSize: 15, fontWeight: "600", color: theme.colors.error },
  dangerDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
});
