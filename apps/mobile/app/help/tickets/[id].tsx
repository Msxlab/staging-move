import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send, Lock, MessageCircle } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

/** Route-level boundary - a render throw shows a graceful retry, not the
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

interface Message {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}
interface Ticket {
  id: string;
  subject: string;
  status: string;
  category: string;
  createdAt: string;
  messages: Message[];
}

export default function TicketDetailScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fetchTicket = useCallback(async () => {
    if (!id) {
      setError(t("tickets.notFound"));
      return false;
    }
    try {
      const res = await api.get<any>(`/api/tickets/${id}`);
      if (res.error) {
        setError(res.error);
        return false;
      }
      if (res.data?.ticket) {
        const nextTicket = res.data.ticket as Ticket;
        setTicket({
          ...nextTicket,
          messages: Array.isArray(nextTicket.messages) ? nextTicket.messages : [],
        });
        setError(null);
      }
      return true;
    } catch {
      setError(t("common.connectionError"));
      return false;
    }
  }, [id, t]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchTicket();
    } finally {
      setLoading(false);
    }
  }, [fetchTicket]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchTicket();
    } finally {
      setRefreshing(false);
    }
  }, [fetchTicket]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async () => {
    if (!reply.trim() || !id) return;
    setSending(true);
    try {
      const res = await api.post<any>(`/api/tickets/${id}`, { message: reply });
      if (!res.error) {
        hapticSuccess();
        setReply("");
        await fetchTicket();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      } else {
        hapticError();
        Alert.alert(t("tickets.errorTitle"), res.error || t("tickets.sendFailed"));
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!id) return;
    Alert.alert(t("tickets.closeTitle"), t("tickets.closeConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("tickets.close"),
        style: "destructive",
        onPress: async () => {
          const res = await api.patch<any>(`/api/tickets/${id}`, {});
          if (!res.error) {
            hapticSuccess();
            await fetchTicket();
          } else {
            hapticError();
            Alert.alert(t("tickets.errorTitle"), t("tickets.closeFailed"));
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  const dateLocale = (i18n.language || "").toLowerCase().startsWith("es") ? "es-ES" : "en-US";
  if (!ticket) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("tickets.singleTitle")}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ErrorState
          title={error ? t("tickets.unavailable") : t("tickets.notFound")}
          message={error || t("tickets.removed")}
          onRetry={load}
        />
      </SafeAreaView>
    );
  }

  const isClosed = ticket.status === "CLOSED";
  const statusLabel = t(`tickets.status_${ticket.status}`, { defaultValue: ticket.status.replace("_", " ") });
  const categoryLabel = t(`tickets.category_${ticket.category}`, { defaultValue: ticket.category });
  const lastMessage = ticket.messages[ticket.messages.length - 1];
  const lastMessageDate = lastMessage?.createdAt || ticket.createdAt;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{ticket.subject}</Text>
        {!isClosed ? (
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Lock size={16} color={theme.colors.error} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <MessageCircle size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>SUPPORT THREAD</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{ticket.subject}</Text>
              <Text style={styles.heroSub} numberOfLines={1}>{categoryLabel}</Text>
            </View>
            <View style={[styles.statusPill, isClosed ? styles.statusPillClosed : styles.statusPillOpen]}>
              <Text style={[styles.statusPillText, isClosed ? styles.statusTextClosed : styles.statusTextOpen]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{ticket.messages.length}</Text>
              <Text style={styles.heroStatLabel}>messages</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {new Date(ticket.createdAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
              </Text>
              <Text style={styles.heroStatLabel}>created</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {new Date(lastMessageDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
              </Text>
              <Text style={styles.heroStatLabel}>latest</Text>
            </View>
          </View>
        </View>

        {ticket.messages.map((msg) => {
          const isUser = msg.senderType === "USER";
          const isSystem = msg.senderType === "SYSTEM";
          return (
            <View key={msg.id} style={[styles.msgBubble, isUser ? styles.msgUser : isSystem ? styles.msgSystem : styles.msgSupport]}>
              <Text style={styles.msgSender}>
                {isUser ? t("tickets.youSender") : isSystem ? t("tickets.systemSender") : t("tickets.supportSender")}
              </Text>
              <Text style={[styles.msgText, isSystem && styles.msgTextSystem]}>{msg.content}</Text>
              <Text style={styles.msgTime}>{new Date(msg.createdAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</Text>
            </View>
          );
        })}
      </ScrollView>

      {isClosed ? (
        <View style={styles.closedBanner}>
          <Text style={styles.closedText}>{t("tickets.closed")}</Text>
        </View>
      ) : (
        <View style={styles.replyBar}>
          <TextInput
            style={styles.replyInput}
            placeholder={t("tickets.replyPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            value={reply}
            onChangeText={setReply}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!reply.trim() || sending) && { opacity: 0.4 }]}
            onPress={handleReply}
            disabled={!reply.trim() || sending}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  closeBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.errorFaded, borderWidth: 1, borderColor: "rgba(240, 140, 142, 0.20)", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: theme.colors.text, marginHorizontal: 8 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  hero: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: theme.colors.glass.bg,
    borderWidth: 1,
    borderColor: theme.colors.glass.highlight,
    ...theme.shadow.sm,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: theme.colors.primary + "33",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: { flex: 1, minWidth: 0 },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    color: theme.colors.accent,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.text,
    marginTop: 3,
    letterSpacing: 0,
    lineHeight: 25,
  },
  heroSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 3 },
  statusPill: {
    maxWidth: 92,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusPillOpen: {
    backgroundColor: theme.colors.emerald.bg,
    borderColor: theme.colors.emerald.border,
  },
  statusPillClosed: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    textAlign: "center",
  },
  statusTextOpen: { color: theme.colors.emerald.text },
  statusTextClosed: { color: theme.colors.textMuted },
  heroStats: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroStat: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    padding: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "center",
  },
  heroStatValue: { fontSize: 13, fontWeight: "800", color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0,
    color: theme.colors.textTertiary,
    textTransform: "uppercase",
    marginTop: 3,
  },
  msgBubble: { borderRadius: 18, padding: 13, maxWidth: "88%" },
  msgUser: { alignSelf: "flex-end", backgroundColor: theme.colors.primary + "20", borderColor: theme.colors.primary + "35", borderWidth: 1, ...theme.shadow.sm },
  msgSupport: { alignSelf: "flex-start", backgroundColor: theme.colors.glass.bg, borderColor: theme.colors.glass.highlight, borderWidth: 1, ...theme.shadow.sm },
  msgSystem: { alignSelf: "center", backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, opacity: 0.75 },
  msgSender: { fontSize: 10, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 4 },
  msgText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  msgTextSystem: { fontSize: 12, color: theme.colors.textTertiary, fontStyle: "italic" },
  msgTime: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4, textAlign: "right" },
  closedBanner: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border, alignItems: "center", backgroundColor: theme.colors.glass.bg },
  closedText: { fontSize: 13, color: theme.colors.textMuted },
  replyBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.glass.bg },
  replyInput: { flex: 1, maxHeight: 100, backgroundColor: theme.colors.card, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 10, color: theme.colors.text, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 15, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center", ...theme.shadow.glow },
});
