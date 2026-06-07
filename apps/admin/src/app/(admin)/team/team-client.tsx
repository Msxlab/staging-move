"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { ADMIN_RESOURCES } from "@/lib/admin-permissions";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { AdminPageHeader } from "@/components/admin-page-header";
import { EmptyState } from "@/components/empty-state";

interface PermissionRow {
  resource: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessionCount: number;
  recentSuccessfulLogins: number;
  recentFailedLogins: number;
  permissions: PermissionRow[];
}

const ROLE_ICONS: Record<string, typeof Shield> = {
  SUPER_ADMIN: ShieldCheck,
  ADMIN: Shield,
  MODERATOR: UserCog,
  VIEWER: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-destructive/10 text-destructive",
  ADMIN: "bg-tone-foil-bg text-tone-foil-fg",
  MODERATOR: "bg-tone-sky-bg text-tone-sky-fg",
  VIEWER: "bg-tone-slate-bg text-muted-foreground",
};

const RESOURCE_LABELS: Record<string, string> = {
  users: "Users",
  subscriptions: "Subscriptions",
  providers: "Providers",
  state_rules: "State Rules",
  badges: "Badges",
  documents: "Documents",
  moving_plans: "Moving Plans",
  tickets: "Support Tickets",
  audit_logs: "Audit Logs",
  admin_users: "Admin Team",
  settings: "Settings",
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

const emptyPermissionMatrix = ADMIN_RESOURCES.map((resource) => ({
  resource,
  canRead: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
}));

function sortPermissions(rows: PermissionRow[]) {
  const order = new Map<string, number>(
    ADMIN_RESOURCES.map((resource, index) => [resource, index]),
  );
  return [...rows].sort(
    (a, b) => (order.get(a.resource) ?? 999) - (order.get(b.resource) ?? 999),
  );
}
function expandPermissions(rows: PermissionRow[]) {
  const byResource = new Map(rows.map((row) => [row.resource, row]));
  return ADMIN_RESOURCES.map(
    (resource) =>
      byResource.get(resource) || {
        resource,
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
  );
}

interface TeamClientProps {
  /**
   * Server-resolved role of the currently signed-in admin. Treated as
   * display-only — every sensitive action API re-checks the role on the
   * server (apps/admin/src/lib/auth.ts:requireRole). Hiding buttons here
   * is just a UX polish, not a security boundary.
   */
  currentAdminRole: "VIEWER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
}

export default function TeamClient({ currentAdminRole }: TeamClientProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminUser | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [activeToggleTarget, setActiveToggleTarget] = useState<AdminUser | null>(null);
  const [activeToggleBusy, setActiveToggleBusy] = useState(false);
  const [activeToggleError, setActiveToggleError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    newPassword: "",
    confirmPassword: "",
    mfaCode: "",
    backupCode: "",
    permissions: emptyPermissionMatrix as PermissionRow[],
  });
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "MODERATOR",
    confirmPassword: "",
    mfaCode: "",
    backupCode: "",
  });
  // Invite mode (default): the new admin gets an emailed single-use
  // set-password link and is forced to rotate on first login. When false,
  // the operator sets an explicit temporary password (legacy path).
  const [inviteMode, setInviteMode] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  useEffect(() => {
    void fetchAdmins();
    // currentAdminRole is server-resolved and passed as a prop. We do
    // NOT fetch /api/auth/me to discover it client-side — that would
    // re-introduce the DevTools-flippable role variable that this page
    // used to depend on.
  }, []);

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to fetch team");
        return;
      }
      setAdmins(data.admins || []);
    } catch {
      toast.error("Failed to fetch team");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      // In invite mode we DON'T send a password — the server seeds an
      // unguessable one, flags the account must-change, and emails a
      // single-use set-password link.
      const { password, ...rest } = form;
      const payload = inviteMode ? rest : form;
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create admin");
        setForm((prev) => ({ ...prev, confirmPassword: "", mfaCode: "", backupCode: "" }));
        return;
      }
      if (data.invited) {
        toast.success(
          data.inviteEmailSent
            ? `Invitation sent to ${data.admin.email}`
            : `Admin ${data.admin.email} created — email not configured; share the set-password link manually`,
        );
        // Dev convenience: the server returns the link only outside production.
        if (data.setPasswordUrl) {
          console.info("[admin-invite] set-password link:", data.setPasswordUrl);
        }
      } else {
        toast.success(`Admin ${data.admin.email} created`);
      }
      setShowForm(false);
      setInviteMode(true);
      setForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "MODERATOR",
        confirmPassword: "",
        mfaCode: "",
        backupCode: "",
      });
      await fetchAdmins();
    } catch {
      toast.error("Failed to create admin");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(admin: AdminUser) {
    setEditAdmin(admin);
    setEditForm({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      newPassword: "",
      confirmPassword: "",
      mfaCode: "",
      backupCode: "",
      permissions: sortPermissions(expandPermissions(admin.permissions)),
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editAdmin) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.newPassword) body.newPassword = editForm.newPassword;
      if (currentAdminRole === "SUPER_ADMIN") {
        body.permissions = editForm.permissions;
      }
      const isSensitiveChange =
        editForm.role !== editAdmin.role ||
        Boolean(editForm.newPassword) ||
        currentAdminRole === "SUPER_ADMIN";
      if (isSensitiveChange) {
        body.confirmPassword = editForm.confirmPassword;
        body.mfaCode = editForm.mfaCode;
        body.backupCode = editForm.backupCode;
      }

      const res = await fetch(`/api/team/${editAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update admin");
        setEditForm((prev) => ({ ...prev, confirmPassword: "", mfaCode: "", backupCode: "" }));
        return;
      }
      toast.success("Admin updated");
      setEditAdmin(null);
      await fetchAdmins();
    } catch {
      toast.error("Failed to update admin");
    } finally {
      setSaving(false);
    }
  }

  function toggleActive(admin: AdminUser) {
    setActiveToggleTarget(admin);
    setActiveToggleError(null);
  }

  async function confirmToggleActive(_confirmPassword: string, stepUp: StepUpValues) {
    if (!activeToggleTarget) return;
    const admin = activeToggleTarget;
    setActiveToggleBusy(true);
    setActiveToggleError(null);
    try {
      const res = await fetch(`/api/team/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !admin.isActive, ...stepUp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Failed to update admin status";
        setActiveToggleError(message);
        toast.error(message);
        return;
      }
      toast.success(admin.isActive ? "Admin deactivated" : "Admin reactivated");
      setActiveToggleTarget(null);
      await fetchAdmins();
    } catch {
      setActiveToggleError("Failed to update admin status");
      toast.error("Failed to update admin status");
    } finally {
      setActiveToggleBusy(false);
    }
  }

  async function confirmArchive(_confirmPassword: string, stepUp: StepUpValues) {
    if (!archiveTarget) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/team/${archiveTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUp),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || "Failed to archive admin";
        setArchiveError(message);
        toast.error(message);
        return;
      }
      toast.success("Admin archived. Audit history was preserved.");
      setArchiveTarget(null);
      await fetchAdmins();
    } catch {
      setArchiveError("Failed to archive admin");
      toast.error("Failed to archive admin");
    } finally {
      setArchiving(false);
    }
  }

  function updatePermission(
    resource: string,
    field: keyof Omit<PermissionRow, "resource">,
    nextValue: boolean,
  ) {
    setEditForm((current) => ({
      ...current,
      permissions: current.permissions.map((row) => {
        if (row.resource !== resource) return row;
        const updated = { ...row, [field]: nextValue };
        if (field !== "canRead" && nextValue) updated.canRead = true;
        if (field === "canRead" && !nextValue) {
          updated.canCreate = false;
          updated.canUpdate = false;
          updated.canDelete = false;
        }
        return updated;
      }),
    }));
  }

  const filteredAdmins = useMemo(() => {
    const query = search.trim().toLowerCase();
    return admins.filter((admin) => {
      const matchesSearch =
        !query ||
        `${admin.firstName} ${admin.lastName}`.toLowerCase().includes(query) ||
        admin.email.toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || admin.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && admin.isActive) ||
        (statusFilter === "INACTIVE" && !admin.isActive) ||
        (statusFilter === "MFA" && admin.mfaEnabled);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [admins, roleFilter, search, statusFilter]);

  const totals = useMemo(() => {
    return admins.reduce(
      (acc, admin) => {
        acc.active += admin.isActive ? 1 : 0;
        acc.mfa += admin.mfaEnabled ? 1 : 0;
        acc.sessions += admin.activeSessionCount;
        return acc;
      },
      { active: 0, mfa: 0, sessions: 0 },
    );
  }, [admins]);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Access"
        title="Admin <em>Team</em>"
        subtitle="Roster, role boundaries, permission matrices, and admin-session visibility"
        actions={
          currentAdminRole === "SUPER_ADMIN" && (
            <button
              onClick={() => setShowForm((current) => !current)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add Admin
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Admins" value={admins.length} icon={Users} />
        <MetricCard label="Active" value={totals.active} icon={ShieldCheck} />
        <MetricCard label="MFA Enabled" value={totals.mfa} icon={Shield} />
        <MetricCard label="Active Sessions" value={totals.sessions} icon={Activity} />
      </div>

      {showForm && currentAdminRole === "SUPER_ADMIN" && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div>
            <h2 className="font-semibold text-foreground">Create New Admin</h2>
            <p className="text-sm text-muted-foreground">
              New admins receive the default permission matrix for their role.
            </p>
          </div>

          {/* Invite vs. explicit-password mode. Invite is the default and
              recommended path: the new admin sets their own password via an
              emailed single-use link and is forced to rotate on first login. */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="createMode"
                checked={inviteMode}
                onChange={() => setInviteMode(true)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-foreground">Send an invitation</span>
                <span className="block text-xs text-muted-foreground">
                  Emails a single-use set-password link. No password is set by you; the admin
                  chooses their own and is forced to do so on first login.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="createMode"
                checked={!inviteMode}
                onChange={() => setInviteMode(false)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-foreground">Set a temporary password</span>
                <span className="block text-xs text-muted-foreground">
                  You set an initial password and share it out-of-band. Use only when email
                  delivery isn&apos;t available.
                </span>
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              placeholder="First Name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              className={inputCls}
            />
            <input
              placeholder="Last Name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={inputCls}
            />
            {!inviteMode && (
              <input
                type="password"
                placeholder="Temporary password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={12}
                className={inputCls}
                autoComplete="new-password"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputCls + " max-w-[220px]"}
            >
              <option value="VIEWER">Viewer</option>
              <option value="MODERATOR">Moderator</option>
              <option value="ADMIN">Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {inviteMode
                ? "The invitee picks their own password (12+ chars, upper, lower, numeric)."
                : "Passwords must be at least 12 characters and include upper, lower, and numeric characters."}
            </p>
          </div>
          <input
            type="password"
            placeholder="Confirm your admin password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            required
            className={inputCls}
            autoComplete="current-password"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="MFA code"
              value={form.mfaCode}
              onChange={(e) => setForm({ ...form, mfaCode: e.target.value })}
              className={inputCls}
              autoComplete="one-time-code"
            />
            <input
              type="text"
              placeholder="Backup code"
              value={form.backupCode}
              onChange={(e) => setForm({ ...form, backupCode: e.target.value })}
              className={inputCls}
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Admin"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={inputCls + " lg:max-w-[180px]"}
        >
          <option value="ALL">All roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">Admin</option>
          <option value="MODERATOR">Moderator</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={inputCls + " lg:max-w-[180px]"}
        >
          <option value="ALL">All states</option>
          <option value="ACTIVE">Active only</option>
          <option value="INACTIVE">Inactive only</option>
          <option value="MFA">MFA enabled</option>
        </select>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Loading...</div>
        ) : filteredAdmins.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={Users}
              title="No admins match the current filters."
              description="Try adjusting the search, role, or status filters."
            />
          </div>
        ) : (
          filteredAdmins.map((admin) => {
            const RoleIcon = ROLE_ICONS[admin.role] || Eye;
            const elevatedPermissions = admin.permissions.filter(
              (permission) =>
                permission.canCreate || permission.canUpdate || permission.canDelete,
            );

            return (
              <div
                key={admin.id}
                className={`rounded-xl border bg-card p-5 transition-colors ${
                  admin.isActive ? "border-border" : "border-border/50 opacity-75"
                }`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-2.5 ${
                        ROLE_COLORS[admin.role] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      <RoleIcon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">
                          {admin.firstName} {admin.lastName}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            ROLE_COLORS[admin.role] || "bg-muted text-muted-foreground"
                          }`}
                        >
                          {admin.role.replace("_", " ")}
                        </span>
                        {!admin.isActive && (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-medium text-destructive">
                            Inactive
                          </span>
                        )}
                        {admin.mfaEnabled ? (
                          <span className="rounded-full bg-tone-sage-bg px-2.5 py-1 text-[10px] font-medium text-tone-sage-fg">
                            MFA enabled
                          </span>
                        ) : (
                          <span className="rounded-full bg-tone-honey-bg px-2.5 py-1 text-[10px] font-medium text-tone-honey-fg">
                            MFA missing
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{admin.email}</p>
                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                        <span>
                          Last login:{" "}
                          {admin.lastLoginAt
                            ? new Date(admin.lastLoginAt).toLocaleString()
                            : "Never"}
                        </span>
                        <span>Joined {new Date(admin.createdAt).toLocaleDateString()}</span>
                        <span>{admin.activeSessionCount} active session(s)</span>
                        <span>{admin.recentFailedLogins} failed logins in 30d</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => openEdit(admin)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </span>
                    </button>
                    {currentAdminRole === "SUPER_ADMIN" && (
                      <button
                        onClick={() => void toggleActive(admin)}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Power className="h-3.5 w-3.5" />
                          {admin.isActive ? "Deactivate" : "Reactivate"}
                        </span>
                      </button>
                    )}
                    {currentAdminRole === "SUPER_ADMIN" && admin.isActive && (
                      <button
                        onClick={() => {
                          setArchiveTarget(admin);
                          setArchiveError(null);
                        }}
                        className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Archive
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_220px]">
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase text-muted-foreground">
                      Permission coverage
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {elevatedPermissions.length > 0 ? (
                        elevatedPermissions.map((permission) => {
                          const canWrite = permission.canCreate || permission.canUpdate || permission.canDelete;
                          const label = permission.canDelete
                            ? "Full"
                            : canWrite
                              ? "Edit"
                              : "Read";
                          const tone = permission.canDelete
                            ? "bg-destructive/10 text-destructive"
                            : canWrite
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground";
                          return (
                            <span
                              key={permission.resource}
                              title={`Read:${permission.canRead ? "✓" : "·"} Create:${permission.canCreate ? "✓" : "·"} Update:${permission.canUpdate ? "✓" : "·"} Delete:${permission.canDelete ? "✓" : "·"}`}
                              className={`rounded px-2 py-1 text-[10px] font-medium ${tone}`}
                            >
                              {RESOURCE_LABELS[permission.resource] || permission.resource}
                              <span className="ml-1 opacity-70">· {label}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                          Read-only across assigned modules
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-medium uppercase text-muted-foreground">
                      Recent login health
                    </p>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                      <span>{admin.recentSuccessfulLogins} successful logins in 30d</span>
                      <span>{admin.recentFailedLogins} failed logins in 30d</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {editAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4"
          onClick={() => setEditAdmin(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Edit Admin</h2>
                <p className="text-sm text-muted-foreground">
                  Update identity, role, and operational access for {editAdmin.email}
                </p>
              </div>
              <button
                onClick={() => setEditAdmin(null)}
                aria-label="Close"
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    First Name
                  </label>
                  <input
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, firstName: e.target.value })
                    }
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Last Name
                  </label>
                  <input
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm({ ...editForm, lastName: e.target.value })
                    }
                    required
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                    className={inputCls}
                    disabled={currentAdminRole !== "SUPER_ADMIN"}
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="MODERATOR">Moderator</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <KeyRound className="h-3 w-3" /> Reset Password
                </label>
                <input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) =>
                    setEditForm({ ...editForm, newPassword: e.target.value })
                  }
                  minLength={12}
                  placeholder="Leave blank to keep the current password"
                  className={inputCls}
                  disabled={currentAdminRole !== "SUPER_ADMIN"}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Sensitive changes revoke existing admin sessions automatically.
                </p>
              </div>

              {currentAdminRole === "SUPER_ADMIN" && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Confirm your admin password
                    </label>
                    <input
                      type="password"
                      value={editForm.confirmPassword}
                      onChange={(e) =>
                        setEditForm({ ...editForm, confirmPassword: e.target.value })
                      }
                      className={inputCls}
                      autoComplete="current-password"
                      placeholder="Required for sensitive changes"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      MFA code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editForm.mfaCode}
                      onChange={(e) => setEditForm({ ...editForm, mfaCode: e.target.value })}
                      className={inputCls}
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Backup code
                    </label>
                    <input
                      type="text"
                      value={editForm.backupCode}
                      onChange={(e) => setEditForm({ ...editForm, backupCode: e.target.value })}
                      className={inputCls}
                      autoComplete="one-time-code"
                    />
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border bg-background/40">
                <button
                  type="button"
                  onClick={() => setPermissionsOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/20"
                >
                  <div className="flex items-center gap-2">
                    {permissionsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <h3 className="font-medium text-foreground">Permission Matrix</h3>
                      <p className="text-xs text-muted-foreground">
                        {currentAdminRole === "SUPER_ADMIN"
                          ? `${editForm.permissions.filter((p) => p.canCreate || p.canUpdate || p.canDelete).length} resources with write access · expand to edit`
                          : "Permission editing requires a SUPER_ADMIN session."}
                      </p>
                    </div>
                  </div>
                </button>
                {permissionsOpen && (
                  <div className="overflow-x-auto border-t border-border p-4">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Resource</th>
                          <th className="px-3 py-2 font-medium">Read</th>
                          <th className="px-3 py-2 font-medium">Create</th>
                          <th className="px-3 py-2 font-medium">Update</th>
                          <th className="px-3 py-2 font-medium">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortPermissions(editForm.permissions).map((permission) => (
                          <tr key={permission.resource} className="border-b border-border/60">
                            <td className="px-3 py-2 text-foreground">
                              {RESOURCE_LABELS[permission.resource] || permission.resource}
                            </td>
                            {(["canRead", "canCreate", "canUpdate", "canDelete"] as const).map(
                              (field) => (
                                <td key={field} className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={permission[field]}
                                    disabled={currentAdminRole !== "SUPER_ADMIN"}
                                    onChange={(e) =>
                                      updatePermission(
                                        permission.resource,
                                        field,
                                        e.target.checked,
                                      )
                                    }
                                    className="h-4 w-4 rounded border-input"
                                  />
                                </td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditAdmin(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-6 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PasswordConfirmModal
        open={Boolean(archiveTarget)}
        title="Archive Admin"
        description={
          archiveTarget
            ? `Enter your admin password and MFA code or backup code to archive ${archiveTarget.email}. This revokes sessions and retires the login identity.`
            : "Enter your admin password and MFA code or backup code to archive this admin."
        }
        confirmLabel="Archive Admin"
        busy={archiving}
        error={archiveError}
        onClose={() => {
          if (!archiving) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
        onConfirm={confirmArchive}
      />
      <PasswordConfirmModal
        open={Boolean(activeToggleTarget)}
        title={activeToggleTarget?.isActive ? "Deactivate admin" : "Reactivate admin"}
        description={
          activeToggleTarget
            ? `Enter your admin password and MFA code or backup code to ${activeToggleTarget.isActive ? "deactivate" : "reactivate"} ${activeToggleTarget.email}.`
            : "Enter your admin password and MFA code or backup code to update this admin."
        }
        confirmLabel={activeToggleTarget?.isActive ? "Deactivate" : "Reactivate"}
        busy={activeToggleBusy}
        error={activeToggleError}
        onClose={() => {
          if (!activeToggleBusy) {
            setActiveToggleTarget(null);
            setActiveToggleError(null);
          }
        }}
        onConfirm={confirmToggleActive}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
