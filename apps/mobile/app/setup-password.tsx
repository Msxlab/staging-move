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
import { MailCheck, ShieldCheck, ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { MoveRaccoon, HeroCard, Pill } from "@/components/move";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useAuthStore } from "@/lib/auth-store";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
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
          <View style={styles.hero}>
            <View style={styles.brandBadge}>
              <MoveRaccoon size={62} mood={sent ? "happy" : "calm"} />
            </View>
          </View>

          <HeroCard style={styles.heroCard}>
            <View style={styles.iconRow}>
              <View style={styles.iconWrap}>
                {sent ? (
                  <MailCheck size={22} color={theme.colors.success} />
                ) : (
                  <ShieldCheck size={22} color={theme.colors.primary} />
                )}
              </View>
              <Pill label={t("auth.setupPasswordKicker", "Account security")} tone={sent ? "success" : "accent"} />
            </View>

            <Text style={styles.title}>
              {sent ? t("auth.setupPasswordSentTitle") : t("auth.setupPasswordTitle")}
            </Text>
            <Text style={styles.subtitle}>
              {sent ? t("auth.setupPasswordSentBody") : t("auth.setupPasswordSubtitle")}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              variant="gradient"
              fullWidth
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
              rightIcon={<ArrowRight size={16} color={theme.colors.onAccent} />}
              style={styles.cta}
            />
            <Button
              title={t("auth.setupPasswordSkip")}
              onPress={continueWithout}
              variant="ghost"
              fullWidth
              style={styles.skip}
            />
          </HeroCard>
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
  },
  hero: {
    alignItems: "center",
    marginBottom: 22,
  },
  brandBadge: {
    width: 78,
    height: 78,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    ...theme.shadow.sm,
  },
  heroCard: {},
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 24,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  error: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    borderRadius: theme.radius.lg,
    padding: 12,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.sans,
    marginTop: 16,
  },
  cta: { marginTop: 18 },
  skip: { marginTop: 8 },
});
