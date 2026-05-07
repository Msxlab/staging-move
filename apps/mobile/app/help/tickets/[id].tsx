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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

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
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const fetchTicket = useCallback(async () => {
    const res = await api.get<any>(`/api/tickets/${id}`);
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setTicket(res.data.ticket);
      setError(null);
    }
    return true;
  }, [id]);

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
    if (!reply.trim()) return;
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
        <View style={styles.ticketMeta}>
          <Text style={styles.metaText}>
            {t(`tickets.status_${ticket.status}`, { defaultValue: ticket.status.replace("_", " ") })} · {t(`tickets.category_${ticket.category}`, { defaultValue: ticket.category })}
          </Text>
          <Text style={styles.metaText}>{new Date(ticket.createdAt).toLocaleDateString(dateLocale, { month: "long", day: "numeric" })}</Text>
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
  ticketMeta: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  metaText: { fontSize: 11, color: theme.colors.textMuted },
  msgBubble: { borderRadius: 14, padding: 12, maxWidth: "85%" },
  msgUser: { alignSelf: "flex-end", backgroundColor: theme.colors.primary + "20", borderColor: theme.colors.primary + "30", borderWidth: 1 },
  msgSupport: { alignSelf: "flex-start", backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1 },
  msgSystem: { alignSelf: "center", backgroundColor: "rgba(255,255,255,0.03)", borderColor: theme.colors.border, borderWidth: 1, opacity: 0.7 },
  msgSender: { fontSize: 10, fontWeight: "700", color: theme.colors.textMuted, marginBottom: 4 },
  msgText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  msgTextSystem: { fontSize: 12, color: theme.colors.textTertiary, fontStyle: "italic" },
  msgTime: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4, textAlign: "right" },
  closedBanner: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: theme.colors.border, alignItems: "center" },
  closedText: { fontSize: 13, color: theme.colors.textMuted },
  replyBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  replyInput: { flex: 1, maxHeight: 100, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 10, color: theme.colors.text, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center" },
});
