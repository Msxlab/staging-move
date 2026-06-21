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
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react-native";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { HeroCard, MoveCard, MoveRaccoon } from "@/components/move";

/**
 * Mobile Blog list - public content, no auth required.
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
  const latestPost = items[0];

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
        <MoveRaccoon mood="alert" size={64} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton} activeOpacity={0.85}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <MoveRaccoon mood="calm" size={64} />
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
        ListHeaderComponent={
          <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <BookOpen size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>READING ROOM</Text>
                <Text style={styles.heroTitle}>{t("blog.title")}</Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {latestPost?.title || t("blog.empty")}
                </Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{items.length}</Text>
                <Text style={styles.heroStatLabel}>posts</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{locale.toUpperCase()}</Text>
                <Text style={styles.heroStatLabel}>locale</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {latestPost ? new Date(latestPost.publishedAt).toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" }) : "--"}
                </Text>
                <Text style={styles.heroStatLabel}>latest</Text>
              </View>
            </View>
          </HeroCard>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <MoveCard
            style={styles.card}
            onPress={() => openPost(item.slug, item.locale)}
            padding={0}
            radius={theme.radius.xl}
          >
            {item.ogImageUrl ? (
              <Image source={{ uri: item.ogImageUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <BookOpen size={24} color={theme.colors.primary} />
              </View>
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
                - {t("blog.minRead", { minutes: item.readingMinutes })}
              </Text>
            </View>
            <View style={styles.cardArrow}>
              <ChevronRight size={16} color={theme.colors.dim} />
            </View>
          </MoveCard>
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 14,
  },
  listContent: { padding: 16, gap: 14 },
  hero: {
    marginBottom: 2,
  },
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
  heroKicker: { fontSize: 10, fontFamily: fonts.sansBold, letterSpacing: 1.4, textTransform: "uppercase", color: theme.colors.primary },
  heroTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, marginTop: 3 },
  heroSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 3 },
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
  heroStatValue: { fontSize: 13, fontFamily: fonts.sansBold, color: theme.colors.text },
  heroStatLabel: {
    fontSize: 9,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    color: theme.colors.faint,
    textTransform: "uppercase",
    marginTop: 3,
  },
  card: {
    overflow: "hidden",
    marginBottom: 0,
  },
  cover: {
    width: "100%",
    aspectRatio: 1200 / 630,
    backgroundColor: theme.colors.elevated,
  },
  coverPlaceholder: {
    backgroundColor: theme.colors.bg2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { padding: 16, gap: 6 },
  category: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: theme.colors.primary,
    fontFamily: fonts.sansBold,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
    lineHeight: 24,
  },
  excerpt: {
    fontSize: 14,
    fontFamily: fonts.sans,
    color: theme.colors.dim,
    lineHeight: 20,
  },
  meta: {
    fontSize: 11,
    fontFamily: fonts.sansMedium,
    color: theme.colors.faint,
    marginTop: 4,
  },
  cardArrow: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: theme.colors.text,
    fontFamily: fonts.sans,
    textAlign: "center",
  },
  emptyText: { color: theme.colors.dim, fontFamily: fonts.sans, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  retryText: { color: theme.colors.primary, fontFamily: fonts.sansBold },
});
