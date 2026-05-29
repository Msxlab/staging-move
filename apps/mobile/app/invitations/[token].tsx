import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface InviteDetails {
  workspaceName: string | null;
  invitedEmail: string;
  role: string;
  expiresAt: string;
  requiresSignup: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};

/**
 * Native landing for workspace invite universal links
 * (https://<domain>/invitations/<token>). Mirrors the web accept page: shows
 * who invited you + the role, requires an explicit Join, and is email-matched
 * server-side. Logged-out users are routed to sign-in by the root layout; they
 * can re-open the email link once signed in (the invite stays pending).
 */
export default function InvitationScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const tokenStr = typeof token === "string" ? token : Array.isArray(token) ? token[0] : "";

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<InviteDetails>(`/api/invitations/${tokenStr}`);
    if (res.error || !res.data) {
      setErrorMsg(res.error || t("invite.invalid", "This invitation is no longer valid."));
    } else {
      setInvite(res.data);
    }
    setLoading(false);
  }, [tokenStr, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const accept = async () => {
    setAccepting(true);
    const res = await api.post<{ workspaceId: string; role: string }>(`/api/invitations/${tokenStr}/accept`, {});
    setAccepting(false);
    if (res.error || !res.data) {
      hapticError();
      Alert.alert(t("invite.cantJoin", "Couldn't join"), res.error || t("invite.invalid", "This invitation is no longer valid."));
      return;
    }
    hapticSuccess();
    router.replace("/(tabs)");
  };

  if (loading) return <LoadingScreen />;

  const roleLabel = invite ? ROLE_LABEL[invite.role] ?? invite.role : "";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.center}>
        {!invite ? (
          <View style={styles.card}>
            <Text style={styles.title}>{t("invite.unavailableTitle", "Invitation unavailable")}</Text>
            <Text style={styles.body}>{errorMsg}</Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)")}>
              <Text style={styles.secondaryBtnText}>{t("invite.goHome", "Go home")}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Users size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.title}>
              {t("invite.joinTitle", "Join")} {invite.workspaceName ?? t("invite.aWorkspace", "a workspace")}
            </Text>
            <Text style={styles.body}>
              {t("invite.joinBody", "You've been invited to join as")} {roleLabel}.
            </Text>
            <Text style={styles.note}>
              {t("invite.invitedFor", "Invitation for")} {invite.invitedEmail}
            </Text>
            <View style={styles.consentBox}>
              <Text style={styles.consentText}>
                {t(
                  "invite.consent",
                  "Joining means an owner or admin can start an address-change sync that affects your connected services. You can leave at any time.",
                )}
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={accept} disabled={accepting} activeOpacity={0.85}>
              {accepting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Check size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>
                    {t("invite.join", "Join as")} {roleLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)")} disabled={accepting}>
              <Text style={styles.secondaryBtnText}>{t("invite.maybeLater", "Maybe later")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 24,
      gap: 12,
      alignItems: "center",
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
    body: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 },
    note: { fontSize: 12, color: theme.colors.textTertiary, textAlign: "center" },
    consentBox: {
      backgroundColor: theme.colors.background,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      marginTop: 4,
    },
    consentText: { fontSize: 12, color: theme.colors.textTertiary, lineHeight: 18 },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: 13,
      width: "100%",
      marginTop: 4,
    },
    primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
    secondaryBtn: { paddingVertical: 10, alignItems: "center", width: "100%" },
    secondaryBtnText: { fontSize: 14, color: theme.colors.textTertiary, fontWeight: "600" },
  });
