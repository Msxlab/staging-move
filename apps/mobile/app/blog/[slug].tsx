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
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { ExternalLink } from "lucide-react-native";
import { api } from "@/lib/api";
import { useAppTheme, type Theme } from "@/lib/theme";

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

const WEB_URL = process.env.EXPO_PUBLIC_APP_URL || "https://locateflow.com";

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

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
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
    } catch (e) {
      const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
      if (cached) {
        try {
          setPost(JSON.parse(cached) as BlogPostDetail);
        } catch {
          setError(e instanceof Error ? e.message : "Couldn't load post");
        }
      } else {
        setError(e instanceof Error ? e.message : "Couldn't load post");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, locale, slug]);

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
        <Text style={styles.errorText}>{error || "Post not found"}</Text>
        <TouchableOpacity onPress={load} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const body = htmlToReadableText(post.contentHtml);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        {post.category ? <Text style={styles.category}>{post.category.name.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.excerpt}>{post.excerpt}</Text>
        <Text style={styles.meta}>
          {post.author?.name || "LocateFlow"} /{" "}
          {new Date(post.publishedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}{" "}
          / {post.readingMinutes} min read
        </Text>
        <Text style={styles.body}>{body}</Text>
        <TouchableOpacity onPress={openWeb} style={styles.webButton}>
          <ExternalLink size={16} color="#fff" />
          <Text style={styles.webButtonText}>Open web version</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#1a1a22",
  },
  category: {
    fontSize: 11,
    letterSpacing: 1,
    color: theme.colors.primary,
    fontWeight: "700",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: theme.colors.text,
  },
  excerpt: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textMuted,
    marginTop: 12,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 14,
    marginBottom: 22,
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
    color: theme.colors.text,
  },
  webButton: {
    marginTop: 28,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  webButtonText: { color: "#fff", fontWeight: "700" },
  errorText: {
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
