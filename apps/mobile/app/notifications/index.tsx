import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Bell, CheckCheck } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

interface FeedNotification {
  id: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<FeedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    const res = await api.get<any>("/api/notifications/feed");
    if (res.error) {
      setError(res.error);
      return false;
    }
    if (res.data) {
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
      setError(null);
    }
    return true;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchFeed();
    } finally {
      setLoading(false);
    }
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFeed();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFeed]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id: string) => {
    const res = await api.patch(`/api/notifications/feed/${id}`, {});
    if (res.error) {
      Alert.alert("Notifications", res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    const res = await api.patch("/api/notifications/feed?action=read-all", {});
    setMarkingAll(false);
    if (res.error) {
      Alert.alert("Notifications", res.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn} disabled={markingAll}>
            <CheckCheck size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {unreadCount > 0 && (
        <Text style={styles.unreadLabel}>{unreadCount} unread</Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {error && notifications.length === 0 ? (
          <ErrorState message={error} onRetry={load} />
        ) : notifications.length === 0 ? (
          <Card variant="default" style={{ alignItems: "center", paddingVertical: 40 }}>
            <Bell size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>You'll see important updates here</Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {notifications.map((notif) => (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifRow, !notif.read && styles.notifUnread]}
                onPress={() => !notif.read && markRead(notif.id)}
                activeOpacity={0.6}
              >
                <View style={[styles.dot, { backgroundColor: notif.read ? "transparent" : theme.colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.notifTitle, notif.read && styles.notifTitleRead]}>
                    {notif.title}
                  </Text>
                  {notif.body ? <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text> : null}
                  <Text style={styles.notifTime}>
                    {new Date(notif.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  markAllBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.primaryFaded, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  unreadLabel: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, marginBottom: 8 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  list: { gap: 8 },
  notifRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  notifUnread: { borderColor: `${theme.colors.primary}30`, backgroundColor: `${theme.colors.primary}08` },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  notifTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  notifTitleRead: { color: theme.colors.textMuted },
  notifBody: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2, lineHeight: 17 },
  notifTime: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },
});
