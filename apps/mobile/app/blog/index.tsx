import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";

/**
 * Mobile Blog list — public content, no auth required.
 *
 * Pulls JSON from `/api/blog/posts` (the same endpoint the web app
 * exposes), caches via `@tanstack/react-query` already wired through
 * `api`, and on tap opens the full post in an in-app browser
 * (expo-web-browser). We don't render the post body natively because
 * (a) the typography would duplicate the web theme and (b) shipping a
 * sanitize-tolerant HTML renderer ties us to one more native dep.
 *
 * The web URL we open is `https://<APP_URL>/blog/<slug>` so the
 * reader gets the same canonical surface that AI crawlers, search
 * engines, and shared social previews already use.
 */

interface BlogListItem {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string;
  ogImageUrl: string | null;
  category: { slug: string; name: string } | null;
}

const BLOG_LIST_CACHE_KEY = "locateflow.blog.list.v1";

export default function BlogListScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith("es") ? "es" : "en";
  const cacheKey = `${BLOG_LIST_CACHE_KEY}.${locale}`;
  const [items, setItems] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = useCallback(() => {
    const canGoBack = typeof (router as any).canGoBack === "function" && (router as any).canGoBack();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace("/(tabs)/more");
  }, [router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      let res = await api.get<{ items: BlogListItem[] }>("/api/blog/posts", {
        pageSize: "20",
        locale,
      });
      if (res.error) throw new Error(res.error);
      let payload = res.data as unknown as { items?: BlogListItem[] } | undefined;
      if ((payload?.items?.length ?? 0) === 0 && locale !== "en") {
        res = await api.get<{ items: BlogListItem[] }>("/api/blog/posts", {
          pageSize: "20",
          locale: "en",
        });
        if (res.error) throw new Error(res.error);
        payload = res.data as unknown as { items?: BlogListItem[] } | undefined;
      }
      const nextItems = payload?.items ?? [];
      setItems(nextItems);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(nextItems)).catch(() => {});
    } catch {
      const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
      if (cached) {
        try {
          setItems(JSON.parse(cached) as BlogListItem[]);
        } catch {
          setError(t("blog.loadPostsFailed"));
        }
      } else {
        setError(t("blog.loadPostsFailed"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, locale, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const openPost = useCallback((slug: string, locale: string) => {
    router.push({ pathname: "/blog/[slug]", params: { slug, locale } });
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error && items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.emptyText}>{t("blog.empty")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={goBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{t("blog.title")}</Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.locale}-${item.slug}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openPost(item.slug, item.locale)}
            activeOpacity={0.7}
          >
            {item.ogImageUrl ? (
              <Image source={{ uri: item.ogImageUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]} />
            )}
            <View style={styles.cardBody}>
              {item.category ? (
                <Text style={styles.category}>{item.category.name.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.excerpt} numberOfLines={2}>
                {item.excerpt}
              </Text>
              <Text style={styles.meta}>
                {new Date(item.publishedAt).toLocaleDateString(i18n.language || undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {t("blog.minRead", { minutes: item.readingMinutes })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
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
  screenTitle: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  listContent: { padding: 16, gap: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  cover: {
    width: "100%",
    aspectRatio: 1200 / 630,
    backgroundColor: theme.colors.elevated,
  },
  coverPlaceholder: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  cardBody: { padding: 16, gap: 6 },
  category: {
    fontSize: 10,
    letterSpacing: 1,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.text,
    lineHeight: 24,
  },
  excerpt: {
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  meta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  errorText: {
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  emptyText: { color: theme.colors.textMuted, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
