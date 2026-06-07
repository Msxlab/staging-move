import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Users, Check, ClipboardPaste } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import { useAppTheme, type Theme } from "@/lib/theme";
import {
  acceptInvite,
  extractInviteToken,
  type AcceptInviteSuccess,
  type InviteErrorCode,
} from "@/lib/workspace-invite";
import { hapticSuccess, hapticError } from "@/lib/haptics";

/**
 * Manual workspace-invite-accept screen.
 *
 * Reachable two ways:
 *   1. Manually from Settings → Workspace ("Have an invite?"). The user pastes the
 *      invite link (or bare code) from their email and taps Join. This is the
 *      robust fallback when the universal link did NOT open the app directly.
 *   2. With a `?token=` (or `?code=`) query param — used as a soft deep-link target.
 *      The canonical universal-link deep link still lands on app/invitations/[token].tsx;
 *      this screen accepts a prefilled token too so a `locateflow://workspace/accept-invite?token=…`
 *      style link works without extra native config.
 *
 * Both call the same accept endpoint the web uses and refresh the plan entitlement
 * (planTier) on success so the new Family/Pro theme applies immediately.
 */
export default function AcceptInviteScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();

  // Accept a token prefilled via query param (?token=… or ?code=…) for soft deep links.
  const params = useLocalSearchParams<{ token?: string; code?: string }>();
  const prefill = useMemo(() => {
    const raw = (typeof params.token === "string" && params.token) || (typeof params.code === "string" && params.code) || "";
    return raw || "";
  }, [params.token, params.code]);

  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<InviteErrorCode | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [success, setSuccess] = useState<AcceptInviteSuccess | null>(null);

  const parsedToken = extractInviteToken(input);
  const canSubmit = !!parsedToken && !submitting;

  const submit = useCallback(
    async (raw: string) => {
      const token = extractInviteToken(raw);
      if (!token) {
        setErrorCode("INVALID_TOKEN");
        setErrorDetail(null);
        return;
      }
      setSubmitting(true);
      setErrorCode(null);
      setErrorDetail(null);
      const res = await acceptInvite(token);
      setSubmitting(false);
      if (!res.ok) {
        hapticError();
        setErrorCode(res.code);
        setErrorDetail(res.message);
        return;
      }
      hapticSuccess();
      setSuccess(res);
    },
    [],
  );

  // If we arrived with a prefilled token, drop it into the field and auto-submit once.
  useEffect(() => {
    if (prefill) {
      setInput(prefill);
      void submit(prefill);
    }
    // Run once on mount for the initial prefill; manual edits don't re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setInput(text);
    } catch {
      /* clipboard unavailable — user can type manually */
    }
  }, []);

  const goToDashboard = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  const errorMessage = useCallback(
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
        case "UNKNOWN":
        default:
          return detail || t("invite.errorUnknown", "Something went wrong. Check your connection and try again.");
      }
    },
    [t],
  );

  // --- Success state --------------------------------------------------------
  if (success) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.success + "22" }]}>
              <Check size={28} color={theme.colors.success} />
            </View>
            <Text style={styles.title}>
              {t("invite.successTitle", "You're in!")}
            </Text>
            <Text style={styles.body}>
              {t("invite.successBody", "You've joined the workspace. Your shared plan is now active.")}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={goToDashboard} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>{t("invite.goToDashboard", "Go to dashboard")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Form / loading / error state ----------------------------------------
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("invite.joinWorkspaceTitle", "Join a workspace")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrapLarge}>
          <Users size={28} color={theme.colors.primary} />
        </View>
        <Text style={styles.lede}>
          {t(
            "invite.pasteLede",
            "Got an invite email? Paste the invite link (or code) below to join your household or team workspace.",
          )}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t("invite.pasteLabel", "Invite link or code")}</Text>
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              if (errorCode) setErrorCode(null);
            }}
            placeholder="https://locateflow.com/invitations/wsi_…"
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={styles.input}
            editable={!submitting}
          />
          <TouchableOpacity style={styles.pasteBtn} onPress={pasteFromClipboard} disabled={submitting}>
            <ClipboardPaste size={16} color={theme.colors.primary} />
            <Text style={styles.pasteBtnText}>{t("invite.paste", "Paste from clipboard")}</Text>
          </TouchableOpacity>

          {errorCode && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage(errorCode, errorDetail)}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]}
            onPress={() => submit(input)}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Check size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>{t("invite.joinCta", "Join workspace")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          {t(
            "invite.pasteHint",
            "Tip: tapping the link in your invitation email opens this screen automatically. You must be signed in with the invited email address.",
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
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
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 40, alignItems: "stretch" },
    center: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapLarge: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 16,
    },
    lede: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 20,
      gap: 12,
      alignItems: "stretch",
    },
    label: { fontSize: 12, fontWeight: "600", color: theme.colors.textTertiary, letterSpacing: 0.4 },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.colors.text,
      minHeight: 64,
      textAlignVertical: "top",
    },
    pasteBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
    pasteBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.primary },
    errorBox: {
      backgroundColor: theme.colors.error + "14",
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.error + "44",
      padding: 12,
    },
    errorText: { fontSize: 13, color: theme.colors.error, lineHeight: 19 },
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
    title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
    body: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 },
    hint: {
      fontSize: 12,
      color: theme.colors.textTertiary,
      lineHeight: 18,
      textAlign: "center",
      marginTop: 16,
      paddingHorizontal: 8,
    },
  });
