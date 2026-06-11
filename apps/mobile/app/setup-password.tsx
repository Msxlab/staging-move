import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MailCheck, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAuthStore } from "@/lib/auth-store";
import { useAppTheme, type Theme } from "@/lib/theme";
import { getPasswordLinkAction } from "@/lib/password-management";

export default function SetupPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const user = useAuthStore((s) => s.user);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const sendSetupLink = async () => {
    setError("");
    setSending(true);
    try {
      // OAuth-only accounts set a password through a single-use email link,
      // never with a session-only password write. See SCOPE W-01/M-01.
      const linkAction = getPasswordLinkAction({
        hasPasswordLogin: false,
        email: user?.email ?? "",
      });
      const res = await api.post<any>(linkAction.endpoint, linkAction.body);

      if (res.error) {
        setError(res.error || t("auth.setupPasswordFailed"));
        hapticError();
        return;
      }

      setSent(true);
      hapticSuccess();
    } catch {
      setError(t("auth.setupPasswordFailed"));
      hapticError();
    } finally {
      setSending(false);
    }
  };

  const continueWithout = () => {
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LogoBrand />
          <View style={styles.iconWrap}>
            {sent ? (
              <MailCheck size={26} color={theme.colors.success} />
            ) : (
              <ShieldCheck size={26} color={theme.colors.success} />
            )}
          </View>
          <Text style={styles.title}>
            {sent ? t("auth.setupPasswordSentTitle") : t("auth.setupPasswordTitle")}
          </Text>
          <Text style={styles.subtitle}>
            {sent ? t("auth.setupPasswordSentBody") : t("auth.setupPasswordSubtitle")}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={
              sending
                ? t("common.loading")
                : sent
                ? t("auth.setupPasswordResend")
                : t("auth.setupPasswordCta")
            }
            onPress={sendSetupLink}
            loading={sending}
            disabled={sending}
            fullWidth
            style={{ marginTop: 8 }}
          />
          <Button
            title={t("auth.setupPasswordSkip")}
            onPress={continueWithout}
            variant="secondary"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: theme.colors.successFaded,
    borderWidth: 1,
    borderColor: "rgba(135, 221, 192, 0.28)",
    marginTop: 18,
  },
  title: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginBottom: 12,
  },
  error: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: "rgba(240, 140, 142, 0.28)",
    borderRadius: theme.radius.lg,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
  },
});
