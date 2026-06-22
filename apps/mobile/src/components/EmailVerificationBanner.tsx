import React, { useState, useMemo } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MailWarning } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Inline pre-flight banner for screens that submit to backend routes guarded
 * by `requireVerifiedUser` (services POST/PATCH, addresses mutate, custom-
 * providers mutate, moving POST, budget POST). Without this, an unverified
 * email-signup user only learns about the gate by submitting and receiving
 * a generic 403 alert. The banner reads the auth store directly — no extra
 * API call — and offers to resend the verification email.
 *
 * Hidden when:
 *   - the user is verified, or
 *   - we have no `user` yet (auth still hydrating).
 */
export function EmailVerificationBanner({ context }: { context?: string }) {
  // theme: hook-injected styles
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified) return null;

  const handleResend = async () => {
    setSending(true);
    const res = await api.post<{ success?: boolean }>("/api/auth/resend-verification", {});
    setSending(false);
    if (res.error) {
      Alert.alert(t("auth.verifyEmail_title"), res.error);
      return;
    }
    Alert.alert(t("auth.verifyEmail_sentTitle"), t("auth.verifyEmail_sentBody", { email: user.email }));
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <MailWarning size={18} color={theme.colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t("auth.verifyEmail_title")}</Text>
        <Text style={styles.body}>
          {context
            ? t("auth.verifyEmail_bodyFor", { context })
            : t("auth.verifyEmail_body")}
        </Text>
        <TouchableOpacity
          style={[styles.cta, sending && { opacity: 0.6 }]}
          onPress={handleResend}
          disabled={sending}
          activeOpacity={0.7}
        >
          <Text style={styles.ctaText}>
            {sending ? t("common.loading") : t("auth.verifyEmail_resend")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    // Move amber 30% - matches `theme.colors.warning` (#E0A85A).
    borderColor: "rgba(224, 168, 90, 0.3)",
    backgroundColor: theme.colors.warningFaded,
    marginBottom: 16,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(224, 168, 90, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  body: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 17 },
  cta: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warning,
  },
  // Aurora navy reads cleanly on the warm amber CTA.
  ctaText: { fontSize: 12, fontWeight: "700", color: "#0A0F18" },
});
