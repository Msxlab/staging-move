"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plus, Shield, ShieldCheck, Eye, UserCog, Pencil, Trash2, Power, X,
  KeyRound, Activity, Clock,
} from "lucide-react";

interface AdminUser {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string;
  permissions: { resource: string; canRead: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }[];
}

const ROLE_ICONS: Record<string, typeof Shield> = { SUPER_ADMIN: ShieldCheck, ADMIN: Shield, MODERATOR: UserCog, VIEWER: Eye };
const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-500/10 text-red-500", ADMIN: "bg-purple-500/10 text-purple-500",
  MODERATOR: "bg-blue-500/10 text-blue-500", VIEWER: "bg-gray-500/10 text-gray-500",
};

const inputCls = "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

export default function TeamPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", role: "", newPassword: "" });
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", role: "MODERATOR" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAdmins(); }, []);

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch { toast.error("Failed to fetch team"); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create"); return; }
      toast.success(`Admin ${data.admin.email} created`);
      setShowForm(false);
      setForm({ email: "", password: "", firstName: "", lastName: "", role: "MODERATOR" });
      fetchAdmins();
    } catch { toast.error("Failed to create admin"); }
    finally { setCreating(false); }
  }

  function openEdit(admin: AdminUser) {
    setEditAdmin(admin);
    setEditForm({ firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role, newPassword: "" });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdmin) return;
    setSaving(true);
    try {
      const body: any = { firstName: editForm.firstName, lastName: editForm.lastName, email: editForm.email, role: editForm.role };
      if (editForm.newPassword) body.newPassword = editForm.newPassword;

      const res = await fetch(`/api/team/${editAdmin.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to update"); return; }
      toast.success("Admin updated");
      setEditAdmin(null);
      fetchAdmins();
    } catch { toast.error("Failed to update admin"); }
    finally { setSaving(false); }
  }

  async function toggleActive(admin: AdminUser) {
    try {
      const res = await fetch(`/api/team/${admin.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive }),
      });
      if (!res.ok) { toast.error("Failed to toggle"); return; }
      toast.success(admin.isActive ? "Admin deactivated" : "Admin activated");
      fetchAdmins();
    } catch { toast.error("Failed to toggle"); }
  }

  async function handleDelete(admin: AdminUser) {
    if (!confirm(`Delete admin ${admin.email}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/team/${admin.id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); toast.error(data.error || "Failed to delete"); return; }
      toast.success("Admin deleted");
      fetchAdmins();
    } catch { toast.error("Failed to delete admin"); }
  }

  const roleCounts: Record<string, number> = {};
  admins.forEach((a) => { roleCounts[a.role] = (roleCounts[a.role] || 0) + 1; });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Team</h1>
          <p className="mt-1 text-muted-foreground">{admins.length} admin{admins.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Add Admin
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{admins.length}</p>
        </div>
        {["SUPER_ADMIN", "ADMIN", "MODERATOR", "VIEWER"].map((role) => {
          const Icon = ROLE_ICONS[role] || Eye;
          return (
            <div key={role} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{role.replace("_", " ")}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{roleCounts[role] || 0}</p>
                </div>
                <div className={`rounded-lg p-2 ${ROLE_COLORS[role]}`}><Icon className="h-4 w-4" /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Create New Admin</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required className={inputCls} />
            <input placeholder="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required className={inputCls} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={inputCls} />
            <input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} className={inputCls} />
          </div>
          <div className="flex items-center gap-4">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls + " max-w-[200px]"}>
              <option value="VIEWER">Viewer</option>
              <option value="MODERATOR">Moderator</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <button type="submit" disabled={creating} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {creating ? "Creating..." : "Create Admin"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">Cancel</button>
          </div>
        </form>
      )}

      {/* Admin List */}
      <div className="grid gap-3">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : admins.map((admin) => {
          const RoleIcon = ROLE_ICONS[admin.role] || Eye;
          return (
            <div key={admin.id} className={`rounded-xl border bg-card p-5 transition-colors ${admin.isActive ? "border-border" : "border-border/50 opacity-60"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-lg p-2.5 ${ROLE_COLORS[admin.role] || "bg-muted"}`}>
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{admin.firstName} {admin.lastName}</p>
                      {!admin.isActive && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">Inactive</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{admin.email}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {admin.lastLoginAt ? `Last login: ${new Date(admin.lastLoginAt).toLocaleDateString()}` : "Never logged in"}</span>
                      <span>Joined {new Date(admin.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${ROLE_COLORS[admin.role] || "bg-muted text-muted-foreground"}`}>
                    {admin.role.replace("_", " ")}
                  </span>
                  <button onClick={() => openEdit(admin)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => toggleActive(admin)} className={`rounded-lg p-1.5 ${admin.isActive ? "text-muted-foreground hover:text-orange-500" : "text-green-500 hover:text-green-400"} hover:bg-accent`} title={admin.isActive ? "Deactivate" : "Activate"}>
                    <Power className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(admin)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Permission Matrix (compact) */}
              {admin.permissions && admin.permissions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {admin.permissions.filter((p) => p.canCreate || p.canUpdate || p.canDelete).map((p) => (
                      <span key={p.resource} className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {p.resource.replace("_", " ")}
                        <span className="ml-0.5 opacity-60">
                          ({[p.canCreate && "C", p.canRead && "R", p.canUpdate && "U", p.canDelete && "D"].filter(Boolean).join("")})
                        </span>
                      </span>
                    ))}
                    {admin.permissions.filter((p) => p.canRead && !p.canCreate && !p.canUpdate && !p.canDelete).length > 0 && (
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{admin.permissions.filter((p) => p.canRead && !p.canCreate && !p.canUpdate && !p.canDelete).length} read-only
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditAdmin(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Edit Admin</h2>
              <button onClick={() => setEditAdmin(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">First Name</label>
                  <input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Last Name</label>
                  <input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required className={inputCls} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                  <option value="VIEWER">Viewer</option>
                  <option value="MODERATOR">Moderator</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> New Password (leave empty to keep current)
                </label>
                <input type="password" value={editForm.newPassword} onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })} minLength={6} placeholder="••••••" className={inputCls} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditAdmin(null)} className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
