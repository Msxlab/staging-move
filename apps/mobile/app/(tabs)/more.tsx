import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  User,
  CreditCard,
  DollarSign,
  Search,
  HelpCircle,
  ChevronRight,
  Shield,
  Bell,
  LogOut,
  Ticket,
  Building2,
  FileText,
  Zap,
  Activity,
  Users,
  Download,
  CalendarClock,
  Sparkles,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";
import { useAuthStore } from "@/lib/auth-store";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { Avatar } from "@/components/ui/Avatar";
import { hapticLight, hapticWarning } from "@/lib/haptics";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { HeroCard, SectionHeader } from "@/components/move";
import { api } from "@/lib/api";
import { unregisterPushNotifications } from "@/lib/push";
import { clearSensitiveLocalState } from "@/lib/local-cleanup";

/** Tonal tile colors for a row's icon chip (Move `.pf-row .ti` idiom). */
interface RowTone {
  bg: string;
  border: string;
  text: string;
}

interface MenuItem {
  icon: any;
  label: string;
  route?: Href;
  tone?: RowTone;
  onPress?: () => void;
}

interface MobileBuildInfo {
  commit?: string | null;
  profile?: string | null;
  builtAt?: string | null;
}

function mobileBuildInfo(): MobileBuildInfo {
  const extra = Constants.expoConfig?.extra as { build?: MobileBuildInfo } | undefined;
  return extra?.build || {};
}

function shortBuildCommit(commit: string | null | undefined) {
  return commit ? commit.slice(0, 8) : null;
}

export default function MoreScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const planTier = useAuthStore((s) => s.planTier);
  const clearSession = useAuthStore((s) => s.clearSession);
  const buildInfo = mobileBuildInfo();
  const buildCommit = shortBuildCommit(buildInfo.commit);
  const buildLabel = [
    buildCommit ? `#${buildCommit}` : null,
    buildInfo.profile || null,
  ].filter(Boolean).join(" - ");

  const initials =
    ((user?.firstName?.[0] || "") + (user?.lastName?.[0] || "")).toUpperCase() ||
    "U";

  // Plan pill label — planTier is FAMILY | PRO | INDIVIDUAL | FREE | FREE_TRIAL
  // | null; FREE* and null (not-yet-resolved entitlement) render as Free, matching the
  // dashboard's resolution default. The pill itself stays on the canonical
  // brand primary.
  const planLabel =
    planTier === "FAMILY"
      ? t("more.planFamily", { defaultValue: "Family" })
      : planTier === "PRO"
        ? t("more.planPro", { defaultValue: "Pro" })
        : planTier === "INDIVIDUAL"
          ? t("more.planIndividual", { defaultValue: "Individual" })
          : t("more.planFree", { defaultValue: "Free" });

  // A paid entitlement (FAMILY | PRO | INDIVIDUAL) drives the active-plan
  // banner copy; FREE* / null fall back to the neutral "manage plan" banner.
  const hasPaidPlan =
    planTier === "FAMILY" || planTier === "PRO" || planTier === "INDIVIDUAL";

  const handleSignOut = () => {
    hapticWarning();
    Alert.alert(t("common.signOut"), t("common.signOut") + "?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.signOut"),
        style: "destructive",
        onPress: async () => {
          await unregisterPushNotifications().catch(() => {});
          await api.post("/api/auth/logout").catch(() => {});
          await clearSession();
          await clearSensitiveLocalState(queryClient);
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  // Tonal tiles per row (Move idiom: every menu row gets an icon chip in a
  // tonal tile). All values come from theme tone objects; brand/action rows use
  // the brand primary instead of legacy plan-specific amber accents.
  const tonePrimary: RowTone = {
    bg: theme.colors.primaryFaded,
    border: theme.colors.primary + "33",
    text: theme.colors.primary,
  };
  const toneCool = theme.colors.sky; // Move info
  const toneSage = theme.colors.emerald; // sage / money
  const toneAction = tonePrimary;
  const toneSlate = theme.colors.sky; // muted slate

  // Regrouped into four task-oriented sections (was a flat 16-row junk drawer).
  // Every row reuses an EXISTING route — no new screens — except "Search" which
  // now points at the real universal search screen instead of misleadingly
  // routing to /providers.
  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: t("more.sectionTools", { defaultValue: "Tools" }),
      items: [
        // Typed-routes generation is stale for the newly-added screen; the file
        // exists at app/search.tsx so the route is valid.
        { icon: Search, label: t("search.title"), route: "/search" as Href, tone: toneCool },
        { icon: DollarSign, label: t("budget.title"), route: "/budget", tone: toneSage },
        { icon: Building2, label: t("providers.title"), route: "/providers", tone: toneAction },
        { icon: Building2, label: t("customProviders.title"), route: "/custom-providers", tone: toneSlate },
        { icon: CalendarClock, label: t("reminders.title", { defaultValue: "Reminders" }), route: "/reminders" as Href, tone: toneCool },
      ],
    },
    {
      title: t("more.sectionAccount", { defaultValue: "Account" }),
      items: [
        { icon: User, label: t("settings.profile"), route: "/settings/profile", tone: tonePrimary },
        { icon: CreditCard, label: t("settings.subscription"), route: "/settings/subscription", tone: toneAction },
        // Workspace + Export were only reachable via a second, redundant
        // "Settings" screen (the confusing "settings inside settings"). Surface
        // them here directly and drop that duplicate menu entry.
        { icon: Users, label: t("settings.workspace", { defaultValue: "Workspace" }), route: "/settings/workspace" as Href, tone: toneSage },
        { icon: Zap, label: t("connections.title", "Connections"), route: "/settings/connections", tone: toneCool },
        // Distinct from the notifications FEED in the Support group below — this
        // is the preferences screen, so label it as settings to avoid two
        // identical "Notifications" rows.
        { icon: Bell, label: t("settings.notificationSettings", { defaultValue: "Notification settings" }), route: "/settings/notifications", tone: toneSlate },
      ],
    },
    {
      title: t("more.sectionPrivacy", { defaultValue: "Privacy & data" }),
      items: [
        { icon: Shield, label: t("settings.privacy"), route: "/settings/privacy", tone: toneCool },
        { icon: Download, label: t("settings.export"), route: "/settings/export", tone: toneSage },
        // Typed-routes generation is stale for this recently-added screen; the
        // file exists at app/settings/address-changes.tsx so the route is valid.
        { icon: Activity, label: t("addressChanges.title", "Address changes"), route: "/settings/address-changes" as Href, tone: toneAction },
      ],
    },
    {
      title: t("more.sectionSupport", { defaultValue: "Support" }),
      items: [
        { icon: HelpCircle, label: t("settings.help"), route: "/help", tone: toneCool },
        { icon: Ticket, label: t("settings.support"), route: "/help/tickets", tone: toneAction },
        // The notifications FEED (distinct from "Notification settings" above).
        { icon: Bell, label: t("settings.notifications"), route: "/notifications", tone: toneSlate },
        { icon: FileText, label: t("blog.title"), route: "/blog", tone: toneSage },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("tabs.more")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card — Move `.sv-profilecard`: avatar disc + name/email +
            mono-uppercase plan pill tinted by the plan accent. */}
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => router.push("/settings/profile")}
          activeOpacity={0.7}
        >
          <Avatar initials={initials} size={50} />
          <View style={styles.profileBody}>
            <Text style={styles.profileName} numberOfLines={1}>
              {user?.firstName || t("common.unknown", { defaultValue: "User" })} {user?.lastName || ""}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email || ""}
            </Text>
            <View style={styles.planPill}>
              <Sparkles size={9} color={theme.colors.primary} />
              <Text style={styles.planPillText}>{planLabel.toUpperCase()}</Text>
            </View>
          </View>
          <ChevronRight size={18} color={theme.colors.textMuted} />
        </TouchableOpacity>

        {/* Plan banner — Move hero gradient. Paid plans surface the active-plan
            line; FREE / null tiers fall back to a neutral "manage plan" prompt.
            Both branches route to the real subscription screen via Manage. */}
        <HeroCard style={styles.planBanner} padding={16} radius={20}>
          <View style={styles.planBannerRow}>
            <View style={styles.planBannerCopy}>
              <View style={styles.planBannerTitleRow}>
                <Sparkles size={11} color={theme.colors.primary} />
                <Text style={styles.planBannerTitle} numberOfLines={1}>
                  {hasPaidPlan
                    ? t("more.planActive", {
                        defaultValue: "LocateFlow {{plan}} active",
                        plan: planLabel,
                      })
                    : t("more.planManageTitle", { defaultValue: "Your plan" })}
                </Text>
              </View>
              <Text style={styles.planBannerSub} numberOfLines={1}>
                {hasPaidPlan
                  ? t("more.planManageSub", {
                      defaultValue: "{{plan}} plan",
                      plan: planLabel,
                    })
                  : planLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.planBannerBtn}
              onPress={() => {
                hapticLight();
                router.push("/settings/subscription");
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.planBannerBtnText}>
                {t("more.manage", { defaultValue: "Manage" })}
              </Text>
            </TouchableOpacity>
          </View>
        </HeroCard>

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <SectionHeader label={section.title} style={styles.sectionHeader} />
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => {
                const Icon = item.icon;
                const tone = item.tone ?? toneCool;
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.menuItem,
                      i < section.items.length - 1 && styles.menuItemBorder,
                    ]}
                    onPress={() => {
                      hapticLight();
                      if (item.onPress) item.onPress();
                      else if (item.route) router.push(item.route);
                    }}
                    activeOpacity={0.6}
                  >
                    <View
                      style={[
                        styles.menuIconBox,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <Icon size={17} color={tone.text} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <ChevronRight size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Appearance — theme + language. The theme toggle was only on the
            now-removed second Settings screen; surfaced here so the More tab is
            the single settings hub. */}
        <View style={styles.section}>
          <SectionHeader
            label={t("more.sectionAppearance", { defaultValue: "Appearance" })}
            style={styles.sectionHeader}
          />
          <View style={styles.appearanceWrap}>
            {/* Theme selector. */}
            <ThemeSelector />
            {/* Language selector — mirrored to User.preferredLocale via
                /api/user/locale so the choice follows the user. */}
            <LanguageSelector />
          </View>
        </View>

        {/* Sign Out — Move row card (red icon + label). */}
        <View style={styles.signOutCard}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.6}
          >
            <LogOut size={18} color={theme.colors.error} />
            <Text style={styles.signOutText}>{t("common.signOut")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>LocateFlow v{Constants.expoConfig?.version ?? "0.0.0"}</Text>
        {buildLabel ? <Text style={styles.buildMeta}>{buildLabel}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  title: {
    fontSize: 26,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 15,
    marginBottom: 14,
  },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: {
    fontSize: 16,
    fontFamily: fonts.sansSemibold,
    color: theme.colors.text,
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    marginTop: 2,
    marginBottom: 6,
  },
  planPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  planPillText: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 1,
    color: theme.colors.primary,
  },
  planBanner: {
    marginBottom: 22,
  },
  planBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  planBannerCopy: { flex: 1, minWidth: 0 },
  planBannerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  planBannerTitle: {
    fontSize: 11,
    fontFamily: fonts.sansBold,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: theme.colors.primary,
    flexShrink: 1,
  },
  planBannerSub: {
    fontSize: 12,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
  },
  planBannerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    flexShrink: 0,
  },
  planBannerBtnText: {
    fontSize: 11,
    fontFamily: fonts.sansSemibold,
    color: theme.colors.primary,
  },
  section: { marginBottom: 20 },
  sectionHeader: { marginBottom: 9, marginLeft: 2 },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.sansMedium,
    color: theme.colors.text,
  },
  appearanceWrap: {
    gap: 12,
  },
  signOutCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    marginTop: 4,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: fonts.sansMedium,
    color: theme.colors.error,
  },
  version: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    marginTop: 22,
  },
  buildMeta: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: fonts.sans,
    color: theme.colors.faint,
    marginTop: 4,
  },
});
