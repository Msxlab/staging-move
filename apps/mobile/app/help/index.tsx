import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  HelpCircle,
  ArrowLeft,
  Search,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ExternalLink,
  Ticket,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Button } from "@/components/ui/Button";
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

  const handleContactUs = useCallback(async () => {
    const supportUrl = `${APP_WEB_URL}/contact`;
    const canOpen = await Linking.canOpenURL(supportUrl);
    if (canOpen) {
      await Linking.openURL(supportUrl);
    }
  }, []);

  if (selectedArticle) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.backBtn}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t("help.title")}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Card variant="default">
            {!!selectedArticle.category && <Text style={styles.articleDetailCategory}>{selectedArticle.category}</Text>}
            <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
            {!!selectedArticle.excerpt && <Text style={styles.articleDetailExcerpt}>{selectedArticle.excerpt}</Text>}
            <Text style={styles.articleDetailBody}>
              {selectedArticle.content || ""}
            </Text>
          </Card>

          <Card variant="default" style={{ marginTop: 12 }}>
            <Text style={styles.supportCardTitle}>{t("help.contact")}</Text>
            <Button title={t("help.contact")} onPress={handleContactUs} style={{ marginTop: 12 }} />
          </Card>
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
        <Text style={styles.title}>{t("help.title")}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("help.searchPlaceholder")}
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {error ? (
          <ErrorState title={t("help.unavailable")} message={error} onRetry={load} />
        ) : null}

        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.7} onPress={handleContactUs}>
            <ExternalLink size={20} color={theme.colors.accent} />
            <Text style={styles.quickLabel}>{t("help.contact")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.7} onPress={() => router.push("/help/tickets")}>
            <Ticket size={20} color={theme.colors.primary} />
            <Text style={styles.quickLabel}>{t("help.supportTickets")}</Text>
          </TouchableOpacity>
        </View>

        {/* Articles */}
        {filteredArticles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t("help.articlesTitle")}</Text>
            <View style={styles.list}>
              {filteredArticles.slice(0, 5).map((article) => (
                <TouchableOpacity key={article.id} style={styles.articleItem} activeOpacity={0.6} onPress={() => setSelectedArticle(article)}>
                  <BookOpen size={16} color={theme.colors.textTertiary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.articleTitle} numberOfLines={1}>{article.title}</Text>
                    {article.category && <Text style={styles.articleCategory}>{article.category}</Text>}
                  </View>
                  <ChevronDown size={14} color={theme.colors.textMuted} style={{ transform: [{ rotate: "-90deg" }] }} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* FAQs */}
        <Text style={styles.sectionTitle}>{t("help.faqTitle")}</Text>
        {filteredFaqs.length === 0 ? (
          <Card variant="default">
            <Text style={styles.emptyText}>
              {t("common.none")}
            </Text>
            {search ? (
              <Text style={styles.emptyHint}>{t("help.emptySearchHint")}</Text>
            ) : null}
          </Card>
        ) : (
          <View style={styles.list}>
            {filteredFaqs.map((faq) => (
              <TouchableOpacity
                key={faq.id}
                style={styles.faqItem}
                onPress={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{faq.question}</Text>
                  {expandedFaq === faq.id ? (
                    <ChevronUp size={16} color={theme.colors.textTertiary} />
                  ) : (
                    <ChevronDown size={16} color={theme.colors.textMuted} />
                  )}
                </View>
                {expandedFaq === faq.id && (
                  <Text style={styles.faqAnswer}>{faq.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
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
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  searchRow: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32 },
  quickRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  quickCard: { flex: 1, alignItems: "center", gap: 8, backgroundColor: theme.colors.card, borderRadius: theme.radius.xl, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 20 },
  quickLabel: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text, marginBottom: 10 },
  list: { gap: 8, marginBottom: 24 },
  articleItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  articleTitle: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  articleCategory: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  articleDetailCategory: { fontSize: 12, fontWeight: "700", color: theme.colors.primary, marginBottom: 8 },
  articleDetailTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text, lineHeight: 28 },
  articleDetailExcerpt: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 20 },
  articleDetailBody: { fontSize: 14, color: theme.colors.textTertiary, marginTop: 14, lineHeight: 22 },
  faqItem: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: 14 },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: "600", color: theme.colors.text },
  faqAnswer: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 10, lineHeight: 19 },
  emptyText: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center" },
  emptyHint: { fontSize: 12, color: theme.colors.textMuted, textAlign: "center", marginTop: 8, lineHeight: 18 },
  supportCardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  supportCardText: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 8, lineHeight: 19 },
});
