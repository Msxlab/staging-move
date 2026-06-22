import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Users, Check, Clock, Mail } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { HeroCard, MoveCard, SectionHeader, Pill, MoveRaccoon } from "@/components/move";
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
    // plan entitlement (planTier) on success - that's what makes plan-aware
    // labels/gates apply immediately after joining.
    const res = await acceptInvite(tokenStr);
    setAccepting(false);
    if (!res.ok) {
      hapticError();
      Alert.alert(t("invite.cantJoin", "Couldn't join"), errorCopy(res.code, res.message));
      return;
    }
    // Joined here directly - clear the stashed token so it isn't re-consumed on a
    // later sign-in (the accept endpoint would just no-op with ALREADY_MEMBER,
    // but clearing keeps the handoff state tidy).
    void setPendingInviteToken(null).catch(() => {});
    hapticSuccess();
    setJoined(true);
  };

  if (loading) return <LoadingScreen />;

  // --- Joined / success state ----------------------------------------------
  if (joined) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <HeroCard radius={26} padding={24} style={styles.heroWrap}>
            <View style={styles.heroCenter}>
              <MoveRaccoon size={84} mood="approved" />
              <Text style={styles.kicker}>{t("invite.workspaceAccess", "Workspace access")}</Text>
              <Text style={styles.heroTitle}>{t("invite.successTitle", "You're in!")}</Text>
              <Text style={styles.heroBody}>
                {invite?.workspaceName
                  ? `${t("invite.successJoined", "You've joined")} ${invite.workspaceName}. ${t("invite.successPlanActive", "Your shared plan is now active.")}`
                  : t("invite.successBody", "You've joined the workspace. Your shared plan is now active.")}
              </Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace("/(tabs)")}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={theme.colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtnFill}
                >
                  <Text style={styles.primaryBtnText}>{t("invite.goToDashboard", "Go to dashboard")}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </HeroCard>
        </View>
      </SafeAreaView>
    );
  }

  const roleLabel = invite ? ROLE_LABEL[invite.role] ?? invite.role : "";
  const expiresLabel = invite
    ? new Date(invite.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.center}>
        {!invite ? (
          // --- Error / unavailable state ---------------------------------
          <HeroCard radius={26} padding={24} style={styles.heroWrap} glow={false}>
            <View style={styles.heroCenter}>
              <MoveRaccoon size={84} mood="alert" />
              <Text style={styles.kicker}>{t("invite.inviteLink", "Invite link")}</Text>
              <Text style={styles.heroTitle}>{t("invite.unavailableTitle", "Invitation unavailable")}</Text>
              <Text style={styles.heroBody}>{errorMsg}</Text>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace("/(tabs)")}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>{t("invite.goHome", "Go home")}</Text>
              </TouchableOpacity>
            </View>
          </HeroCard>
        ) : (
          // --- Invite-accept state ---------------------------------------
          <View style={styles.stack}>
            <HeroCard radius={26} padding={22} style={styles.heroWrap}>
              <View style={styles.heroTop}>
                <View style={styles.iconWrap}>
                  <Users size={22} color={theme.colors.primary} />
                </View>
                <Pill label={roleLabel} tone="accent" />
              </View>
              <Text style={styles.kickerLeft}>{t("invite.workspaceInvite", "Workspace invite")}</Text>
              <Text style={styles.heroTitleLeft}>
                {t("invite.joinTitle", "Join")} {invite.workspaceName ?? t("invite.aWorkspace", "a workspace")}
              </Text>
              <Text style={styles.heroBodyLeft}>
                {t("invite.joinBody", "You've been invited to join as")} {roleLabel}.
              </Text>
            </HeroCard>

            <View>
              <SectionHeader label={t("invite.detailsLabel", "Invitation")} style={styles.sectionGap} />
              <MoveCard padding={14} radius={18}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Mail size={16} color={theme.colors.dim} />
                  </View>
                  <View style={styles.detailText}>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {invite.invitedEmail}
                    </Text>
                    <Text style={styles.detailLabel}>{t("invite.invitedFor", "Invitation for")}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Clock size={16} color={theme.colors.dim} />
                  </View>
                  <View style={styles.detailText}>
                    <Text style={styles.detailValue}>{expiresLabel}</Text>
                    <Text style={styles.detailLabel}>{t("invite.expiresLabel", "Expires")}</Text>
                  </View>
                  <Pill label={roleLabel} tone="muted" />
                </View>
              </MoveCard>
            </View>

            <MoveCard padding={14} radius={18} accent>
              <Text style={styles.consentText}>
                {t(
                  "invite.consent",
                  "Joining means an owner or admin can start an address-change sync that affects your connected services. You can leave at any time.",
                )}
              </Text>
            </MoveCard>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={accept}
                disabled={accepting}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={theme.colors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtnFill}
                >
                  {accepting ? (
                    <ActivityIndicator size="small" color={theme.colors.onAccent} />
                  ) : (
                    <>
                      <Check size={16} color={theme.colors.onAccent} />
                      <Text style={styles.primaryBtnText}>
                        {t("invite.join", "Join as")} {roleLabel}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.replace("/(tabs)")}
                disabled={accepting}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryBtnText}>{t("invite.maybeLater", "Maybe later")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { flex: 1, justifyContent: "center", paddingHorizontal: 22 },
    stack: { gap: 14 },

    // Hero (gradient premium card)
    heroWrap: { width: "100%" },
    heroCenter: { alignItems: "center", gap: 10 },
    heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.primaryFaded,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
    },

    kicker: {
      fontSize: 10,
      fontFamily: fonts.sansBold,
      letterSpacing: 1.4,
      color: theme.colors.primary,
      textTransform: "uppercase",
      textAlign: "center",
      marginTop: 4,
    },
    kickerLeft: {
      fontSize: 10,
      fontFamily: fonts.sansBold,
      letterSpacing: 1.4,
      color: theme.colors.primary,
      textTransform: "uppercase",
    },
    heroTitle: { fontSize: 26, fontFamily: fonts.serifBold, color: theme.colors.text, textAlign: "center" },
    heroTitleLeft: { fontSize: 24, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 4 },
    heroBody: { fontSize: 14, fontFamily: fonts.sans, color: theme.colors.dim, textAlign: "center", lineHeight: 20 },
    heroBodyLeft: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, lineHeight: 19, marginTop: 6 },

    // Section
    sectionGap: { marginBottom: 10 },

    // Detail rows (member-row pattern from the design)
    detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    detailIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.surface2,
      alignItems: "center",
      justifyContent: "center",
    },
    detailText: { flex: 1, minWidth: 0 },
    detailValue: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
    detailLabel: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },

    consentText: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, lineHeight: 18 },

    // Actions
    actions: { gap: 6 },
    primaryBtn: { borderRadius: 16, overflow: "hidden", width: "100%", marginTop: 6, ...theme.shadow.glow },
    primaryBtnFill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
    },
    primaryBtnText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
    secondaryBtn: { paddingVertical: 12, alignItems: "center", width: "100%" },
    secondaryBtnText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  });
