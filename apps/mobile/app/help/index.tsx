import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useRouter, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import {
  HelpCircle,
  ArrowLeft,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  MessageSquare,
  ExternalLink,
  Ticket,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { MoveCard, SectionHeader, Pill } from "@/components/move";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorState } from "@/components/ui/ErrorState";
import { captureException } from "@/lib/sentry";

// — surfacing as the generic "Something went wrong" fallback.
interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface HelpArticle {
  id: string;
  title: string;
  content?: string;
  excerpt?: string | null;
  category?: string;
}

function asText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

/**
 * Route-level error boundary (expo-router picks up this named export). ANY render
 * throw inside the Help route is caught HERE and shown as a graceful in-screen
 * retry, instead of escaping to the app-wide ErrorBoundary's full-screen
 * "Something went wrong". Belt-and-suspenders on top of the guarded data flow.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20 }}>
        <ErrorState
          title={t("help.unavailable", { defaultValue: "Help is temporarily unavailable" })}
          message={t("help.errorBody", { defaultValue: "We couldn't open Help. Please try again." })}
          onRetry={retry}
        />
      </View>
    </SafeAreaView>
  );
}

function normalizeFaqs(value: unknown): FAQ[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: asText((item as any)?.id, `faq-${index}`),
      question: asText((item as any)?.question),
      answer: asText((item as any)?.answer),
    }))
    .filter((item) => item.question && item.answer);
}

function normalizeArticles(value: unknown): HelpArticle[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: asText((item as any)?.id, `article-${index}`),
      title: asText((item as any)?.title),
      content: asText((item as any)?.content),
      excerpt: typeof (item as any)?.excerpt === "string" ? (item as any).excerpt : null,
      category: asText((item as any)?.category),
    }))
    .filter((item) => item.title);
}

export default function HelpScreen() {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localFaqs = useMemo<FAQ[]>(
    () => [
      { id: "sync", question: t("help.faqDataSyncQuestion"), answer: t("help.faqDataSyncAnswer") },
      { id: "provider", question: t("help.faqProviderQuestion"), answer: t("help.faqProviderAnswer") },
      { id: "help-load", question: t("help.faqHelpQuestion"), answer: t("help.faqHelpAnswer") },
    ],
    [i18n.language, t],
  );

  const localArticles = useMemo<HelpArticle[]>(
    () => [
      {
        id: "getting-started",
        category: t("help.articleGettingStartedCategory"),
        title: t("help.articleGettingStartedTitle"),
        excerpt: t("help.articleGettingStartedExcerpt"),
        content: t("help.articleGettingStartedContent"),
      },
      {
        id: "providers",
        category: t("help.articleProvidersCategory"),
        title: t("help.articleProvidersTitle"),
        excerpt: t("help.articleProvidersExcerpt"),
        content: t("help.articleProvidersContent"),
      },
      {
        id: "moving",
        category: t("help.articleMovingCategory"),
        title: t("help.articleMovingTitle"),
        excerpt: t("help.articleMovingExcerpt"),
        content: t("help.articleMovingContent"),
      },
    ],
    [i18n.language, t],
  );

  const useLocalHelp = (i18n.language || "").toLowerCase().startsWith("es");

  const applyLocalHelp = useCallback(() => {
    setFaqs(localFaqs);
    setArticles(localArticles);
    setError(null);
  }, [localArticles, localFaqs]);

  const fetchHelp = useCallback(async () => {
    if (useLocalHelp) {
      applyLocalHelp();
      return true;
    }

    try {
      const res = await api.get<any>("/api/help");
      if (res.error) {
        applyLocalHelp();
        return true;
      }
      const nextFaqs = normalizeFaqs(res.data?.faqs);
      const nextArticles = normalizeArticles(res.data?.articles);
      if (nextFaqs.length === 0 && nextArticles.length === 0) {
        applyLocalHelp();
        return true;
      }
      setFaqs(nextFaqs.length > 0 ? nextFaqs : localFaqs);
      setArticles(nextArticles.length > 0 ? nextArticles : localArticles);
      setError(null);
      return true;
    } catch (err) {
      // Network/parse failure that escaped the api client — report once
      // so the real cause surfaces in telemetry rather than as a generic
      // "Something went wrong" from the global ErrorBoundary, then fall
      // back to local help so the screen is still usable offline.
      captureException(err instanceof Error ? err : new Error(String(err)), {
        screen: "help/index",
      });
      applyLocalHelp();
      return true;
    }
  }, [applyLocalHelp, localArticles, localFaqs, useLocalHelp]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetchHelp();
    } finally {
      setLoading(false);
    }
  }, [fetchHelp]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchHelp();
    } finally {
      setRefreshing(false);
    }
  }, [fetchHelp]);

  useEffect(() => { load(); }, [load]);

  // Must stay ABOVE the `if (loading)` early return — declaring this hook after
  // a conditional return changes the hook count between the first (loading) and
  // second render, which throws "Rendered more hooks than during the previous
  // render" and took the whole Help screen down.
  const handleContactUs = useCallback(async () => {
    const supportUrl = `${APP_WEB_URL}/contact`;
    await openWebUrl(supportUrl);
  }, []);

  if (loading) return <LoadingScreen />;

  const filteredFaqs = search
    ? faqs.filter((f) => f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  const filteredArticles = search
    ? articles.filter((a) =>
        a.title?.toLowerCase().includes(search.toLowerCase()) ||
        a.content?.toLowerCase().includes(search.toLowerCase()) ||
        a.excerpt?.toLowerCase().includes(search.toLowerCase()) ||
        a.category?.toLowerCase().includes(search.toLowerCase())
      )
    : articles;

  if (selectedArticle) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("help.title")}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <MoveCard>
            {!!selectedArticle.category && (
              <Pill label={selectedArticle.category} tone="accent" style={{ marginBottom: 10 }} />
            )}
            <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
            {!!selectedArticle.excerpt && <Text style={styles.articleDetailExcerpt}>{selectedArticle.excerpt}</Text>}
            <Text style={styles.articleDetailBody}>
              {selectedArticle.content || ""}
            </Text>
          </MoveCard>

          <MoveCard style={{ marginTop: 12 }}>
            <Text style={styles.supportCardTitle}>{t("help.contact")}</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={handleContactUs} style={{ marginTop: 14 }}>
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                <MessageSquare size={17} color={theme.colors.onAccent} />
                <Text style={styles.ctaText}>{t("help.contact")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </MoveCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("help.title")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Page heading */}
        <View style={styles.heading}>
          <View style={styles.headingIcon}>
            <HelpCircle size={20} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.pageTitle}>{t("help.title")}</Text>
            <Text style={styles.pageSub}>{t("help.searchPlaceholder")}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.faint} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("help.searchPlaceholder")}
            placeholderTextColor={theme.colors.faint}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {error ? (
          <View style={{ marginTop: 16 }}>
            <ErrorState title={t("help.unavailable")} message={error} onRetry={load} />
          </View>
        ) : null}

        {/* Popular topics — help articles */}
        {filteredArticles.length > 0 && (
          <>
            <SectionHeader label={t("help.articlesTitle")} style={styles.sectionHeader} />
            <View style={styles.list}>
              {filteredArticles.slice(0, 5).map((article) => (
                <MoveCard
                  key={article.id}
                  onPress={() => setSelectedArticle(article)}
                  padding={14}
                  radius={14}
                >
                  <View style={styles.rowItem}>
                    <View style={styles.rowIcon}>
                      <BookOpen size={16} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{article.title}</Text>
                      {!!article.category && <Text style={styles.rowMeta}>{article.category}</Text>}
                    </View>
                    <ChevronRight size={16} color={theme.colors.faint} />
                  </View>
                </MoveCard>
              ))}
            </View>
          </>
        )}

        {/* Support actions */}
        <SectionHeader label={t("help.supportTickets")} style={styles.sectionHeader} />
        <View style={styles.list}>
          <MoveCard onPress={() => router.push("/help/tickets")} padding={14} radius={14}>
            <View style={styles.rowItem}>
              <View style={styles.rowIcon}>
                <Ticket size={16} color={theme.colors.primary} />
              </View>
              <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{t("help.supportTickets")}</Text>
              <ChevronRight size={16} color={theme.colors.faint} />
            </View>
          </MoveCard>
        </View>

        {/* FAQs */}
        <SectionHeader label={t("help.faqTitle")} style={styles.sectionHeader} />
        {filteredFaqs.length === 0 ? (
          <MoveCard>
            <Text style={styles.emptyText}>
              {t("common.none")}
            </Text>
            {search ? (
              <Text style={styles.emptyHint}>{t("help.emptySearchHint")}</Text>
            ) : null}
          </MoveCard>
        ) : (
          <View style={styles.list}>
            {filteredFaqs.map((faq) => {
              const expanded = expandedFaq === faq.id;
              return (
                <MoveCard
                  key={faq.id}
                  onPress={() => setExpandedFaq(expanded ? null : faq.id)}
                  padding={14}
                  radius={14}
                  accent={expanded}
                >
                  <View style={styles.faqHeader}>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                    {expanded ? (
                      <ChevronUp size={16} color={theme.colors.primary} />
                    ) : (
                      <ChevronDown size={16} color={theme.colors.faint} />
                    )}
                  </View>
                  {expanded && <Text style={styles.faqAnswer}>{faq.answer}</Text>}
                </MoveCard>
              );
            })}
          </View>
        )}

        {/* Contact support CTA */}
        <TouchableOpacity activeOpacity={0.85} onPress={handleContactUs} style={styles.ctaWrap}>
          <LinearGradient
            colors={theme.colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaBtn}
          >
            <MessageSquare size={17} color={theme.colors.onAccent} />
            <Text style={styles.ctaText}>{t("help.contact")}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.7} onPress={handleContactUs} style={styles.footerWrap}>
          <Text style={styles.footerText}>
            Move v{Constants.expoConfig?.version ?? "0.0.0"}
          </Text>
          <ExternalLink size={11} color={theme.colors.faint} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: fonts.serifBold, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 36 },

  heading: { flexDirection: "row", alignItems: "center", gap: 13, marginTop: 4, marginBottom: 16 },
  headingIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: { fontSize: 25, fontFamily: fonts.serifBold, color: theme.colors.text, letterSpacing: 0.2 },
  pageSub: { fontSize: 11, color: theme.colors.dim, marginTop: 2, fontFamily: fonts.sans },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text, fontFamily: fonts.sans, padding: 0 },

  sectionHeader: { marginTop: 24, marginBottom: 10 },
  list: { gap: 9 },

  rowItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 13.5, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  rowMeta: { fontSize: 11, color: theme.colors.dim, marginTop: 2, fontFamily: fonts.sans },

  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  faqQuestion: { flex: 1, fontSize: 13.5, fontFamily: fonts.sansSemibold, color: theme.colors.text },
  faqAnswer: { fontSize: 13, color: theme.colors.dim, marginTop: 10, lineHeight: 19, fontFamily: fonts.sans },

  articleDetailTitle: { fontSize: 22, fontFamily: fonts.serifBold, color: theme.colors.text, lineHeight: 28 },
  articleDetailExcerpt: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 20, fontFamily: fonts.sans },
  articleDetailBody: { fontSize: 14, color: theme.colors.dim, marginTop: 14, lineHeight: 22, fontFamily: fonts.sans },

  emptyText: { fontSize: 14, color: theme.colors.dim, textAlign: "center", fontFamily: fonts.sans },
  emptyHint: { fontSize: 12, color: theme.colors.faint, textAlign: "center", marginTop: 8, lineHeight: 18, fontFamily: fonts.sans },

  supportCardTitle: { fontSize: 16, fontFamily: fonts.serifBold, color: theme.colors.text },

  ctaWrap: { marginTop: 26 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: { fontSize: 15, fontFamily: fonts.sansBold, color: theme.colors.onAccent },

  footerWrap: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  footerText: { fontSize: 11, color: theme.colors.faint, fontFamily: fonts.mono },
});
