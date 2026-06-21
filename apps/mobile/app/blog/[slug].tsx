import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react-native";
import { api, APP_WEB_URL } from "@/lib/api";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { HeroCard, MoveCard, Pill } from "@/components/move";

interface BlogPostDetail {
  slug: string;
  locale: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  readingMinutes: number;
  publishedAt: string;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  category: { slug: string; name: string } | null;
  author: { name: string };
}

const WEB_URL = APP_WEB_URL;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'");
}

function htmlToReadableText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|h2|h3|h4|li|blockquote)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export default function BlogDetailScreen() {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const slug = firstParam(params.slug);
  const locale = firstParam(params.locale) === "es" ? "es" : "en";
  const cacheKey = useMemo(() => `locateflow.blog.detail.${locale}.${slug}`, [locale, slug]);
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<BlogPostDetail>(`/api/blog/posts/${encodeURIComponent(slug)}`, {
        locale,
      });
      if (res.error) throw new Error(res.error);
      if (!res.data) throw new Error("Post not found");
      setPost(res.data);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(res.data)).catch(() => {});
      void api.post("/api/blog/view", { slug, locale }).catch(() => {});
    } catch {
      const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
      if (cached) {
        try {
          setPost(JSON.parse(cached) as BlogPostDetail);
        } catch {
          setError(t("blog.loadPostFailed"));
        }
      } else {
        setError(t("blog.loadPostFailed"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, locale, slug, t]);

  useEffect(() => {
    if (slug) void load();
  }, [load, slug]);

  const openWeb = useCallback(async () => {
    if (!post) return;
    const localeQuery = post.locale === "es" ? "?locale=es" : "";
    await WebBrowser.openBrowserAsync(`${WEB_URL.replace(/\/+$/, "")}/blog/${post.slug}${localeQuery}`, {
      toolbarColor: theme.colors.background,
      controlsColor: theme.colors.primary,
      showTitle: true,
    }).catch(() => {});
  }, [post]);

  const goBack = useCallback(() => {
    const canGoBack = typeof (router as any).canGoBack === "function" && (router as any).canGoBack();
    if (canGoBack) {
      router.back();
      return;
    }
    router.replace("/blog");
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.center} edges={["bottom"]}>
        <Text style={styles.errorText}>{error || t("blog.postNotFound")}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton} activeOpacity={0.85}>
          <Text style={styles.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const body = htmlToReadableText(post.contentHtml);

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
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={theme.colors.primary}
          />
        }
      >
        {post.ogImageUrl ? (
          <Image source={{ uri: post.ogImageUrl }} style={styles.cover} accessibilityLabel={post.ogImageAlt || post.title} />
        ) : null}
        <HeroCard style={styles.hero} padding={16} radius={theme.radius.xl}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <BookOpen size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>READING ROOM</Text>
              {post.category ? <Pill label={post.category.name.toUpperCase()} tone="accent" style={styles.categoryPill} /> : null}
            </View>
          </View>
          <Text style={styles.title}>{post.title}</Text>
          <Text style={styles.excerpt}>{post.excerpt}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{post.readingMinutes}</Text>
              <Text style={styles.heroStatLabel}>min read</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue} numberOfLines={1}>{post.author?.name || "Move"}</Text>
              <Text style={styles.heroStatLabel}>author</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {new Date(post.publishedAt).toLocaleDateString(i18n.language || undefined, { month: "short", day: "numeric" })}
              </Text>
              <Text style={styles.heroStatLabel}>date</Text>
            </View>
          </View>
        </HeroCard>
        <MoveCard style={styles.bodyPanel} padding={16} radius={theme.radius.xl}>
          <Text style={styles.body}>{body}</Text>
        </MoveCard>
        <TouchableOpacity onPress={openWeb} style={styles.webButton} activeOpacity={0.85}>
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.webButtonGrad}
          >
            <ExternalLink size={16} color={theme.colors.onAccent} />
            <Text style={styles.webButtonText}>{t("blog.openWeb")}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
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
  },
  content: { padding: 20, paddingBottom: 40 },
  cover: {
    width: "100%",
    aspectRatio: 1200 / 630,
    borderRadius: 22,
    marginBottom: 14,
    backgroundColor: theme.colors.surface2,
  },
  hero: {
    marginBottom: 14,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
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
  categoryPill: { marginTop: 6 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: fonts.serifBold,
    color: theme.colors.text,
  },
  excerpt: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fonts.sans,
    color: theme.colors.textSecondary,
    marginTop: 12,
  },
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
  bodyPanel: {
    marginTop: 0,
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    fontFamily: fonts.sans,
    color: theme.colors.text,
  },
  webButton: {
    marginTop: 28,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  webButtonGrad: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  webButtonText: { color: theme.colors.onAccent, fontFamily: fonts.sansBold, fontSize: 15 },
  errorText: {
    color: theme.colors.text,
    fontFamily: fonts.sans,
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
  },
  retryText: { color: theme.colors.primary, fontFamily: fonts.sansBold },
});
