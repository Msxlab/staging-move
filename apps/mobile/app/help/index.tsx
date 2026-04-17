import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Button } from "@/components/ui/Button";

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

export default function HelpScreen() {
  const router = useRouter();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);

  const fetchHelp = useCallback(async () => {
    const res = await api.get<any>("/api/help");
    if (res.data) {
      setFaqs(res.data.faqs || []);
      setArticles(res.data.articles || []);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchHelp();
    setLoading(false);
  }, [fetchHelp]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHelp();
    setRefreshing(false);
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
    const supportUrl = "https://www.locateflow.app/contact";
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
          <Text style={styles.title}>Article</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Card variant="default">
            {!!selectedArticle.category && <Text style={styles.articleDetailCategory}>{selectedArticle.category}</Text>}
            <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
            {!!selectedArticle.excerpt && <Text style={styles.articleDetailExcerpt}>{selectedArticle.excerpt}</Text>}
            <Text style={styles.articleDetailBody}>
              {selectedArticle.content || "This article does not have additional details yet."}
            </Text>
          </Card>

          <Card variant="default" style={{ marginTop: 12 }}>
            <Text style={styles.supportCardTitle}>Still need help?</Text>
            <Text style={styles.supportCardText}>
              If this guide does not answer your question, you can open the support page for the fastest next step.
            </Text>
            <Button title="Contact Support" onPress={handleContactUs} style={{ marginTop: 12 }} />
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
        <Text style={styles.title}>Help Center</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search help topics..."
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
        {/* Quick Actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} activeOpacity={0.7} onPress={handleContactUs}>
            <ExternalLink size={20} color={theme.colors.accent} />
            <Text style={styles.quickLabel}>Contact Us</Text>
          </TouchableOpacity>
        </View>

        {/* Articles */}
        {filteredArticles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Articles</Text>
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
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        {filteredFaqs.length === 0 ? (
          <Card variant="default">
            <Text style={styles.emptyText}>
              {search ? "No FAQs match your search." : "No FAQs available yet."}
            </Text>
            {search ? (
              <Text style={styles.emptyHint}>Try a broader search, or open Contact Us if you need direct help.</Text>
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

const styles = StyleSheet.create({
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
