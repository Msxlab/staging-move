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
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";

interface SetupData {
  provisioningUri: string;
  qrDataUrl: string;
  secret: string;
  backupCodes: string[];
}

/**
 * Mobile two-factor (TOTP) management — parity with web. Enable: re-enter
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
    const res = await api.post<any>("/api/auth/mfa/confirm", { mfaCode: code });
    setBusy(false);
    if (res.data?.success || res.data) {
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
    setBusy(true);
    const res = await api.post<any>("/api/auth/mfa/disable", { password });
    setBusy(false);
    if (res.data?.success || res.data) {
      hapticSuccess();
      setMfaEnabled(false);
      setPassword("");
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
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.twoFactor", { defaultValue: "Two-factor authentication" })}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : done || (mfaEnabled && !setup) ? (
          <Card variant="default" style={{ gap: 12 }}>
            <View style={styles.statusRow}>
              <ShieldCheck size={20} color={theme.colors.emerald.text} />
              <Badge label={t("settings.mfaEnabled", { defaultValue: "2FA on" })} variant="success" />
            </View>
            <Text style={styles.body}>
              {done
                ? t("settings.twoFactor_enabledNow", { defaultValue: "Two-factor authentication is now protecting your account." })
                : t("settings.twoFactor_onDescription", { defaultValue: "2FA is on. Manage or turn it off." })}
            </Text>
            <Text style={styles.subheading}>{t("settings.twoFactor_turnOff", { defaultValue: "Turn off two-factor" })}</Text>
            <Text style={styles.muted}>{t("settings.twoFactor_disableHint", { defaultValue: "Re-enter your password to disable." })}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t("settings.password", { defaultValue: "Password" })}
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button
              title={t("settings.twoFactor_disable", { defaultValue: "Disable two-factor" })}
              onPress={disableMfa}
              loading={busy}
              disabled={!password}
              variant="outline"
              fullWidth
            />
          </Card>
        ) : setup ? (
          <Card variant="default" style={{ gap: 12 }}>
            <Text style={styles.subheading}>{t("settings.twoFactor_scan", { defaultValue: "Scan with an authenticator app" })}</Text>
            <Text style={styles.muted}>
              {t("settings.twoFactor_scanHint", { defaultValue: "Scan the QR code in Google Authenticator, 1Password, or Authy — or enter the key manually." })}
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
            <Button
              title={t("settings.twoFactor_verifyEnable", { defaultValue: "Verify & enable" })}
              onPress={confirmSetup}
              loading={busy}
              disabled={code.length < 6}
              fullWidth
            />
          </Card>
        ) : (
          <Card variant="default" style={{ gap: 12 }}>
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
                <Button
                  title={t("common.continue", { defaultValue: "Continue" })}
                  onPress={startSetup}
                  loading={busy}
                  disabled={!password}
                  fullWidth
                />
              </>
            ) : (
              <Text style={styles.muted}>
                {t("settings.twoFactor_needsPassword", { defaultValue: "Set a password first to enable two-factor authentication." })}
              </Text>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.card },
    title: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
    scroll: { padding: 16, gap: 12 },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    body: { fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
    subheading: { fontSize: 14, fontWeight: "700", color: theme.colors.text, marginTop: 4 },
    muted: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 18 },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.lg,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      backgroundColor: theme.colors.background,
    },
    qrWrap: { alignItems: "center", paddingVertical: 8 },
    qr: { width: 200, height: 200, borderRadius: 12, backgroundColor: "#fff" },
    secret: { fontSize: 15, fontWeight: "700", letterSpacing: 1, color: theme.colors.text, textAlign: "center", fontFamily: "monospace" },
    backupBox: { borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 12, gap: 6 },
    codeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    backupCode: { fontSize: 13, fontWeight: "600", color: theme.colors.text, fontFamily: "monospace", width: "30%" },
  });
}
