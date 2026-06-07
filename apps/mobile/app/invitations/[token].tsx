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
import { acceptInvite, setPendingInviteToken, type InviteErrorCode } from "@/lib/workspace-invite";

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
  const [joined, setJoined] = useState(false);

  // Map the accept endpoint's error codes to friendly copy (mirrors
  // app/workspace/accept-invite.tsx). Defaults sensibly in English.
  const errorCopy = useCallback(
    (code: InviteErrorCode, detail: string | null): string => {
      switch (code) {
        case "EXPIRED":
          return t("invite.errorExpired", "This invitation has expired or is no longer valid. Ask the workspace owner to send a new one.");
        case "SEAT_FULL":
          return t("invite.errorSeatFull", "This workspace is full. Ask the owner to free up a seat, then try again.");
        case "ALREADY_MEMBER":
          return t("invite.errorAlreadyMember", "You're already a member of this workspace.");
        case "WRONG_EMAIL":
          return t("invite.errorWrongEmail", "This invitation was sent to a different email address. Sign in with the invited account to accept it.");
        case "UNAUTHORIZED":
          return t("invite.errorUnauthorized", "Please sign in to accept this invitation.");
        case "INVALID_TOKEN":
          return t("invite.errorInvalidToken", "That doesn't look like a valid invite link. Paste the full link from your invitation email.");
        default:
          return detail || t("invite.errorUnknown", "Something went wrong. Check your connection and try again.");
      }
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Stash the token so invite context survives even if the session ends before
    // the user taps Join (e.g. they need to switch accounts, or get bounced to
    // sign-in). It's consumed + cleared on the next successful auth. Harmless for
    // an already-signed-in user who Joins right here.
    void setPendingInviteToken(tokenStr).catch(() => {});
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
    // Route through the shared helper so this deep-link path ALSO refreshes the
    // plan entitlement (planTier) on success — that's what makes the new
    // Family/Pro theme + mascots apply immediately after joining.
    const res = await acceptInvite(tokenStr);
    setAccepting(false);
    if (!res.ok) {
      hapticError();
      Alert.alert(t("invite.cantJoin", "Couldn't join"), errorCopy(res.code, res.message));
      return;
    }
    // Joined here directly — clear the stashed token so it isn't re-consumed on a
    // later sign-in (the accept endpoint would just no-op with ALREADY_MEMBER,
    // but clearing keeps the handoff state tidy).
    void setPendingInviteToken(null).catch(() => {});
    hapticSuccess();
    setJoined(true);
  };

  if (loading) return <LoadingScreen />;

  if (joined) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Check size={28} color={theme.colors.success} />
            </View>
            <Text style={styles.title}>
              {t("invite.successTitle", "You're in!")}
            </Text>
            <Text style={styles.body}>
              {invite?.workspaceName
                ? `${t("invite.successJoined", "You've joined")} ${invite.workspaceName}. ${t("invite.successPlanActive", "Your shared plan is now active.")}`
                : t("invite.successBody", "You've joined the workspace. Your shared plan is now active.")}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(tabs)")} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t("invite.goToDashboard", "Go to dashboard")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
