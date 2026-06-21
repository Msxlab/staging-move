import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";

interface SetupData {
  provisioningUri: string;
  qrDataUrl: string;
  secret: string;
  backupCodes: string[];
}

/**
 * Mobile two-factor (TOTP) management - parity with web. Enable: re-enter
 * password -> /api/auth/mfa/setup returns a QR + secret + one-time backup codes
 * -> enter the 6-digit code -> /api/auth/mfa/confirm flips it on. Disable:
 * re-enter password -> /api/auth/mfa/disable. All endpoints are bearer-auth.
 */
export default function TwoFactorScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const res = await api.get<any>("/api/auth/security");
    if (res.data?.account) {
      setMfaEnabled(res.data.account.mfaEnabled === true);
      setHasPassword(res.data.account.hasPasswordLogin === true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startSetup = async () => {
    if (!password) return;
    setBusy(true);
    const res = await api.post<SetupData>("/api/auth/mfa/setup", { password });
    setBusy(false);
    if (res.data?.secret) {
      setSetup(res.data);
      setPassword("");
      hapticSuccess();
    } else {
      hapticError();
      Alert.alert(
        t("settings.twoFactor", { defaultValue: "Two-factor authentication" }),
        res.error || t("settings.twoFactor_setupFailed", { defaultValue: "Could not start setup." }),
      );
    }
  };

  const confirmSetup = async () => {
    if (code.length < 6) return;
    setBusy(true);
    // skipUnauthorizedHandler: an older server returns 401 for a wrong code; that
    // must NOT trip the global sign-out - the session is fine, the digits aren't.
    const res = await api.post<any>("/api/auth/mfa/confirm", { mfaCode: code }, { skipUnauthorizedHandler: true });
    setBusy(false);
    if (res.data?.success === true) {
      hapticSuccess();
      setDone(true);
      setMfaEnabled(true);
      setSetup(null);
      setCode("");
    } else {
      hapticError();
      Alert.alert(
        t("settings.twoFactor", { defaultValue: "Two-factor authentication" }),
        res.error || t("settings.twoFactor_invalidCode", { defaultValue: "That code didn't match. Try again." }),
      );
    }
  };

  const disableMfa = async () => {
    if (!password) return;
    const code = disableCode.trim();
    if (!code) return;
    setBusy(true);
    // 6-digit numeric = TOTP; anything else = backup recovery code.
    const isTotp = /^\d{6}$/.test(code);
    const res = await api.post<any>("/api/auth/mfa/disable", {
      password,
      ...(isTotp ? { mfaCode: code } : { backupCode: code }),
    });
    setBusy(false);
    if (res.data?.success === true) {
      hapticSuccess();
      setMfaEnabled(false);
      setDone(false); // clear the "enabled" card so the disabled state renders
      setPassword("");
      setDisableCode("");
      Alert.alert(
        t("settings.twoFactor", { defaultValue: "Two-factor authentication" }),
        t("settings.twoFactor_disabled", { defaultValue: "Two-factor authentication is now off." }),
      );
    } else {
      hapticError();
      Alert.alert(
        t("settings.twoFactor", { defaultValue: "Two-factor authentication" }),
        res.error || t("settings.twoFactor_disableFailed", { defaultValue: "Could not disable. Check your password." }),
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.twoFactor", { defaultValue: "Two-factor authentication" })}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <ShieldCheck size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>{t("settings.twoFactor", { defaultValue: "Two-factor authentication" }).toUpperCase()}</Text>
              <Text style={styles.heroTitle}>{t("settings.twoFactor", { defaultValue: "Two-factor authentication" })}</Text>
              <Text style={styles.heroSub}>
                {mfaEnabled
                  ? t("settings.twoFactor_onDescription", { defaultValue: "2FA is on. Manage or turn it off." })
                  : t("settings.twoFactor_offDescription", { defaultValue: "Add a one-time code from an authenticator app for stronger account security." })}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{mfaEnabled ? "On" : "Off"}</Text>
              <Text style={styles.heroStatLabel}>2FA</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{hasPassword ? "Yes" : "No"}</Text>
              <Text style={styles.heroStatLabel}>password</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{setup ? "Setup" : done ? "Done" : "Ready"}</Text>
              <Text style={styles.heroStatLabel}>state</Text>
            </View>
          </View>
        </HeroCard>

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : done || (mfaEnabled && !setup) ? (
          <MoveCard style={styles.card} padding={16} radius={theme.radius.xl}>
            <View style={styles.statusRow}>
              <ShieldCheck size={20} color={theme.colors.success} />
              <Pill label={t("settings.mfaEnabled", { defaultValue: "2FA on" })} tone="success" />
            </View>
            <Text style={styles.body}>
              {done
                ? t("settings.twoFactor_enabledNow", { defaultValue: "Two-factor authentication is now protecting your account." })
                : t("settings.twoFactor_onDescription", { defaultValue: "2FA is on. Manage or turn it off." })}
            </Text>
            <Text style={styles.subheading}>{t("settings.twoFactor_turnOff", { defaultValue: "Turn off two-factor" })}</Text>
            <Text style={styles.muted}>{t("settings.twoFactor_disableHint2", { defaultValue: "Re-enter your password and a current authenticator (or backup) code to disable." })}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("settings.password", { defaultValue: "Password" })}
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              value={disableCode}
              onChangeText={setDisableCode}
              placeholder={t("settings.twoFactor_codePlaceholder", { defaultValue: "Authenticator or backup code" })}
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoComplete="one-time-code"
            />
            <TouchableOpacity
              style={[styles.outlineBtn, (!password || !disableCode.trim() || busy) && styles.btnDisabled]}
              onPress={disableMfa}
              disabled={!password || !disableCode.trim() || busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Text style={styles.outlineBtnText}>{t("settings.twoFactor_disable", { defaultValue: "Disable two-factor" })}</Text>
              )}
            </TouchableOpacity>
          </MoveCard>
        ) : setup ? (
          <MoveCard style={styles.card} padding={16} radius={theme.radius.xl}>
            <Text style={styles.subheading}>{t("settings.twoFactor_scan", { defaultValue: "Scan with an authenticator app" })}</Text>
            <Text style={styles.muted}>
              {t("settings.twoFactor_scanHint", { defaultValue: "Scan the QR code in Google Authenticator, 1Password, or Authy - or enter the key manually." })}
            </Text>
            {setup.qrDataUrl ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: setup.qrDataUrl }} style={styles.qr} resizeMode="contain" />
              </View>
            ) : null}
            <Text style={styles.muted}>{t("settings.twoFactor_manualKey", { defaultValue: "Setup key" })}</Text>
            <Text selectable style={styles.secret}>{setup.secret}</Text>

            {setup.backupCodes?.length ? (
              <View style={styles.backupBox}>
                <Text style={styles.subheading}>{t("settings.twoFactor_backupCodes", { defaultValue: "Backup codes" })}</Text>
                <Text style={styles.muted}>
                  {t("settings.twoFactor_backupHint", { defaultValue: "Save these now. Each works once if you lose your device." })}
                </Text>
                <View style={styles.codeGrid}>
                  {setup.backupCodes.map((c) => (
                    <Text key={c} selectable style={styles.backupCode}>{c}</Text>
                  ))}
                </View>
              </View>
            ) : null}

            <Text style={styles.subheading}>{t("settings.twoFactor_enterCode", { defaultValue: "Enter the 6-digit code" })}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.gradBtn, (code.length < 6 || busy) && styles.btnDisabled]}
              onPress={confirmSetup}
              disabled={code.length < 6 || busy}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradBtnInner}
              >
                {busy ? (
                  <ActivityIndicator color={theme.colors.onAccent} />
                ) : (
                  <Text style={styles.gradBtnText}>{t("settings.twoFactor_verifyEnable", { defaultValue: "Verify & enable" })}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </MoveCard>
        ) : (
          <MoveCard style={styles.card} padding={16} radius={theme.radius.xl}>
            <Text style={styles.body}>
              {t("settings.twoFactor_offDescription", { defaultValue: "Add a one-time code from an authenticator app for stronger account security." })}
            </Text>
            {hasPassword ? (
              <>
                <Text style={styles.muted}>{t("settings.twoFactor_confirmPassword", { defaultValue: "Confirm your password to begin." })}</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("settings.password", { defaultValue: "Password" })}
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.gradBtn, (!password || busy) && styles.btnDisabled]}
                  onPress={startSetup}
                  disabled={!password || busy}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={theme.colors.gradient.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradBtnInner}
                  >
                    {busy ? (
                      <ActivityIndicator color={theme.colors.onAccent} />
                    ) : (
                      <Text style={styles.gradBtnText}>{t("common.continue", { defaultValue: "Continue" })}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.muted}>
                {t("settings.twoFactor_needsPassword", { defaultValue: "Set a password first to enable two-factor authentication." })}
              </Text>
            )}
          </MoveCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 52, gap: 14 },
    hero: { marginBottom: 0 },
    heroTop: { flexDirection: "row", alignItems: "center", gap: 13 },
    heroIcon: {
      width: 46,
      height: 46,
      borderRadius: 16,
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    heroCopy: { flex: 1, minWidth: 0 },
    heroKicker: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.primary },
    heroTitle: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 4 },
    heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 4, lineHeight: 17 },
    heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
    heroStat: {
      flex: 1,
      minHeight: 58,
      borderRadius: 14,
      padding: 10,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: "center",
    },
    heroStatValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
    heroStatLabel: {
      fontSize: 9,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.6,
      color: theme.colors.faint,
      textTransform: "uppercase",
      marginTop: 3,
    },
    card: { gap: 12 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    body: { fontSize: 14, fontFamily: fonts.sans, color: theme.colors.dim, lineHeight: 20 },
    subheading: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text, marginTop: 4 },
    muted: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, lineHeight: 18 },
    input: {
      backgroundColor: theme.colors.bg2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: fonts.sans,
      color: theme.colors.text,
    },
    gradBtn: {
      borderRadius: theme.radius.lg,
      overflow: "hidden",
      marginTop: 4,
    },
    gradBtnInner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
    },
    gradBtnText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
    outlineBtn: {
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      backgroundColor: theme.colors.accentSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 15,
      marginTop: 4,
    },
    outlineBtnText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.primary },
    btnDisabled: { opacity: 0.55 },
    qrWrap: { alignItems: "center", paddingVertical: 8 },
    qr: { width: 200, height: 200, borderRadius: 12, backgroundColor: "#fff" },
    secret: { fontSize: 15, fontFamily: fonts.monoMedium, letterSpacing: 0.5, color: theme.colors.text, textAlign: "center" },
    backupBox: { borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 12, gap: 6 },
    codeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    backupCode: { fontSize: 13, fontFamily: fonts.mono, color: theme.colors.text, width: "30%" },
  });
}
