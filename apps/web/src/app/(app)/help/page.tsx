"use client";

import { useState, useEffect } from "react";
import { HelpCircle, Search, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, BookOpen, MessageCircle } from "lucide-react";
import { ListSkeleton } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";

interface Article { id: string; slug: string; title: string; content: string; excerpt: string | null; category: string; tags: string; viewCount: number; helpfulYes: number; helpfulNo: number }
interface FAQ { id: string; question: string; answer: string; category: string }

export default function HelpPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"articles" | "faq">("articles");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch("/api/help")
      .then(r => r.json())
      .then(d => { setArticles(d.articles || []); setFaqs(d.faqs || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredArticles = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.excerpt || "").toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFaqs = faqs.filter(f =>
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(articles.map(a => a.category))];
  const faqCategories = [...new Set(faqs.map(f => f.category))];

  if (selectedArticle) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => setSelectedArticle(null)} className="text-sm text-orange-400 hover:text-orange-300 mb-4">← Back to Help Center</button>
        <div className="rounded-2xl border border-foreground/[0.06] p-8" style={{ background: "color-mix(in srgb, var(--surface-secondary) 60%, transparent)" }}>
          <span className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">{selectedArticle.category}</span>
          <h1 className="text-2xl font-bold text-foreground mt-3 mb-4">{selectedArticle.title}</h1>
          <div className="prose prose-invert prose-sm max-w-none text-foreground/80 whitespace-pre-wrap">{selectedArticle.content}</div>
          <div className="mt-8 pt-6 border-t border-foreground/[0.06] flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Was this helpful?</span>
            <button className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-green-400 hover:border-green-500/30 transition"><ThumbsUp className="h-3.5 w-3.5" /> Yes ({selectedArticle.helpfulYes})</button>
            <button className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition"><ThumbsDown className="h-3.5 w-3.5" /> No ({selectedArticle.helpfulNo})</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">
          <HelpCircle className="h-7 w-7 text-orange-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Help Center</h1>
        <p className="text-sm text-muted-foreground mt-1">Find answers and guides for using LocateFlow</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles and FAQs..." className="w-full rounded-xl border border-border bg-foreground/5 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-orange-500/50" />
      </div>

      <div className="flex gap-2 justify-center">
        {(["articles", "faq"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "text-muted-foreground hover:text-muted-foreground border border-transparent"}`}>
            {t === "articles" ? <><BookOpen className="h-4 w-4 inline mr-1.5" />Articles</> : <><MessageCircle className="h-4 w-4 inline mr-1.5" />FAQ</>}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton count={4} />
      ) : tab === "articles" ? (
        <div className="space-y-6">
          {categories.map(cat => {
            const catArticles = filteredArticles.filter(a => a.category === cat);
            if (catArticles.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3">{cat}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {catArticles.map(a => (
                    <button key={a.id} onClick={() => setSelectedArticle(a)} className="text-left rounded-xl border border-foreground/[0.06] p-4 hover:border-orange-500/20 hover:bg-orange-500/5 transition" style={{ background: "color-mix(in srgb, var(--surface-secondary) 60%, transparent)" }}>
                      <h3 className="text-sm font-medium text-foreground">{a.title}</h3>
                      {a.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.excerpt}</p>}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-foreground/35">
                        <span>{a.viewCount} views</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredArticles.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title={search ? "No matching articles" : "No articles yet"}
              description={search ? "Try different keywords or browse the FAQ tab." : "Help articles will appear here as they're published."}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {faqCategories.map(cat => {
            const catFaqs = filteredFaqs.filter(f => f.category === cat);
            if (catFaqs.length === 0) return null;
            return (
              <div key={cat} className="mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">{cat}</h2>
                {catFaqs.map(f => (
                  <div key={f.id} className="rounded-xl border border-foreground/[0.06] mb-2 overflow-hidden" style={{ background: "color-mix(in srgb, var(--surface-secondary) 60%, transparent)" }}>
                    <button onClick={() => setExpandedFaq(expandedFaq === f.id ? null : f.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                      <span className="text-sm font-medium text-foreground">{f.question}</span>
                      {expandedFaq === f.id ? <ChevronUp className="h-4 w-4 text-foreground/40 shrink-0" /> : <ChevronDown className="h-4 w-4 text-foreground/40 shrink-0" />}
                    </button>
                    {expandedFaq === f.id && (
                      <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-foreground/[0.06] pt-3">{f.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {filteredFaqs.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title={search ? "No matching FAQs" : "No FAQs yet"}
              description={search ? "Try different keywords or browse the Articles tab." : "Frequently asked questions will appear here soon."}
            />
          )}
        </div>
      )}
    </div>
  );
}
