"use client";

import { useState, useEffect } from "react";
import { HelpCircle, Plus, Trash2, Edit2, Eye, EyeOff, MessageCircle, FileText, X, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface Article { id: string; slug: string; title: string; content: string; excerpt: string | null; category: string; tags: string; order: number; isPublished: boolean; viewCount: number; helpfulYes: number; helpfulNo: number; createdAt: string }
interface FAQ { id: string; question: string; answer: string; category: string; order: number; isPublished: boolean }

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"articles" | "faqs">("articles");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [articleForm, setArticleForm] = useState({ slug: "", title: "", content: "", excerpt: "", category: "Getting Started", tags: "", order: 0, isPublished: false });
  const [faqForm, setFaqForm] = useState({ question: "", answer: "", category: "General", order: 0, isPublished: true });
  const [pendingDelete, setPendingDelete] = useState<{ id: string; type: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => { fetch("/api/help-center").then(r => r.json()).then(d => { setArticles(d.articles || []); setFaqs(d.faqs || []); }).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const saveArticle = async () => {
    if (!articleForm.title || !articleForm.content) { toast.error("Title and content required"); return; }
    const method = editing ? "PUT" : "POST";
    const payload = editing ? { id: editing.id, ...articleForm, tags: articleForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) } : { ...articleForm, slug: articleForm.slug || articleForm.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), tags: articleForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) };
    const res = await fetch("/api/help-center", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editing ? "Updated" : "Created"); resetForm(); load(); } else { const d = await res.json(); toast.error(d.error || "Failed"); }
  };

  const saveFaq = async () => {
    if (!faqForm.question || !faqForm.answer) { toast.error("Question and answer required"); return; }
    const method = editing ? "PUT" : "POST";
    const payload = editing ? { id: editing.id, entityType: "faq", ...faqForm } : { entityType: "faq", ...faqForm };
    const res = await fetch("/api/help-center", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { toast.success(editing ? "Updated" : "Created"); resetForm(); load(); } else toast.error("Failed");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch("/api/help-center", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pendingDelete.id, entityType: pendingDelete.type }) });
    setDeleting(false);
    if (res.ok) { toast.success("Deleted"); setPendingDelete(null); load(); } else toast.error("Failed");
  };

  const togglePublish = async (item: any, type: string) => {
    const res = await fetch("/api/help-center", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, entityType: type, isPublished: !item.isPublished }) });
    if (res.ok) { toast.success(item.isPublished ? "Unpublished" : "Published"); load(); }
  };

  const resetForm = () => { setEditing(null); setShowForm(false); setArticleForm({ slug: "", title: "", content: "", excerpt: "", category: "Getting Started", tags: "", order: 0, isPublished: false }); setFaqForm({ question: "", answer: "", category: "General", order: 0, isPublished: true }); };

  const editArticle = (a: Article) => { setEditing(a); setArticleForm({ slug: a.slug, title: a.title, content: a.content, excerpt: a.excerpt || "", category: a.category, tags: JSON.parse(a.tags || "[]").join(", "), order: a.order, isPublished: a.isPublished }); setTab("articles"); setShowForm(true); };
  const editFaq = (f: FAQ) => { setEditing(f); setFaqForm({ question: f.question, answer: f.answer, category: f.category, order: f.order, isPublished: f.isPublished }); setTab("faqs"); setShowForm(true); };

  const categories = [...new Set(articles.map(a => a.category))];
  const faqCategories = [...new Set(faqs.map(f => f.category))];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Content"
        title="Help <em>Center</em>"
        subtitle="Manage articles and FAQs"
        actions={
          <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> {tab === "articles" ? "New Article" : "New FAQ"}</button>
        }
      />

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Articles</p><p className="mt-1 text-2xl font-bold text-foreground">{articles.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Published</p><p className="mt-1 text-2xl font-bold text-tone-sage-fg">{articles.filter(a => a.isPublished).length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">FAQs</p><p className="mt-1 text-2xl font-bold text-foreground">{faqs.length}</p></div>
        <div className="rounded-xl border border-border bg-card p-5"><p className="text-sm text-muted-foreground">Total Views</p><p className="mt-1 text-2xl font-bold text-tone-sky-fg">{articles.reduce((s, a) => s + a.viewCount, 0)}</p></div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(["articles", "faqs"] as const).map(t => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{t === "articles" ? "Articles" : "FAQs"}</button>))}
      </div>

      {showForm && tab === "articles" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit Article" : "New Article"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Title</label><input value={articleForm.title} onChange={e => setArticleForm({ ...articleForm, title: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Slug</label><input value={articleForm.slug} onChange={e => setArticleForm({ ...articleForm, slug: e.target.value })} disabled={!!editing} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Category</label><input value={articleForm.category} onChange={e => setArticleForm({ ...articleForm, category: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Tags (comma-separated)</label><input value={articleForm.tags} onChange={e => setArticleForm({ ...articleForm, tags: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Excerpt</label><input value={articleForm.excerpt} onChange={e => setArticleForm({ ...articleForm, excerpt: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Content (Markdown)</label><textarea value={articleForm.content} onChange={e => setArticleForm({ ...articleForm, content: e.target.value })} rows={10} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono" /></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={articleForm.isPublished} onChange={e => setArticleForm({ ...articleForm, isPublished: e.target.checked })} className="accent-primary" /> Published</label>
              <div><label className="text-sm text-muted-foreground mr-2">Order:</label><input type="number" value={articleForm.order} onChange={e => setArticleForm({ ...articleForm, order: parseInt(e.target.value) || 0 })} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" /></div>
            </div>
          </div>
          <div className="flex gap-2"><button onClick={saveArticle} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? "Update" : "Create"}</button><button onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      {showForm && tab === "faqs" && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">{editing ? "Edit FAQ" : "New FAQ"}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Question</label><input value={faqForm.question} onChange={e => setFaqForm({ ...faqForm, question: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-muted-foreground mb-1">Answer</label><textarea value={faqForm.answer} onChange={e => setFaqForm({ ...faqForm, answer: e.target.value })} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div><label className="block text-sm font-medium text-muted-foreground mb-1">Category</label><input value={faqForm.category} onChange={e => setFaqForm({ ...faqForm, category: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={faqForm.isPublished} onChange={e => setFaqForm({ ...faqForm, isPublished: e.target.checked })} className="accent-primary" /> Published</label>
              <div><label className="text-sm text-muted-foreground mr-2">Order:</label><input type="number" value={faqForm.order} onChange={e => setFaqForm({ ...faqForm, order: parseInt(e.target.value) || 0 })} className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground" /></div>
            </div>
          </div>
          <div className="flex gap-2"><button onClick={saveFaq} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{editing ? "Update" : "Create"}</button><button onClick={resetForm} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent">Cancel</button></div>
        </div>
      )}

      {tab === "articles" && (
        <div className="rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="px-4 py-3 font-medium">Title</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Views</th><th className="px-4 py-3 font-medium">Helpful</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium w-32">Actions</th></tr></thead>
            <tbody>
              {articles.length === 0 ? (<tr><td colSpan={6} className="px-4"><EmptyState icon={FileText} title="No articles yet" description="Create your first help article to get started." /></td></tr>) : articles.map(a => (
                <tr key={a.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{a.title}</p><p className="text-xs text-muted-foreground">{a.slug}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{a.category}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{a.viewCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        {a.helpfulYes}
                        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {a.helpfulNo}
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.isPublished ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>{a.isPublished ? "Published" : "Draft"}</span></td>
                  <td className="px-4 py-3 flex gap-1">
                    <button onClick={() => togglePublish(a, "article")} aria-label={a.isPublished ? "Unpublish article" : "Publish article"} aria-pressed={a.isPublished} className="rounded p-1 text-muted-foreground hover:bg-accent">{a.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                    <button onClick={() => editArticle(a)} aria-label="Edit article" className="rounded p-1 text-muted-foreground hover:bg-accent"><Edit2 className="h-4 w-4" /></button>
                    <button onClick={() => setPendingDelete({ id: a.id, type: "article", label: a.title })} aria-label="Delete article" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "faqs" && (
        <div className="space-y-3">
          {faqs.length === 0 ? (<div className="rounded-xl border border-border bg-card"><EmptyState icon={MessageCircle} title="No FAQs yet" description="Add your first FAQ to help users find answers." /></div>) : faqs.map(f => (
            <div key={f.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{f.category}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${f.isPublished ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>{f.isPublished ? "Published" : "Draft"}</span>
                  </div>
                  <p className="font-medium text-foreground">{f.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{f.answer}</p>
                </div>
                <div className="flex gap-1 ml-4">
                  <button onClick={() => togglePublish(f, "faq")} aria-label={f.isPublished ? "Unpublish FAQ" : "Publish FAQ"} aria-pressed={f.isPublished} className="rounded p-1 text-muted-foreground hover:bg-accent">{f.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button onClick={() => editFaq(f)} aria-label="Edit FAQ" className="rounded p-1 text-muted-foreground hover:bg-accent"><Edit2 className="h-4 w-4" /></button>
                  <button onClick={() => setPendingDelete({ id: f.id, type: "faq", label: f.question })} aria-label="Delete FAQ" className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.type === "faq" ? "Delete FAQ" : "Delete article"}
        description={pendingDelete ? `"${pendingDelete.label}" will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete"
        busy={deleting}
        onClose={() => { if (!deleting) setPendingDelete(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
