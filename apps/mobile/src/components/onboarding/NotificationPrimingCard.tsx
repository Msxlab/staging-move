import React from "react";
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { hapticError, hapticLight, hapticSuccess } from "@/lib/haptics";
import {
  getPushSoftPromptDecision,
  registerForPushNotifications,
  setPushSoftPromptDecision,
  unregisterPushNotifications,
} from "@/lib/push";

/**
 * NotificationPrimingCard — the final-step "One last thing" notifications
 * section (design bundle-3, onb-steps.jsx PermissionBody, notifications row
 * only — location is owner-vetoed and deliberately absent).
 *
 * HONEST priming, not a dark pattern:
 *   - The OS permission prompt fires ONLY on an explicit toggle-on. Enabling
 *     here records the soft-prompt decision ("accepted") and then runs the
 *     EXISTING registration path in src/lib/push.ts — same sequence as the
 *     end-of-onboarding alert, so the one-shot OS prompt is never wasted.
 *   - "Maybe later" records "deferred" (only if the user never answered
 *     before) and quiets the card for this session. It never blocks
 *     finishing onboarding — there is no gate anywhere in this component.
 *   - If the OS denies the prompt, we say so plainly and point at device
 *     settings rather than leaving a lying "on" toggle.
 *
 * Because the user lands on a decision either way (accepted / deferred), the
 * legacy completion-time Alert (maybeOfferPushSoftPrompt) sees a non-null
 * decision and stays silent — no double prompt. Users who ignore the card
 * entirely keep the existing alert behaviour, so nothing regresses.
 */

/**
 * "Maybe later" is per-session by design (module-level, not persisted):
 * step remounts within this onboarding run won't resurrect the card, but a
 * fresh app launch may show it again until a real decision exists.
 */
let sessionDismissed = false;

interface NotificationPrimingCardProps {
  style?: StyleProp<ViewStyle>;
}

export function NotificationPrimingCard({ style }: NotificationPrimingCardProps) {
  const theme = useAppTheme();
  const styles = React.useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();

  // null = decision not hydrated yet (render nothing — no wrong-state flash).
  const [hydrated, setHydrated] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [denied, setDenied] = React.useState(false);
  const [hidden, setHidden] = React.useState(sessionDismissed);

  React.useEffect(() => {
    let cancelled = false;
    getPushSoftPromptDecision()
      .then((decision) => {
        if (cancelled) return;
        // "accepted" earlier (e.g. via sign-in or settings) → reflect it; the
        // toggle is a status read here, not a re-prompt.
        setEnabled(decision === "accepted");
        setHydrated(true);
      })
      .catch(() => {
        if (cancelled) return;
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (next: boolean) => {
    if (busy) return;
    hapticLight();
    if (!next) {
      // An "off" toggle must mean off: record the preference AND drop this
      // device's push token (best effort), so no pushes arrive while the row
      // reads disabled. Reversible here or from Settings → Notifications.
      setEnabled(false);
      setDenied(false);
      await setPushSoftPromptDecision("declined").catch(() => {});
      void unregisterPushNotifications();
      return;
    }
    setBusy(true);
    try {
      // Same sequence as the existing onboarding soft prompt: record the
      // explicit opt-in first, then let push.ts fire the one-shot OS prompt
      // and register the token. requireSoftPrompt:false because this toggle
      // IS the soft prompt (mirrors the dashboard card + settings save).
      await setPushSoftPromptDecision("accepted");
      const registered = await registerForPushNotifications({ requireSoftPrompt: false });
      if (registered) {
        setEnabled(true);
        setDenied(false);
        hapticSuccess();
      } else {
        // OS prompt denied (or unsupported device). Don't show a lying "on"
        // state — say where it can actually be turned on.
        setEnabled(false);
        setDenied(true);
        hapticError();
      }
    } catch {
      setEnabled(false);
      setDenied(true);
    } finally {
      setBusy(false);
    }
  };

  const handleLater = async () => {
    hapticLight();
    sessionDismissed = true;
    setHidden(true);
    try {
      // Only write "deferred" when there's no answer yet — never downgrade an
      // earlier explicit accept/decline.
      const decision = await getPushSoftPromptDecision();
      if (decision === null) await setPushSoftPromptDecision("deferred");
    } catch {
      /* best effort */
    }
  };

  if (!hydrated || hidden) return null;

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>
        {t("onboarding.notifPriming_title", { defaultValue: "One last thing" })}
      </Text>
      <Text style={styles.body}>
        {t("onboarding.notifPriming_body", {
          defaultValue:
            "We'll remind you before renewals and deadlines — that's the whole point of tracking them.",
        })}
      </Text>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Bell size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>
            {t("onboarding.notifPriming_rowTitle", { defaultValue: "Notifications" })}
          </Text>
          <Text style={styles.rowDesc}>
            {t("onboarding.notifPriming_rowDesc", {
              defaultValue: "A heads-up before renewals and key move dates.",
            })}
          </Text>
        </View>
        <Switch
          value={enabled}
          disabled={busy}
          onValueChange={(next) => {
            void handleToggle(next);
          }}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor="#fff"
          accessibilityLabel={t("onboarding.notifPriming_toggleA11y", {
            defaultValue: "Enable notifications",
          })}
        />
      </View>
      {denied && (
        <Text style={styles.deniedHint}>
          {t("onboarding.notifPriming_denied", {
            defaultValue:
              "Notifications are turned off for Move in your device settings. You can enable them there any time.",
          })}
        </Text>
      )}
      {!enabled && (
        <TouchableOpacity
          onPress={() => {
            void handleLater();
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.notifPriming_later", { defaultValue: "Maybe later" })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.laterLink}
        >
          <Text style={styles.laterText}>
            {t("onboarding.notifPriming_later", { defaultValue: "Maybe later" })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      width: "100%",
      padding: 14,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
    },
    title: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.colors.text,
      letterSpacing: 0,
    },
    body: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textTertiary,
      marginTop: 4,
    },
    // Permission row (design `.ob-perm-row`): tinted icon square + copy + toggle.
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 12,
      padding: 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      backgroundColor: theme.colors.glass.bg,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.colors.primaryFaded,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.text,
    },
    rowDesc: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textTertiary,
      marginTop: 2,
    },
    deniedHint: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.amber.text,
      marginTop: 8,
    },
    laterLink: {
      alignSelf: "center",
      paddingVertical: 8,
      paddingHorizontal: 6,
      marginTop: 4,
    },
    laterText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textTertiary,
    },
  });
