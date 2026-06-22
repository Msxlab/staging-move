import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Shield,
  Download,
  FileText,
  Trash2,
  Eye,
  Lock,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Fingerprint,
  BarChart3,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { HeroCard, SectionHeader, Pill } from "@/components/move";
import { Button } from "@/components/ui/Button";
import { hapticError, hapticSuccess, hapticWarning } from "@/lib/haptics";
import { api, APP_WEB_URL } from "@/lib/api";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { useAppLockStore } from "@/lib/app-lock-store";
import { getPasswordLinkAction } from "@/lib/password-management";
import { openWebUrl } from "@/lib/in-app-browser";

const PRIVACY_POLICY_URL = `${APP_WEB_URL}/privacy`;
const TERMS_OF_USE_URL = `${APP_WEB_URL}/terms`;

interface AccountSecurityState {
  account: {
    email: string;
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

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
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
      setConsentError(t("settings.privacyLoadFailed"));
      setLoadingConsents(false);
    });
  }, [t]);

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
      setConsentError(t("settings.privacyLoadFailed"));
      Alert.alert(t("settings.privacy"), t("settings.privacyLoadFailed"));
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

  const requestPasswordLink = async () => {
    if (!security?.account?.email) {
      Alert.alert(t("settings.passwordSetupTitle"), t("settings.privacyLoadFailed"));
      return;
    }
    const passwordLinkAction = getPasswordLinkAction({
      hasPasswordLogin: security.account.hasPasswordLogin,
      email: security.account.email,
    });
    setPasswordSetupBusy(true);
    const res = await api.post<AccountSecurityState & { success: boolean }>(
      passwordLinkAction.endpoint,
      passwordLinkAction.body,
    );
    setPasswordSetupBusy(false);
    if (res.error) {
      Alert.alert(t(passwordLinkAction.titleKey), t("settings.privacyLoadFailed"));
      return;
    }
    if (res.data && passwordLinkAction.endpoint === "/api/auth/security") {
      setSecurity(res.data);
    }
    Alert.alert(t(passwordLinkAction.titleKey), t(passwordLinkAction.successMessageKey));
  };

  const revokeOtherSessions = async () => {
    setSecurityBusy(true);
    const res = await api.post<AccountSecurityState & { success: boolean; revoked: number }>(
      "/api/auth/security",
      { action: "revoke_other_sessions" },
    );
    setSecurityBusy(false);
    if (res.error) {
      Alert.alert(t("settings.sessionsTitle"), t("settings.privacyLoadFailed"));
      return;
    }
    if (res.data) {
      setSecurity(res.data);
      Alert.alert(t("settings.sessionsTitle"), t("settings.sessionsRevoked", { count: res.data.revoked || 0 }));
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

  const handleOpenPrivacyPolicy = async () => {
    // Owned page -> chromeless in-app browser with the shared session and
    // ?embed=mobile (matches subscription/help), not a full Safari/Chrome jump.
    const opened = await openWebUrl(PRIVACY_POLICY_URL);
    if (!opened) {
      hapticError();
      Alert.alert(t("settings.privacy"), t("providers.linkUnavailable"));
    }
  };

  const handleOpenTermsOfUse = async () => {
    const opened = await openWebUrl(TERMS_OF_USE_URL);
    if (!opened) {
      hapticError();
      Alert.alert(t("settings.privacy"), t("providers.linkUnavailable"));
    }
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
      onPress: handleOpenPrivacyPolicy,
    },
    {
      icon: Lock,
      title: t("settings.security"),
      description: t("settings.twoFactor_enabledDescription"),
      onPress: () => router.push("/settings/two-factor" as Href),
    },
    {
      icon: Shield,
      title: t("settings.privacy_doNotSell_title"),
      description: t("settings.privacy_doNotSell_description"),
      onPress: handleOpenPrivacyPolicy,
    },
  ];
  const activeSessionCount = security?.sessions.filter((session) => session.isActive).length ?? 0;
  const linkedMethodCount = security?.linkedMethods.filter((method) => method.enabled).length ?? 0;
  const securityReadyCount = [
    security?.account.emailVerified,
    security?.account.hasPasswordLogin,
    security?.account.mfaEnabled,
    appLockEnabled,
    analyticsConsent,
  ].filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.privacy")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero — Move gradient surface with privacy posture stats. */}
        <HeroCard style={styles.hero} padding={18} radius={24}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Shield size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>PRIVACY COMMAND</Text>
              <Text style={styles.heroTitle}>{t("settings.privacy")}</Text>
              <Text style={styles.heroSub}>{t("settings.accountSecurityDescription")}</Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{securityReadyCount}/5</Text>
              <Text style={styles.heroStatLabel}>ready</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{linkedMethodCount}</Text>
              <Text style={styles.heroStatLabel}>methods</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{activeSessionCount}</Text>
              <Text style={styles.heroStatLabel}>sessions</Text>
            </View>
          </View>
        </HeroCard>

        {/* App lock toggle */}
        <View style={styles.card}>
          <View style={styles.consentRow}>
            <View style={styles.consentIcon}>
              <Fingerprint size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
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
              trackColor={{ false: theme.colors.track, true: theme.colors.primary }}
              thumbColor={theme.colors.onAccent}
            />
          </View>
          <Text style={[styles.mutedText, { marginTop: 10 }]}>
            {appLockAvailable
              ? t("settings.appLock_available", { method: appLockMethodLabel })
              : t("settings.appLock_unavailable")}
          </Text>
        </View>

        {/* Account security */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.infoTitle}>{t("settings.accountSecurityTitle")}</Text>
              <Text style={styles.infoDesc}>
                {t("settings.accountSecurityDescription")}
              </Text>
            </View>
            <View style={styles.cardHeaderIcon}>
              <Shield size={16} color={theme.colors.primary} />
            </View>
          </View>

          {loadingSecurity ? (
            <Text style={styles.mutedText}>{t("settings.accountSecurityLoading")}</Text>
          ) : !security ? (
            <Text style={styles.errorText}>{t("settings.accountSecurityUnavailable")}</Text>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={styles.badgeRow}>
                <Pill
                  label={security.account.emailVerified ? t("settings.emailVerified") : t("settings.emailPending")}
                  tone={security.account.emailVerified ? "success" : "warning"}
                />
                <Pill
                  label={security.account.hasPasswordLogin ? t("settings.passwordEnabled") : t("settings.oauthOnly")}
                  tone={security.account.hasPasswordLogin ? "success" : "warning"}
                />
                <Pill
                  label={security.account.mfaEnabled ? t("settings.mfaEnabled") : t("settings.mfaOff")}
                  tone={security.account.mfaEnabled ? "success" : "muted"}
                />
              </View>

              <View>
                <Text style={styles.subheading}>{t("settings.linkedMethods")}</Text>
                <View style={styles.methodList}>
                  {security.linkedMethods.map((method) => (
                    <View key={`${method.type}-${method.linkedAt || "none"}`} style={styles.methodRow}>
                      <Text style={styles.methodLabel}>{method.label}</Text>
                      <Text style={method.enabled ? styles.methodEnabled : styles.methodDisabled}>
                        {method.enabled ? t("common.enabled") : t("settings.notSet")}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.passwordBox}>
                <Text style={styles.subheading}>
                  {security.account.hasPasswordLogin
                    ? t("settings.changePassword")
                    : t("settings.setPassword")}
                </Text>
                <Text style={styles.mutedText}>
                  {security.account.hasPasswordLogin
                    ? t("settings.changePasswordDescription")
                    : t("settings.setPasswordDescription")}
                </Text>
                <Button
                  title={security.account.hasPasswordLogin
                    ? t("settings.emailResetLink")
                    : t("settings.emailSetupLink")}
                  onPress={requestPasswordLink}
                  loading={passwordSetupBusy}
                  fullWidth
                />
              </View>

              <View style={styles.passwordBox}>
                <Text style={styles.subheading}>{t("settings.twoFactor", { defaultValue: "Two-factor authentication" })}</Text>
                <Text style={styles.mutedText}>
                  {security.account.hasPasswordLogin
                    ? security.account.mfaEnabled
                      ? t("settings.twoFactor_onDescription", { defaultValue: "2FA is on. Manage or turn it off." })
                      : t("settings.twoFactor_offDescription", { defaultValue: "Add a one-time code from an authenticator app for stronger account security." })
                    : t("settings.twoFactor_needsPassword", { defaultValue: "Set a password first to enable two-factor authentication." })}
                </Text>
                <Button
                  title={
                    !security.account.hasPasswordLogin
                      ? t("settings.twoFactor_setPasswordCta", { defaultValue: "Email a set-password link" })
                      : security.account.mfaEnabled
                        ? t("settings.twoFactor_manage", { defaultValue: "Manage two-factor" })
                        : t("settings.twoFactor_enable", { defaultValue: "Enable two-factor" })
                  }
                  onPress={
                    !security.account.hasPasswordLogin
                      ? requestPasswordLink
                      : () => router.push("/settings/two-factor" as Href)
                  }
                  variant={security.account.mfaEnabled ? "outline" : "primary"}
                  loading={!security.account.hasPasswordLogin ? passwordSetupBusy : false}
                  fullWidth
                />
              </View>

              <View>
                <View style={styles.sessionHeader}>
                  <Text style={styles.subheading}>{t("settings.loginSessions")}</Text>
                  <Button
                    title={t("settings.revokeOthers")}
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
                      <View style={styles.sessionIcon}>
                        <Smartphone size={15} color={theme.colors.dim} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodLabel}>
                          {session.browser || t("settings.unknownBrowser")}{session.os ? ` / ${session.os}` : ""}
                        </Text>
                        <Text style={styles.mutedText}>
                          {session.current ? `${t("settings.current")} - ` : ""}{session.isActive ? t("settings.sessionActive") : t("settings.sessionRevoked")} - {new Date(session.lastActivity).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {security.sessions.length === 0 && (
                    <Text style={styles.mutedText}>{t("settings.noLoginSessions")}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Analytics consent */}
        <View style={styles.card}>
          <View style={styles.consentRow}>
            <View style={styles.consentIcon}>
              <BarChart3 size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.infoTitle}>{t("settings.analytics")}</Text>
              <Text style={styles.infoDesc}>
                {t("settings.analyticsDescription")}
              </Text>
            </View>
            <Switch
              value={analyticsConsent}
              onValueChange={updateAnalyticsConsent}
              disabled={consentBusy || loadingConsents || Boolean(consentError)}
              trackColor={{ false: theme.colors.track, true: theme.colors.primary }}
              thumbColor={theme.colors.onAccent}
            />
          </View>
          {loadingConsents ? (
            <Text style={[styles.mutedText, { marginTop: 10 }]}>{t("settings.privacyPreferencesLoading")}</Text>
          ) : consentError ? (
            <View style={styles.inlineErrorRow}>
              <Text style={styles.errorText}>{consentError}</Text>
              <Button
                title={t("common.retry")}
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
        </View>

        {/* Info Cards - tappable (Privacy/Do-not-sell -> policy, Security -> 2FA) */}
        <View style={styles.section}>
          <SectionHeader label={t("settings.privacy")} style={styles.sectionHeader} />
          <View style={styles.sectionCard}>
            {infoItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.title}
                  onPress={item.onPress}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  style={[styles.infoRow, i < infoItems.length - 1 && styles.rowBorder]}
                >
                  <View style={styles.infoIcon}>
                    <Icon size={17} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.infoTitle}>{item.title}</Text>
                    <Text style={styles.infoDesc}>{item.description}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.colors.faint} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <SectionHeader label={t("common.more")} style={styles.sectionHeader} />
          <View style={styles.sectionCard}>
            <TouchableOpacity style={[styles.actionBtn, styles.rowBorder]} onPress={handleOpenTermsOfUse} activeOpacity={0.6}>
              <View style={styles.infoIcon}>
                <FileText size={17} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionLabel}>
                  {t("settings.termsOfUse", { defaultValue: "Terms of Use" })}
                </Text>
                <Text style={styles.actionDesc}>
                  {t("settings.termsOfUse_description", {
                    defaultValue: "Open LocateFlow's terms of use.",
                  })}
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.rowBorder]} onPress={handleOpenPrivacyPolicy} activeOpacity={0.6}>
              <View style={styles.infoIcon}>
                <ExternalLink size={17} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionLabel}>
                  {t("settings.privacyPolicy", { defaultValue: "Privacy Policy" })}
                </Text>
                <Text style={styles.actionDesc}>
                  {t("settings.privacyPolicy_description", {
                    defaultValue: "Open LocateFlow's privacy policy.",
                  })}
                </Text>
              </View>
              <ChevronRight size={16} color={theme.colors.faint} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={handleExportData} activeOpacity={0.6}>
              <View style={styles.infoIcon}>
                <Download size={17} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.actionLabel}>{t("settings.export")}</Text>
                <Text style={styles.actionDesc}>{t("settings.export_description")}</Text>
              </View>
              <ChevronRight size={16} color={theme.colors.faint} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} activeOpacity={0.6}>
          <View style={styles.dangerIcon}>
            <Trash2 size={17} color={theme.colors.error} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.dangerLabel}>{t("settings.deleteAccount")}</Text>
            <Text style={styles.dangerDesc}>{t("settings.delete_description")}</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text, letterSpacing: 0 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { marginBottom: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.primary },
  heroTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3, letterSpacing: 0 },
  heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3, lineHeight: 17 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: { fontSize: 14, fontFamily: fonts.serifBold, color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.8,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  cardHeaderIcon: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  infoTitle: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  infoDesc: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 4, lineHeight: 18 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  consentIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  mutedText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, lineHeight: 17 },
  errorText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.error, lineHeight: 17 },
  inlineErrorRow: { gap: 10, marginTop: 12 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subheading: { fontSize: 11, fontFamily: fonts.sansBold, color: theme.colors.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  methodList: { gap: 8 },
  methodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface2 },
  methodLabel: { fontSize: 13, fontFamily: fonts.sansMedium, color: theme.colors.text },
  methodEnabled: { fontSize: 12, fontFamily: fonts.sansMedium, color: theme.colors.success },
  methodDisabled: { fontSize: 12, fontFamily: fonts.sansMedium, color: theme.colors.warning },
  passwordBox: { gap: 10, padding: 14, borderWidth: 1, borderColor: theme.colors.accentBorder, borderRadius: theme.radius.lg, backgroundColor: theme.colors.accentSoft },
  sessionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 },
  sessionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface2 },
  sessionIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: theme.colors.track, alignItems: "center", justifyContent: "center",
  },
  section: { marginTop: 10, marginBottom: 12 },
  sectionHeader: { marginBottom: 9, marginLeft: 2 },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 13,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: theme.colors.primaryFaded, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 13,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  actionLabel: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  actionDesc: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
  dangerBtn: {
    flexDirection: "row", alignItems: "center", gap: 13, padding: 14,
    backgroundColor: theme.colors.errorFaded, borderRadius: theme.radius.xl,
    borderWidth: 1, borderColor: theme.colors.redLine, marginTop: 8,
  },
  dangerIcon: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: theme.colors.redSoft, alignItems: "center", justifyContent: "center",
  },
  dangerLabel: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.error },
  dangerDesc: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
});
