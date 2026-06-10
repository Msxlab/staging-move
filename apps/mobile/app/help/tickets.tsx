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
} from "react-native";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Plus, ChevronRight, MessageCircle, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

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

// Built per-render against the active theme so the dot color flips
// when the user changes Appearance.
function makeStatusColor(theme: Theme): Record<string, string> {
  return {
    OPEN: theme.colors.primary,
    IN_PROGRESS: theme.colors.warning,
    WAITING_USER: theme.colors.info,
    CLOSED: theme.colors.textMuted,
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
  const STATUS_COLOR = useMemo(() => makeStatusColor(theme), [theme]);
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("tickets.title")}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Plus size={20} color="#fff" />
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
        {showCreate && (
          <Card variant="default" style={{ marginBottom: 16 }}>
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>{t("tickets.newTitle")}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={18} color={theme.colors.textMuted} />
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
            <Button title={creating ? t("tickets.submitting") : t("tickets.submit")} onPress={handleCreate} disabled={creating} />
          </Card>
        )}

        {error && tickets.length === 0 && !showCreate ? (
          <ErrorState message={error} onRetry={load} />
        ) : tickets.length === 0 && !showCreate ? (
          <Card variant="default" style={{ alignItems: "center", paddingVertical: 40 }}>
            <MessageCircle size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>{t("tickets.emptyTitle")}</Text>
            <Text style={styles.emptySubtitle}>{t("tickets.emptySubtitle")}</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {tickets.map((ticket) => {
              const color = STATUS_COLOR[ticket.status] || theme.colors.textMuted;
              const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
              const lastMsg = messages[0];
              return (
                <TouchableOpacity
                  key={ticket.id}
                  style={styles.ticketRow}
                  onPress={() => router.push({ pathname: "/help/tickets/[id]", params: { id: ticket.id } })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.ticketTop}>
                      <View style={[styles.statusBadge, { borderColor: `${color}40`, backgroundColor: `${color}15` }]}>
                        <Text style={[styles.statusText, { color }]}>{t(`tickets.status_${ticket.status}`, { defaultValue: ticket.status })}</Text>
                      </View>
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
                  <ChevronRight size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  createHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  createTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  fieldLabel: { fontSize: 11, color: theme.colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 14 },
  inputMulti: { height: 90, textAlignVertical: "top" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  categoryChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryFaded },
  categoryChipText: { fontSize: 11, fontWeight: "600", color: theme.colors.textMuted },
  categoryChipTextActive: { color: theme.colors.primary },
  list: { gap: 10 },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  ticketTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700" },
  ticketDate: { fontSize: 11, color: theme.colors.textMuted },
  ticketSubject: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  ticketPreview: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },
});
