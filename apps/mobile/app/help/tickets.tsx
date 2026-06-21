import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Plus, ChevronRight, MessageCircle, X, Send } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { MoveRaccoon, HeroCard, MoveCard, SectionHeader, Pill } from "@/components/move";

/** Route-level boundary — a render throw shows a graceful retry, not the
 * app-wide "Something went wrong". */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}>
        <ErrorState title={t("help.supportTickets", { defaultValue: "Support" })} onRetry={retry} />
      </View>
    </SafeAreaView>
  );
}

// Built per-render against the active theme so the pill tone flips
// when the user changes Appearance.
function makeStatusTone(): Record<string, "accent" | "warning" | "info" | "muted"> {
  return {
    OPEN: "accent",
    IN_PROGRESS: "warning",
    WAITING_USER: "info",
    CLOSED: "muted",
  };
}

interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: string;
  updatedAt: string;
  messages?: { content?: string; senderType?: string }[];
  _count?: { messages: number };
}

const CATEGORIES = ["GENERAL", "BUG", "BILLING", "ACCOUNT", "FEATURE_REQUEST"];

export default function TicketsScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const STATUS_TONE = useMemo(() => makeStatusTone(), []);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get<any>("/api/tickets");
      if (res.error) {
        setError(res.error);
        return false;
      }
      if (res.data) {
        setTickets(Array.isArray(res.data.tickets) ? res.data.tickets : []);
        setError(null);
      }
      return true;
    } catch {
      setError(t("common.connectionError"));
      return false;
    }
  }, [t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchTickets();
    } finally {
      setLoading(false);
    }
  }, [fetchTickets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTickets();
    } finally {
      setRefreshing(false);
    }
  }, [fetchTickets]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (subject.trim().length < 5) { Alert.alert(t("tickets.errorTitle"), t("tickets.subjectMin")); return; }
    if (message.trim().length < 10) { Alert.alert(t("tickets.errorTitle"), t("tickets.messageMin")); return; }
    setCreating(true);
    try {
      const res = await api.post<any>("/api/tickets", { subject, message, category, platform: "MOBILE" });
      if (!res.error) {
        setShowCreate(false);
        setSubject(""); setMessage(""); setCategory("GENERAL");
        await fetchTickets();
      } else {
        Alert.alert(t("tickets.errorTitle"), res.error || t("tickets.createFailed"));
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingScreen />;
  const dateLocale = (i18n.language || "").toLowerCase().startsWith("es") ? "es-ES" : "en-US";
  const openCount = tickets.filter((ticket) => ticket.status !== "CLOSED").length;
  const waitingCount = tickets.filter((ticket) => ticket.status === "WAITING_USER").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("tickets.title")}</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel={t("tickets.newTitle")}
        >
          <Plus size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MoveRaccoon size={30} mood="calm" />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>SUPPORT DESK</Text>
              <Text style={styles.heroTitle}>{t("tickets.title")}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {showCreate ? t("tickets.newTitle") : t("tickets.emptySubtitle")}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{tickets.length}</Text>
              <Text style={styles.heroStatLabel}>total</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{openCount}</Text>
              <Text style={styles.heroStatLabel}>open</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, waitingCount > 0 && styles.heroStatWarn]}>
                {waitingCount}
              </Text>
              <Text style={styles.heroStatLabel}>waiting</Text>
            </View>
          </View>
        </HeroCard>

        {showCreate && (
          <MoveCard style={{ marginBottom: 16 }} padding={14} radius={theme.radius.xl} accent>
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>{t("tickets.newTitle")}</Text>
              <TouchableOpacity
                onPress={() => setShowCreate(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t("common.close", { defaultValue: "Close" })}
              >
                <X size={16} color={theme.colors.dim} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>{t("tickets.subject")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("tickets.subjectPlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              value={subject}
              onChangeText={setSubject}
              maxLength={255}
            />
            <Text style={styles.fieldLabel}>{t("tickets.category")}</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.categoryChip, category === c && styles.categoryChipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.categoryChipText, category === c && styles.categoryChipTextActive]}>
                    {t(`tickets.category_${c}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>{t("tickets.message")}</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder={t("tickets.messagePlaceholder")}
              placeholderTextColor={theme.colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              maxLength={5000}
            />
            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitBtnGrad}
              >
                {creating ? (
                  <ActivityIndicator color={theme.colors.onAccent} />
                ) : (
                  <>
                    <Send size={16} color={theme.colors.onAccent} />
                    <Text style={styles.submitBtnText}>{t("tickets.submit")}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </MoveCard>
        )}

        {error && tickets.length === 0 && !showCreate ? (
          <ErrorState message={error} onRetry={load} />
        ) : tickets.length === 0 && !showCreate ? (
          <MoveCard style={styles.emptyCard} padding={28} radius={theme.radius.xl}>
            <MoveRaccoon size={56} mood="thinking" />
            <Text style={styles.emptyTitle}>{t("tickets.emptyTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("tickets.emptySubtitle")}</Text>
          </MoveCard>
        ) : (
          <>
            <SectionHeader label={t("tickets.title")} style={styles.sectionHeader} />
            <View style={styles.list}>
              {tickets.map((ticket) => {
                const tone = STATUS_TONE[ticket.status] || "muted";
                const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
                const lastMsg = messages[0];
                return (
                  <MoveCard
                    key={ticket.id}
                    style={styles.ticketCard}
                    padding={14}
                    radius={theme.radius.xl}
                    onPress={() => router.push({ pathname: "/help/tickets/[id]", params: { id: ticket.id } })}
                  >
                    <View style={styles.ticketRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.ticketTop}>
                          <Pill
                            tone={tone}
                            label={t(`tickets.status_${ticket.status}`, { defaultValue: ticket.status })}
                          />
                          <Text style={styles.ticketDate}>{new Date(ticket.updatedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}</Text>
                        </View>
                        <Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject}</Text>
                        {lastMsg && (
                          <Text style={styles.ticketPreview} numberOfLines={1}>
                            {lastMsg.senderType === "ADMIN"
                              ? t("tickets.supportPrefix")
                              : lastMsg.senderType === "USER"
                              ? t("tickets.youPrefix")
                              : t("tickets.systemPrefix")}
                            {lastMsg.content || ""}
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={16} color={theme.colors.faint} />
                    </View>
                  </MoveCard>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  hero: { marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontFamily: fonts.sansBold,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    marginTop: 3,
  },
  heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3 },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    minHeight: 56,
    borderRadius: 15,
    padding: 9,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.text },
  heroStatWarn: { color: theme.colors.warning },
  heroStatLabel: {
    fontSize: 8,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.8,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  createHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  createTitle: { fontSize: 16, fontFamily: fonts.serifBold, color: theme.colors.text },
  closeBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: theme.colors.surface2, alignItems: "center", justifyContent: "center",
  },
  fieldLabel: { fontSize: 11, fontFamily: fonts.sansBold, color: theme.colors.faint, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 11,
    color: theme.colors.text, fontSize: 14, fontFamily: fonts.sans,
  },
  inputMulti: { height: 90, textAlignVertical: "top" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  categoryChipActive: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSoft },
  categoryChipText: { fontSize: 11, fontFamily: fonts.sansSemibold, color: theme.colors.dim },
  categoryChipTextActive: { color: theme.colors.primary },
  submitBtn: { borderRadius: theme.radius.lg, overflow: "hidden", marginTop: 16 },
  submitBtnGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14,
  },
  submitBtnText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.onAccent },
  sectionHeader: { marginBottom: 10, marginLeft: 2 },
  list: { gap: 10 },
  emptyCard: { alignItems: "center" },
  ticketCard: {},
  ticketRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ticketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  ticketDate: { fontSize: 11, fontFamily: fonts.sans, color: theme.colors.dim },
  ticketSubject: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  ticketPreview: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
  emptyTitle: { fontSize: 15, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 14 },
  emptySubtitle: { fontSize: 13, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 4, textAlign: "center" },
});
