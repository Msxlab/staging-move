"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Calendar, MapPin, Trash2, Shield, Edit, Save, X, CreditCard, Bell, Loader2, Monitor, Smartphone, Globe, MousePointer, Clock, LifeBuoy, KeyRound, Truck, AlertTriangle, RotateCcw, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PasswordConfirmModal, type StepUpValues } from "@/components/password-confirm-modal";
import { InfoHint } from "@/components/info-hint";
import { maskEmail } from "@/lib/privacy";
import {
  accessSourceLabel,
  effectiveStatusLabel,
  getBillingPlanDefinition,
  getEffectiveEntitlement,
  TRIAL_DURATION_DAYS,
} from "@/lib/shared-billing";

interface AdminApiError {
  message: string;
  requiresMfa: boolean;
}

async function readAdminApiError(response: Response, fallback: string): Promise<AdminApiError> {
  const data = await response.json().catch(() => ({}));
  const requiresMfa = Boolean((data as any)?.requiresMfa);
  const rawMessage = typeof (data as any)?.error === "string" ? (data as any).error : fallback;

  if (response.status === 401) {
    return { message: "Admin session expired. Please sign in again.", requiresMfa };
  }

  if (response.status === 403 && /origin|referer/i.test(rawMessage)) {
    return {
      message: "Request blocked by admin security checks. Refresh the admin page and retry from the same host.",
      requiresMfa,
    };
  }

  if (response.status === 403 && rawMessage === "Forbidden") {
    return {
      message: "Your admin account does not have permission to perform this action.",
      requiresMfa,
    };
  }

  if (requiresMfa && response.status === 403) {
    return {
      message: "MFA is required for this operation. Add an authenticator code or backup code and retry.",
      requiresMfa,
    };
  }

  return { message: rawMessage, requiresMfa };
}

function hasRawProviderIdentifier(value: string | null | undefined) {
  return Boolean(value && !value.includes("****"));
}

// Tabs for the user-detail page. The header + stat cards stay always-visible
// above the tab bar; every content section below is assigned to one tab and
// hidden when its tab isn't active, so the page stops being one long scroll.
type UserDetailTab = "overview" | "billing" | "security" | "privacy" | "data";
const USER_DETAIL_TABS: { key: UserDetailTab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: Sparkles },
  { key: "billing", label: "Subscription", icon: CreditCard },
  { key: "security", label: "Security", icon: KeyRound },
  { key: "privacy", label: "Privacy & GDPR", icon: Shield },
  { key: "data", label: "Data", icon: Monitor },
];

export default function UserDetailClient() {
  const params = useParams();
  const [user, setUser] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginSessions, setLoginSessions] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [eventCounts, setEventCounts] = useState<any[]>([]);
  const [pushDevices, setPushDevices] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [gdprRequests, setGdprRequests] = useState<any[]>([]);
  const [adminNotes, setAdminNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProfileConfirm, setShowProfileConfirm] = useState(false);
  const [profileConfirmError, setProfileConfirmError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", plan: "" });
  const [changingPlan, setChangingPlan] = useState(false);
  const [premiumForm, setPremiumForm] = useState({
    subscriptionStatus: "", accessType: "", premiumUntil: "", trialEndsAt: "", freeAccessEndsAt: "", premiumNote: "", cancelAtPeriodEnd: false, autoRenew: false,
  });
  const [savingPremium, setSavingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [newAdminNote, setNewAdminNote] = useState("");
  const [savingAdminNote, setSavingAdminNote] = useState(false);
  const [revokingLoginSessions, setRevokingLoginSessions] = useState(false);
  const [pendingLoginSessionRevoke, setPendingLoginSessionRevoke] = useState<{ sessionId?: string } | null>(null);
  const [loginSessionRevokeError, setLoginSessionRevokeError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<"cancel_trial" | "cancel_renewal" | "resume_renewal" | null>(null);
  const [planConfirmError, setPlanConfirmError] = useState<string | null>(null);
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null);
  const [subscriptionActionBusy, setSubscriptionActionBusy] = useState(false);
  const [showPremiumConfirm, setShowPremiumConfirm] = useState(false);
  const [premiumConfirmError, setPremiumConfirmError] = useState<string | null>(null);
  const [grantPresetMonths, setGrantPresetMonths] = useState<number | "custom">(1);
  const [grantCustomDate, setGrantCustomDate] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [pendingGrantAction, setPendingGrantAction] = useState<"grant" | "revoke" | null>(null);
  const [grantActionError, setGrantActionError] = useState<string | null>(null);
  const [grantActionRequiresMfa, setGrantActionRequiresMfa] = useState(false);
  const [grantActionBusy, setGrantActionBusy] = useState(false);
  const [advancedBillingOpen, setAdvancedBillingOpen] = useState(false);
  const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<UserDetailTab>("overview");
  // A section is shown only when its tab is active. Keeps every section in
  // place (no JSX reordering) while collapsing the page to one tab at a time.
  const sectionCls = (tab: UserDetailTab) =>
    `rounded-xl border border-border bg-card p-6${activeTab === tab ? "" : " hidden"}`;
  // Per-modal flag: server returned `requiresMfa: true` last attempt, so
  // the PasswordConfirmModal should mark the MFA field as required and
  // refuse to submit until the operator fills one of MFA / backup code.
  const [profileRequiresMfa, setProfileRequiresMfa] = useState(false);
  const [loginSessionRevokeRequiresMfa, setLoginSessionRevokeRequiresMfa] = useState(false);
  const [deleteRequiresMfa, setDeleteRequiresMfa] = useState(false);
  const [restoreRequiresMfa, setRestoreRequiresMfa] = useState(false);
  const [planRequiresMfa, setPlanRequiresMfa] = useState(false);
  const [subscriptionActionRequiresMfa, setSubscriptionActionRequiresMfa] = useState(false);
  const [premiumRequiresMfa, setPremiumRequiresMfa] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentAdminRole(typeof data?.admin?.role === "string" ? data.admin.role : null))
      .catch(() => null);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/users/${params.id}`);
        if (!res.ok) { toast.error("User not found"); window.location.assign("/users"); return; }
        const data = await res.json();
        setUser(data.user);
        setAuditLogs(data.auditLogs || []);
        setSessions(data.sessions || []);
        setLoginSessions(data.loginSessions || []);
        setRecentEvents(data.recentEvents || []);
        setEventCounts(data.eventCounts || []);
        setPushDevices(data.pushDevices || []);
        setSupportTickets(data.user?.supportTickets || []);
        setGdprRequests(data.gdprRequests || []);
        setAdminNotes(data.adminNotes || []);
        if (data.user) {
          setEditForm({
            firstName: data.user.firstName || "",
            lastName: data.user.lastName || "",
            plan: data.user.subscription?.plan || "FREE_TRIAL",
          });
          setPremiumForm({
            subscriptionStatus: data.user.subscription?.status || "TRIALING",
            accessType: data.user.subscription?.accessType || "",
            premiumUntil: data.user.subscription?.premiumUntil ? new Date(data.user.subscription.premiumUntil).toISOString().slice(0, 10) : "",
            trialEndsAt: data.user.subscription?.trialEndsAt ? new Date(data.user.subscription.trialEndsAt).toISOString().slice(0, 10) : "",
            freeAccessEndsAt: data.user.subscription?.freeAccessEndsAt ? new Date(data.user.subscription.freeAccessEndsAt).toISOString().slice(0, 10) : "",
            premiumNote: data.user.subscription?.premiumNote || "",
            cancelAtPeriodEnd: Boolean(data.user.subscription?.cancelAtPeriodEnd),
            autoRenew: Boolean(data.user.subscription?.autoRenew),
          });
        }
      } catch { toast.error("Failed to load user"); }
      finally { setLoading(false); }
    }
    load();
  }, [params.id]);

  async function handleDelete() {
    if (!user) return;
    setDeleteError(null);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUp),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to delete");
        setDeleteError(message);
        setDeleteRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      toast.success(data.message || "User deleted");
      setShowDeleteConfirm(false);
      setDeleteRequiresMfa(false);
      window.location.assign("/users");
    } catch {
      setDeleteError("Failed to delete user");
      toast.error("Failed to delete user");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleRestore() {
    if (!user?.deletedAt) return;
    setRestoreError(null);
    setShowRestoreConfirm(true);
  }

  async function confirmRestore(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user) return;
    setRestoreBusy(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_user", ...stepUp }),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to restore user");
        setRestoreError(message);
        setRestoreRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setUser({ ...user, deletedAt: null });
      if (data.requestId) {
        setGdprRequests((prev) =>
          prev.map((request: any) =>
            request.id === data.requestId
              ? { ...request, status: "REJECTED", completedAt: new Date().toISOString() }
              : request,
          ),
        );
      }
      setShowRestoreConfirm(false);
      setRestoreRequiresMfa(false);
      toast.success(data.message || "User restored");
    } catch {
      setRestoreError("Failed to restore user");
      toast.error("Failed to restore user");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function confirmPlanChange(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user || !pendingPlan) return;
    setChangingPlan(true);
    setPlanConfirmError(null);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: pendingPlan, ...stepUp }),
      });
      if (res.ok) {
        setEditForm({ ...editForm, plan: pendingPlan });
        setUser({ ...user, subscription: { ...user.subscription, plan: pendingPlan } });
        toast.success(`Plan changed to ${pendingPlan}`);
        setPendingPlan(null);
        setPlanRequiresMfa(false);
      } else {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to change plan.");
        setPlanConfirmError(message);
        setPlanRequiresMfa(requiresMfa);
        toast.error(message);
      }
    } catch {
      setPlanConfirmError("Failed to change plan.");
      toast.error("Failed to change plan.");
    } finally {
      setChangingPlan(false);
    }
  }

  async function confirmSubscriptionAction(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user || !pendingSubscriptionAction) return;
    setSubscriptionActionBusy(true);
    setSubscriptionActionError(null);
    try {
      const res = await fetch(`/api/users/${params.id}/subscription-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingSubscriptionAction, ...stepUp }),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to update subscription.");
        setSubscriptionActionError(message);
        setSubscriptionActionRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setUser({ ...user, subscription: data.subscription });
      setPremiumForm({
        ...premiumForm,
        subscriptionStatus: data.subscription?.status || premiumForm.subscriptionStatus,
        cancelAtPeriodEnd: Boolean(data.subscription?.cancelAtPeriodEnd),
        autoRenew: Boolean(data.subscription?.autoRenew),
      });
      setPendingSubscriptionAction(null);
      setSubscriptionActionRequiresMfa(false);
      toast.success("Subscription action completed.");
    } catch {
      setSubscriptionActionError("Failed to update subscription.");
      toast.error("Failed to update subscription.");
    } finally {
      setSubscriptionActionBusy(false);
    }
  }

  async function confirmPremiumUpdate(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user) return;
    setSavingPremium(true);
    setPremiumError(null);
    setPremiumConfirmError(null);
    try {
      const payload: any = {
        subscriptionStatus: premiumForm.subscriptionStatus,
        accessType: premiumForm.accessType || null,
        cancelAtPeriodEnd: premiumForm.cancelAtPeriodEnd,
        autoRenew: premiumForm.autoRenew,
        premiumNote: premiumForm.premiumNote,
        ...stepUp,
      };
      if (premiumForm.premiumUntil) payload.premiumUntil = premiumForm.premiumUntil;
      else payload.premiumUntil = null;
      if (premiumForm.trialEndsAt) payload.trialEndsAt = premiumForm.trialEndsAt;
      else payload.trialEndsAt = null;
      if (premiumForm.freeAccessEndsAt) payload.freeAccessEndsAt = premiumForm.freeAccessEndsAt;
      else payload.freeAccessEndsAt = null;
      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setUser({
          ...user,
          subscription: {
            ...user.subscription,
            status: premiumForm.subscriptionStatus,
            accessType: premiumForm.accessType || null,
            premiumUntil: premiumForm.premiumUntil || null,
            trialEndsAt: premiumForm.trialEndsAt || null,
            freeAccessEndsAt: premiumForm.freeAccessEndsAt || null,
            cancelAtPeriodEnd: premiumForm.cancelAtPeriodEnd,
            autoRenew: premiumForm.autoRenew,
            premiumNote: premiumForm.premiumNote,
            premiumGrantedAt: new Date().toISOString(),
          },
        });
        setShowPremiumConfirm(false);
        setPremiumRequiresMfa(false);
        toast.success("Premium settings updated");
      } else {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to update premium settings.");
        setPremiumError(message);
        setPremiumConfirmError(message);
        setPremiumRequiresMfa(requiresMfa);
        toast.error(message);
      }
    } catch {
      setPremiumError("Failed to update premium settings.");
      setPremiumConfirmError("Failed to update premium settings.");
      toast.error("Failed to update premium settings.");
    } finally {
      setSavingPremium(false);
    }
  }

  async function confirmGrantPremiumAction(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user || !pendingGrantAction) return;
    setGrantActionBusy(true);
    setGrantActionError(null);
    try {
      let payload: any = { ...stepUp };
      if (pendingGrantAction === "grant") {
        let untilIso = "";
        if (grantPresetMonths === "custom") {
          if (!grantCustomDate) {
            setGrantActionError("Pick a custom expiry date.");
            setGrantActionBusy(false);
            return;
          }
          untilIso = grantCustomDate;
        } else {
          const d = new Date();
          d.setMonth(d.getMonth() + grantPresetMonths);
          untilIso = d.toISOString().slice(0, 10);
        }
        // Minimum safe payload for an admin manual grant. Backend auto-flips
        // provider→ADMIN (route.ts:1016-1022) when premiumUntil is sent and
        // provider isn't explicit, then validates accessType≠PAID against
        // ADMIN (route.ts:243-245), so we send accessType=null.
        payload = {
          ...payload,
          plan: "INDIVIDUAL",
          subscriptionStatus: "ACTIVE",
          accessType: null,
          premiumUntil: untilIso,
          trialEndsAt: null,
          freeAccessEndsAt: null,
          autoRenew: false,
          cancelAtPeriodEnd: true,
          premiumNote: grantReason || null,
        };
      } else {
        const freeAccessUntil = new Date();
        freeAccessUntil.setDate(freeAccessUntil.getDate() + TRIAL_DURATION_DAYS);
        // Revoke: clear admin grant and drop the user back to default free
        // access. Only safe when current provider is ADMIN (not Stripe/App
        // Store/Play Store) — the UI hides this button otherwise.
        payload = {
          ...payload,
          plan: "FREE_TRIAL",
          subscriptionStatus: "FREE_ACCESS",
          provider: "TRIAL",
          accessType: "FREE_ACCESS",
          premiumUntil: null,
          freeAccessEndsAt: freeAccessUntil.toISOString().slice(0, 10),
          trialEndsAt: null,
          autoRenew: false,
          cancelAtPeriodEnd: false,
          premiumNote: grantReason || null,
        };
      }
      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to update premium access.");
        setGrantActionError(message);
        setGrantActionRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      // Refetch the user so the Effective Access summary, raw subscription
      // row, and the Advanced form all reflect the post-write state from
      // a single source of truth.
      const refetch = await fetch(`/api/users/${params.id}`);
      if (refetch.ok) {
        const data = await refetch.json();
        setUser(data.user);
        const sub = data.user?.subscription || {};
        setPremiumForm({
          subscriptionStatus: sub.status || "",
          accessType: sub.accessType || "",
          premiumUntil: sub.premiumUntil ? new Date(sub.premiumUntil).toISOString().slice(0, 10) : "",
          trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString().slice(0, 10) : "",
          freeAccessEndsAt: sub.freeAccessEndsAt ? new Date(sub.freeAccessEndsAt).toISOString().slice(0, 10) : "",
          premiumNote: sub.premiumNote || "",
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          autoRenew: Boolean(sub.autoRenew),
        });
      }
      setPendingGrantAction(null);
      setGrantActionRequiresMfa(false);
      setGrantReason("");
      toast.success(pendingGrantAction === "grant" ? "Premium granted" : "Premium revoked");
    } catch {
      setGrantActionError("Failed to update premium access.");
      toast.error("Failed to update premium access.");
    } finally {
      setGrantActionBusy(false);
    }
  }

  async function confirmProfileUpdate(_confirmPassword: string, stepUp: StepUpValues) {
    if (!user) return;
    setSaving(true);
    setProfileConfirmError(null);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          ...stepUp,
        }),
      });
      if (res.ok) {
        setUser({ ...user, firstName: editForm.firstName, lastName: editForm.lastName });
        toast.success("User updated");
        setEditing(false);
        setShowProfileConfirm(false);
        setProfileRequiresMfa(false);
      } else {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to update user.");
        setProfileConfirmError(message);
        setProfileRequiresMfa(requiresMfa);
        toast.error(message);
      }
    } catch {
      setProfileConfirmError("Failed to update user.");
      toast.error("Failed to update user.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAdminNote() {
    if (!newAdminNote.trim()) {
      toast.error("Enter a note before saving.");
      return;
    }

    setSavingAdminNote(true);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_note", note: newAdminNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to save note.");
        return;
      }
      setAdminNotes((prev) => [data.note, ...prev]);
      setNewAdminNote("");
      toast.success("Admin note added.");
    } catch {
      toast.error("Failed to save note.");
    } finally {
      setSavingAdminNote(false);
    }
  }

  async function handleRevokeLoginSessions(sessionId?: string) {
    setLoginSessionRevokeError(null);
    setPendingLoginSessionRevoke({ sessionId });
  }

  async function confirmRevokeLoginSessions(_confirmPassword: string, stepUp: StepUpValues) {
    const sessionId = pendingLoginSessionRevoke?.sessionId;
    setRevokingLoginSessions(true);
    setLoginSessionRevokeError(null);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sessionId
            ? { action: "revoke_login_session", sessionId, ...stepUp }
            : { action: "revoke_all_login_sessions", ...stepUp },
        ),
      });
      if (!res.ok) {
        const { message, requiresMfa } = await readAdminApiError(res, "Failed to revoke login session.");
        setLoginSessionRevokeError(message);
        setLoginSessionRevokeRequiresMfa(requiresMfa);
        toast.error(message);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setLoginSessions((prev) =>
        prev.map((session: any) =>
          !sessionId || session.id === sessionId
            ? { ...session, isActive: false, lastActivity: new Date().toISOString() }
            : session,
        ),
      );
      toast.success(
        sessionId ? "Login session revoked." : `${data.revoked || 0} login sessions revoked.`,
      );
      setPendingLoginSessionRevoke(null);
      setLoginSessionRevokeRequiresMfa(false);
    } catch {
      setLoginSessionRevokeError("Failed to revoke login sessions.");
      toast.error("Failed to revoke login sessions.");
    } finally {
      setRevokingLoginSessions(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;
  if (!user) return <div className="py-12 text-center text-muted-foreground">User not found</div>;

  const isDeleted = Boolean(user.deletedAt);
  const addressList = user.addresses || [];
  const movingPlans = user.movingPlans || [];
  const moveTasks = user.moveTasks || [];
  const customProviders = user.customProviders || [];
  const openMoveTasks = moveTasks.filter((task: any) => !["COMPLETED", "DISMISSED"].includes(task.status));
  const lowConfidenceMoveTasks = moveTasks.filter((task: any) => ["LOW", "UNVERIFIED"].includes(task.confidence));
  const primaryAddress = addressList.find((addr: any) => addr.isPrimary) || addressList[0] || null;
  const totalServices = addressList.reduce((sum: number, addr: any) => sum + (addr.services?.length || 0), 0);
  const activeMove = movingPlans.find((plan: any) => plan.status === "IN_PROGRESS" || plan.status === "PLANNING") || movingPlans[0] || null;
  const serviceCountByAddressId = new Map<string, number>(
    addressList.map((addr: any): [string, number] => [addr.id, addr.services?.length || 0]),
  );
  const activeMoveOriginServices: number = activeMove?.fromAddress?.id
    ? serviceCountByAddressId.get(activeMove.fromAddress.id) || 0
    : 0;
  const activeMoveDestinationServices: number = activeMove?.toAddress?.id
    ? serviceCountByAddressId.get(activeMove.toAddress.id) || 0
    : 0;
  const activeMoveIsInterstate = Boolean(
    activeMove?.fromAddress?.state &&
    activeMove?.toAddress?.state &&
    activeMove.fromAddress.state !== activeMove.toAddress.state,
  );
  const lastSession = sessions[0] || null;
  const lastLoginSession = loginSessions[0] || null;
  const lastSeenAt = lastSession?.lastActivity || lastSession?.sessionStart || recentEvents[0]?.createdAt || null;
  const daysSinceLastSeen = lastSeenAt
    ? Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const linkedProviders = Array.isArray(user.oauthAccounts) ? user.oauthAccounts : [];
  const activeLoginSessions = loginSessions.filter((session: any) => session.isActive);
  const hasPasswordLogin = Boolean(user.hasPasswordLogin);
  const latestVerificationToken = user.emailVerificationTokens?.[0] || null;
  const latestPasswordReset = user.passwordResetTokens?.[0] || null;
  const latestConsentByCategory = buildLatestConsentEntries(user.dataConsents || []);
  const onboardingChecks = [
    { label: "Profile", complete: !!user.profile, detail: user.profile ? user.profile.moveType || "Profile saved" : "Missing" },
    { label: "Primary address", complete: !!primaryAddress, detail: primaryAddress ? `${primaryAddress.city}, ${primaryAddress.state}` : "Missing" },
    { label: "Service setup", complete: totalServices > 0, detail: totalServices > 0 ? `${totalServices} active service${totalServices === 1 ? "" : "s"}` : "No services" },
    { label: "Moving plan", complete: !!activeMove, detail: activeMove ? `${activeMove.fromAddress?.state || "—"} → ${activeMove.toAddress?.state || "—"}` : "No move plan" },
  ];
  const onboardingCompletedCount = onboardingChecks.filter((step) => step.complete).length;
  const onboardingStatus = onboardingCompletedCount === 0
    ? "Not Started"
    : onboardingCompletedCount === onboardingChecks.length
      ? "Complete"
      : "In Progress";
  const authHealth = !lastSeenAt
    ? { label: "No Activity Yet", tone: "text-tone-honey-fg", badge: "bg-tone-honey-bg text-tone-honey-fg" }
    : daysSinceLastSeen !== null && daysSinceLastSeen <= 1
      ? { label: "Healthy", tone: "text-tone-sage-fg", badge: "bg-tone-sage-bg text-tone-sage-fg" }
      : daysSinceLastSeen !== null && daysSinceLastSeen <= 7
        ? { label: "Idle", tone: "text-tone-honey-fg", badge: "bg-tone-honey-bg text-tone-honey-fg" }
        : { label: "Stale", tone: "text-destructive", badge: "bg-destructive/10 text-destructive" };
  const supportFlags = [
    !user.profile ? "User has not created a profile yet." : null,
    !primaryAddress ? "No primary address is available." : null,
    totalServices === 0 ? "No services have been added yet." : null,
    activeMove && totalServices === 0 ? "Move is planned but service setup has not started." : null,
    openMoveTasks.length > 0 ? `${openMoveTasks.length} move task${openMoveTasks.length === 1 ? "" : "s"} still open.` : null,
    lowConfidenceMoveTasks.length > 0 ? `${lowConfidenceMoveTasks.length} low-confidence move task${lowConfidenceMoveTasks.length === 1 ? "" : "s"} need caveated support guidance.` : null,
    customProviders.some((provider: any) => provider.adminReviewStatus !== "REVIEWED")
      ? "User-created provider records include unreviewed entries."
      : null,
    !lastSeenAt ? "No tracked session or behavior activity yet." : null,
    daysSinceLastSeen !== null && daysSinceLastSeen > 14 ? `Last activity is ${daysSinceLastSeen} days old.` : null,
  ].filter(Boolean) as string[];
  const supportTimeline = [
    ...sessions.slice(0, 8).map((session: any) => ({
      id: `session-${session.id}`,
      type: "Session",
      title: `${session.isActive ? "Active" : "Ended"} ${session.platform || session.deviceType || "session"}`,
      detail: `${session.browser || "Unknown browser"}${session.os ? ` · ${session.os}` : ""}${session.ipAddress ? ` · ${session.ipAddress}` : ""}`,
      timestamp: session.lastActivity || session.sessionStart,
      badge: session.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground",
    })),
    ...recentEvents.slice(0, 12).map((event: any) => ({
      id: `event-${event.id}`,
      type: "Event",
      title: event.event,
      detail: event.page || event.label || event.element || "Tracked user event",
      timestamp: event.createdAt,
      badge: event.event === "LOGIN" ? "bg-tone-sage-bg text-tone-sage-fg" : event.event === "SEARCH" ? "bg-tone-honey-bg text-tone-honey-fg" : "bg-tone-sky-bg text-tone-sky-fg",
    })),
    ...auditLogs.slice(0, 8).map((log: any) => ({
      id: `audit-${log.id}`,
      type: "Admin",
      title: log.action,
      detail: log.entityType || "Admin update",
      timestamp: log.createdAt,
      badge: "bg-tone-foil-bg text-tone-foil-fg",
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);

  return (
    <div className="space-y-6">
      <button onClick={() => window.location.assign("/users")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {editing ? (
            <div className="flex items-center gap-3">
              <input
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                placeholder="First name"
              />
              <input
                className="rounded-lg border border-input bg-background px-3 py-1.5 text-xl font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={editForm.lastName}
                onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                placeholder="Last name"
              />
              <button
                onClick={() => {
                  setProfileConfirmError(null);
                  setShowProfileConfirm(true);
                }}
                disabled={saving}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
              <button onClick={() => setEditing(false)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{user.firstName} {user.lastName}</h1>
              {isDeleted && (
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  Blocked / Deleted
                </span>
              )}
              {!isDeleted && (
                <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Edit name">
                  <Edit className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {user.email}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            {isDeleted && (
              <span className="flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Blocked / deleted {new Date(user.deletedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Plan Change */}
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <select
              value={editForm.plan}
              onChange={(e) => {
                const newPlan = e.target.value;
                if (newPlan === editForm.plan) return;
                setPendingPlan(newPlan);
                setPlanConfirmError(null);
              }}
              disabled={changingPlan || isDeleted}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="FREE_TRIAL">Free Trial</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>
          {isDeleted ? (
            currentAdminRole === "SUPER_ADMIN" ? (
              <button onClick={handleRestore} className="flex items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10">
                <RotateCcw className="h-4 w-4" /> Restore / Unblock
              </button>
            ) : (
              <span
                className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground"
                title="Restoring a deleted user requires SUPER_ADMIN."
              >
                <RotateCcw className="h-4 w-4 opacity-60" /> SUPER_ADMIN only
              </span>
            )
          ) : (
            <button onClick={handleDelete} className="flex items-center gap-2 rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {isDeleted && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">This account is blocked by soft deletion.</p>
            <p className="mt-1 text-xs text-destructive/90">
              OAuth and password login remain blocked until a SUPER_ADMIN restores/unblocks it. Existing sessions stay revoked after restore.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {(() => {
        const eff = getEffectiveEntitlement(user.subscription || null);
        const expires = eff.expiresAt ? new Date(eff.expiresAt).toLocaleDateString() : null;
        const planLabel = effectiveStatusLabel(eff.effectiveStatus);
        const planDetail = expires ? `Expires ${expires}` : accessSourceLabel(eff.accessSource);
        return (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard
              label="Plan"
              value={planLabel}
              detail={planDetail}
              accent={eff.hasPremium ? "sage" : eff.hasAccess ? undefined : "honey"}
            />
            <StatCard label="Addresses" value={user.addresses?.length || 0} />
            <StatCard label="Moving Plans" value={user.movingPlans?.length || 0} />
            <StatCard label="Move Tasks" value={moveTasks.length} />
            <StatCard label="Custom Providers" value={customProviders.length} />
            <StatCard label="Push Devices" value={pushDevices.length} />
          </div>
        );
      })()}

      {/* Section tabs — collapse the long detail page to one group at a time. */}
      <div className="flex flex-wrap gap-1 border-b border-border" role="tablist" aria-label="User detail sections">
        {USER_DETAIL_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className={sectionCls("overview")}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            <Shield className="mr-2 inline h-5 w-5" /> Onboarding & Auth Health
          </h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${authHealth.badge}`}>{authHealth.label}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Onboarding</p>
            <p className="text-lg font-semibold text-foreground">{onboardingStatus}</p>
            <p className="text-xs text-muted-foreground">{onboardingCompletedCount}/{onboardingChecks.length} milestones</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Last Seen</p>
            <p className="text-lg font-semibold text-foreground">{lastSeenAt ? new Date(lastSeenAt).toLocaleDateString() : "Never"}</p>
            <p className="text-xs text-muted-foreground">{daysSinceLastSeen === null ? "No session data" : `${daysSinceLastSeen} day(s) ago`}</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-4">
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">Tracked Activity</p>
            <p className="text-lg font-semibold text-foreground">{recentEvents.length}</p>
            <p className="text-xs text-muted-foreground">{sessions.filter((session: any) => session.isActive).length} active session(s)</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-2">
            {onboardingChecks.map((step) => (
              <div key={step.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${step.complete ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>
                  {step.complete ? "Ready" : "Needs attention"}
                </span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Support Flags</p>
            {supportFlags.length > 0 ? (
              <div className="space-y-2">
                {supportFlags.map((flag) => (
                  <div key={flag} className="rounded-lg bg-tone-honey-bg px-3 py-2 text-sm text-tone-honey-fg">{flag}</div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No obvious onboarding or auth blockers detected.</p>
            )}
          </div>
        </div>
      </div>

      <div className={sectionCls("security")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            <KeyRound className="mr-2 inline h-5 w-5" /> Account Security & Access
          </h2>
          <button
            onClick={() => handleRevokeLoginSessions()}
            disabled={revokingLoginSessions || activeLoginSessions.length === 0}
            className="rounded-lg border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {revokingLoginSessions ? "Revoking..." : "Revoke All Login Sessions"}
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <InfoCard label="Email Verified" value={user.emailVerifiedAt ? "Verified" : "Pending"} />
          <InfoCard label="Password Login" value={hasPasswordLogin ? "Enabled" : "OAuth Only"} />
          <InfoCard label="MFA" value={user.mfaEnabled ? "Enabled" : "Off"} />
          <InfoCard label="Linked Providers" value={linkedProviders.length} />
          <InfoCard label="Active Login Sessions" value={activeLoginSessions.length} />
          <InfoCard label="Locale" value={user.preferredLocale || "System"} />
          <InfoCard label="Budget UI" value={user.showBudget === false ? "Hidden" : "Visible"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Linked Sign-In Methods</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${hasPasswordLogin ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground"}`}>
                  Password
                </span>
                {linkedProviders.map((account: any) => (
                  <span key={account.id} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {formatAuthProvider(account.provider)}
                  </span>
                ))}
                {linkedProviders.length === 0 && !hasPasswordLogin && (
                  <span className="rounded-full bg-tone-honey-bg px-2.5 py-1 text-xs font-medium text-tone-honey-fg">
                    No sign-in method found
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {linkedProviders.map((account: any) => (
                  <div key={account.id} className="rounded-lg bg-background/70 px-3 py-2">
                    <p className="font-medium text-foreground">{formatAuthProvider(account.provider)}</p>
                    <p className="text-xs text-muted-foreground">
                      Linked {new Date(account.createdAt).toLocaleString()} · ID {account.providerIdHint || "—"}
                    </p>
                  </div>
                ))}
                {linkedProviders.length === 0 && (
                  <p className="text-sm text-muted-foreground">No OAuth provider is linked to this account yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Verification & Recovery</p>
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">
                    Email verification
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.emailVerifiedAt
                      ? `Verified on ${new Date(user.emailVerifiedAt).toLocaleString()}`
                      : latestVerificationToken
                        ? `Latest token ${new Date(latestVerificationToken.createdAt).toLocaleString()} · ${latestVerificationToken.consumedAt ? "Consumed" : "Pending"}`
                        : "No verification token activity recorded"}
                  </p>
                </div>
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">
                    Password reset
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestPasswordReset
                      ? `Latest token ${new Date(latestPasswordReset.createdAt).toLocaleString()} · ${latestPasswordReset.usedAt ? "Used" : "Unused"}`
                      : "No password reset activity recorded"}
                  </p>
                </div>
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <p className="font-medium text-foreground">
                    Latest authenticated login
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastLoginSession
                      ? `${new Date(lastLoginSession.lastActivity || lastLoginSession.createdAt).toLocaleString()} · ${lastLoginSession.browser || "Unknown browser"}${lastLoginSession.os ? ` / ${lastLoginSession.os}` : ""}`
                      : "No login-session record found"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-3">User Login Sessions</p>
            {loginSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No authenticated login sessions found for this user.</p>
            ) : (
              <div className="space-y-2">
                {loginSessions.map((session: any) => (
                  <div key={session.id} className="rounded-lg bg-background/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${session.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground"}`}>
                            {session.isActive ? "Active" : "Revoked"}
                          </span>
                          {session.impersonatedByAdminId && (
                            <span className="rounded-full bg-tone-honey-bg px-2 py-0.5 text-[10px] font-medium text-tone-honey-fg">
                              Impersonated
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {session.browser || "Unknown browser"}{session.os ? ` / ${session.os}` : ""}{session.deviceType ? ` · ${session.deviceType}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.ipAddress || "No IP"} · Created {new Date(session.createdAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last activity {new Date(session.lastActivity).toLocaleString()} · Expires {new Date(session.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      {session.isActive && (
                        <button
                          onClick={() => handleRevokeLoginSessions(session.id)}
                          disabled={revokingLoginSessions}
                          className="shrink-0 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={sectionCls("privacy")}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          <Shield className="mr-2 inline h-5 w-5" /> Privacy, GDPR & Admin Notes
        </h2>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Current Consent State</p>
              {latestConsentByCategory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consent history recorded yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {latestConsentByCategory.map((entry: any) => (
                    <span
                      key={`${entry.category}-${entry.createdAt}`}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.granted ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-muted text-muted-foreground"}`}
                    >
                      {formatConsentCategory(entry.category)}: {entry.granted ? "Granted" : "Off"}
                    </span>
                  ))}
                </div>
              )}
              {user.dataConsents?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {user.dataConsents.slice(0, 6).map((entry: any) => (
                    <div key={entry.id} className="rounded-lg bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      {formatConsentCategory(entry.category)} · {entry.granted ? "Granted" : "Revoked"} · {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-3">GDPR Requests</p>
              {gdprRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No GDPR export/delete/rectify requests on record.</p>
              ) : (
                <div className="space-y-2">
                  {gdprRequests.map((request: any) => (
                    <div key={request.id} className="rounded-lg bg-background/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{request.type}</p>
                          <p className="text-xs text-muted-foreground">
                            Requested {new Date(request.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          request.status === "COMPLETED"
                            ? "bg-tone-sage-bg text-tone-sage-fg"
                            : request.status === "REJECTED"
                              ? "bg-destructive/10 text-destructive"
                              : request.status === "PROCESSING"
                                ? "bg-tone-sky-bg text-tone-sky-fg"
                                : "bg-tone-honey-bg text-tone-honey-fg"
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      {request.completedAt && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Completed {new Date(request.completedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-3">Admin Notes</p>
            <div className="space-y-3">
              <textarea
                value={newAdminNote}
                onChange={(event) => setNewAdminNote(event.target.value)}
                rows={4}
                placeholder="Add an internal note for support, trust/safety, or ops handoff..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleAddAdminNote}
                  disabled={savingAdminNote || !newAdminNote.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingAdminNote ? "Saving..." : "Add Note"}
                </button>
              </div>
              <div className="space-y-2">
                {adminNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No internal notes yet.</p>
                ) : (
                  adminNotes.map((note: any) => (
                    <div key={note.id} className="rounded-lg bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          {note.adminUser?.firstName} {note.adminUser?.lastName}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {extractAdminNote(note)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {supportTimeline.length > 0 && (
        <div className={sectionCls("overview")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <Bell className="mr-2 inline h-5 w-5" /> Support Timeline
          </h2>
          <div className="space-y-2">
            {supportTimeline.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entry.badge}`}>{entry.type}</span>
                    <span className="font-medium text-foreground">{entry.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Premium Management */}
      <div className={sectionCls("billing")}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          <CreditCard className="mr-2 inline h-5 w-5" /> Subscription & Premium
        </h2>
        {(() => {
          const eff = getEffectiveEntitlement(user.subscription || null);
          const expires = eff.expiresAt
            ? new Date(eff.expiresAt).toLocaleDateString()
            : "—";
          return (
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-border bg-muted/30 p-4">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Effective Access</p>
                <p className={`mt-1 text-sm font-semibold ${eff.hasPremium ? "text-tone-sage-fg" : eff.hasAccess ? "text-foreground" : "text-destructive"}`}>
                  {effectiveStatusLabel(eff.effectiveStatus)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Plan tier: {getBillingPlanDefinition(eff.effectivePlan).displayName}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Source</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{accessSourceLabel(eff.accessSource)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Manual override: {eff.isManualOverride ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Expires</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{expires}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Auto-renewal: {eff.autoRenew ? "On" : "Off"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Raw fields</p>
                <p className="mt-1 text-xs text-foreground">
                  {(user.subscription?.status || "—")} / {(user.subscription?.provider || "—")} / {(user.subscription?.accessType || "—")}
                </p>
                {eff.warnings.length > 0 && (
                  <div className="mt-1 flex items-start gap-1 text-[11px] text-tone-honey-fg">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{eff.warnings[0]}{eff.warnings.length > 1 ? ` (+${eff.warnings.length - 1} more)` : ""}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {(() => {
          const hasStripeSub = hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId);
          const currentProvider = user.subscription?.provider || null;
          const isAdminGrant = currentProvider === "ADMIN";
          // Revoke is only safe when current provider is ADMIN. For Stripe/IAP
          // users we hide it and steer the admin to the provider-native flow
          // (Cancel renewal below).
          const canRevoke = isAdminGrant && (user.subscription?.premiumUntil || user.subscription?.status === "ACTIVE");
          const previewIso = (() => {
            if (grantPresetMonths === "custom") return grantCustomDate || "";
            const d = new Date();
            d.setMonth(d.getMonth() + grantPresetMonths);
            return d.toISOString().slice(0, 10);
          })();
          const previewLabel = previewIso ? new Date(previewIso + "T00:00:00").toLocaleDateString() : "—";
          return (
            <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Grant Premium Access</h3>
              </div>
              {hasStripeSub && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-tone-honey-bg bg-tone-honey-bg/50 px-3 py-2 text-xs text-tone-honey-fg">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    User has an active Stripe subscription. Manual grant overrides it locally; the next Stripe webhook may re-sync. Prefer Stripe-side actions for paying customers.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Duration</label>
                  <select
                    value={String(grantPresetMonths)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGrantPresetMonths(v === "custom" ? "custom" : Number(v));
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">1 year</option>
                    <option value="custom">Custom date…</option>
                  </select>
                </div>
                {grantPresetMonths === "custom" ? (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Expiry date</label>
                    <input
                      type="date"
                      value={grantCustomDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setGrantCustomDate(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Expires on</label>
                    <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm font-medium text-foreground">
                      {previewLabel}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional)</label>
                  <input
                    type="text"
                    value={grantReason}
                    onChange={(e) => setGrantReason(e.target.value)}
                    placeholder="e.g. Goodwill credit for support escalation"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {user.subscription?.premiumGrantedAt
                    ? <>Last granted {new Date(user.subscription.premiumGrantedAt).toLocaleDateString()}{user.subscription.premiumNote ? ` — "${user.subscription.premiumNote}"` : ""}</>
                    : "No previous admin grant on record."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {canRevoke && (
                    <button
                      type="button"
                      onClick={() => {
                        setGrantActionError(null);
                        setPendingGrantAction("revoke");
                      }}
                      disabled={grantActionBusy}
                      className="rounded-lg border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      Revoke Premium
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (grantPresetMonths === "custom" && !grantCustomDate) {
                        toast.error("Pick a custom expiry date first.");
                        return;
                      }
                      setGrantActionError(null);
                      setPendingGrantAction("grant");
                    }}
                    disabled={grantActionBusy}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {grantActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Grant Premium
                  </button>
                </div>
              </div>
              {grantActionError && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {grantActionError}
                </div>
              )}
            </div>
          );
        })()}
        {user.subscription?.campaignSnapshot && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Campaign snapshot</p>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">{user.subscription.campaignSnapshot}</pre>
          </div>
        )}
        {(hasRawProviderIdentifier(user.subscription?.stripeCustomerId) || hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId)) && (
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {hasRawProviderIdentifier(user.subscription?.stripeCustomerId) && (
              <a
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                href={`https://dashboard.stripe.com/customers/${user.subscription.stripeCustomerId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open Stripe customer
              </a>
            )}
            {hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId) && (
              <a
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                href={`https://dashboard.stripe.com/subscriptions/${user.subscription.stripeSubscriptionId}`}
                target="_blank"
                rel="noreferrer"
              >
                Open Stripe subscription
              </a>
            )}
            {hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId) && user.subscription?.status === "TRIALING" && (
              <button
                type="button"
                disabled={subscriptionActionBusy}
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setPendingSubscriptionAction("cancel_trial")}
              >
                Cancel trial
              </button>
            )}
            {hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId) && user.subscription?.status === "ACTIVE" && (
              <button
                type="button"
                disabled={subscriptionActionBusy}
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setPendingSubscriptionAction("cancel_renewal")}
              >
                Cancel renewal
              </button>
            )}
            {hasRawProviderIdentifier(user.subscription?.stripeSubscriptionId) && ["TRIAL_CANCELED", "CANCEL_AT_PERIOD_END"].includes(user.subscription?.status) && (
              <button
                type="button"
                disabled={subscriptionActionBusy}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary hover:bg-primary/20"
                onClick={() => setPendingSubscriptionAction("resume_renewal")}
              >
                Resume renewal
              </button>
            )}
          </div>
        )}
        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setAdvancedBillingOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/30"
          >
            <span className="flex items-center gap-2">
              {advancedBillingOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Advanced billing fields
            </span>
            <span className="text-xs text-muted-foreground/70">Raw status, access type, dates — for Stripe / IAP edge cases</span>
          </button>
          {advancedBillingOpen && (
            <div className="border-t border-border p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                  <select
                    value={premiumForm.subscriptionStatus}
                    onChange={(e) => setPremiumForm({ ...premiumForm, subscriptionStatus: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="FREE_ACCESS">Free Access</option>
                    <option value="FREE_ACCESS_EXPIRED">Free Access Expired</option>
                    <option value="TRIALING">Trialing</option>
                    <option value="TRIAL_CANCELED">Trial Canceled</option>
                    <option value="ACTIVE">Active</option>
                    <option value="CANCEL_AT_PERIOD_END">Cancel at Period End</option>
                    <option value="CANCELED">Canceled</option>
                    <option value="PAST_DUE">Past Due</option>
                    <option value="GRACE_PERIOD">Grace Period</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Access Type</label>
                  <select
                    value={premiumForm.accessType}
                    onChange={(e) => setPremiumForm({ ...premiumForm, accessType: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Default / Paid</option>
                    <option value="FREE_ACCESS">Free Access</option>
                    <option value="FREE_TRIAL">Free Trial</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Premium Until</label>
                  <input
                    type="date"
                    value={premiumForm.premiumUntil}
                    onChange={(e) => setPremiumForm({ ...premiumForm, premiumUntil: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Trial Ends At</label>
                  <input
                    type="date"
                    value={premiumForm.trialEndsAt}
                    onChange={(e) => setPremiumForm({ ...premiumForm, trialEndsAt: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Free Access Ends At</label>
                  <input
                    type="date"
                    value={premiumForm.freeAccessEndsAt}
                    onChange={(e) => setPremiumForm({ ...premiumForm, freeAccessEndsAt: e.target.value })}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  Auto-renewal: <span className="font-medium text-foreground">{premiumForm.autoRenew ? "On" : "Off"}</span>
                </div>
                <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  Cancel at period end: <span className="font-medium text-foreground">{premiumForm.cancelAtPeriodEnd ? "Yes" : "No"}</span>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Note</label>
                <input
                  value={premiumForm.premiumNote}
                  onChange={(e) => setPremiumForm({ ...premiumForm, premiumNote: e.target.value })}
                  placeholder="Reason for raw field edit (optional)"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex items-center justify-end">
                <button
                  onClick={() => {
                    setPremiumError(null);
                    setPremiumConfirmError(null);
                    setShowPremiumConfirm(true);
                  }}
                  disabled={savingPremium}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingPremium ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Raw Fields
                </button>
              </div>
              {premiumError && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {premiumError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile */}
      {user.profile && (
        <div className={sectionCls("data")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Profile</h2>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
            <InfoItem label="Family Status" value={user.profile.familyStatus || "—"} />
            <InfoItem label="Move Type" value={user.profile.moveType || "—"} />
            <InfoItem label="Children" value={user.profile.hasChildren ? `Yes (${user.profile.childrenCount})` : "No"} />
            <InfoItem label="Pets" value={user.profile.hasPets ? "Yes" : "No"} />
            <InfoItem label="Cars" value={user.profile.carCount || 0} />
            <InfoItem label="Senior" value={user.profile.hasSenior ? "Yes" : "No"} />
            <InfoItem label="Immigrant" value={user.profile.isImmigrant ? (user.profile.immigrationStatus || "Yes") : "No"} />
            <InfoItem label="Business Owner" value={user.profile.isBusinessOwner ? (user.profile.businessType || "Yes") : "No"} />
            <InfoItem label="Military" value={user.profile.isMilitary ? "Yes" : "No"} />
            <InfoItem label="Motorcycle" value={user.profile.hasMotorcycle ? "Yes" : "No"} />
            <InfoItem label="Boat/RV" value={user.profile.hasBoatRV ? "Yes" : "No"} />
            <InfoItem label="Storage" value={user.profile.needsStorage ? "Yes" : "No"} />
            <InfoItem label="Language" value={user.profile.preferredLanguage || "en"} />
            <InfoItem label="Timezone" value={user.profile.timezone || "—"} />
          </div>
        </div>
      )}

      {/* Device & Sessions */}
      {sessions.length > 0 && (
        <div className={sectionCls("security")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <Monitor className="mr-2 inline h-5 w-5" /> Device & Sessions ({sessions.length})
          </h2>

          {/* Device Summary */}
          {(() => {
            const browserCounts: Record<string, number> = {};
            const osCounts: Record<string, number> = {};
            const deviceTypeCounts: Record<string, number> = {};
            const platformCounts: Record<string, number> = {};
            let totalPageViews = 0;
            sessions.forEach((s: any) => {
              if (s.browser) browserCounts[s.browser] = (browserCounts[s.browser] || 0) + 1;
              if (s.os) osCounts[s.os] = (osCounts[s.os] || 0) + 1;
              if (s.deviceType) deviceTypeCounts[s.deviceType] = (deviceTypeCounts[s.deviceType] || 0) + 1;
              if (s.platform) platformCounts[s.platform] = (platformCounts[s.platform] || 0) + 1;
              totalPageViews += s.pageViews || 0;
            });
            const topBrowser = Object.entries(browserCounts).sort((a, b) => b[1] - a[1])[0];
            const topOS = Object.entries(osCounts).sort((a, b) => b[1] - a[1])[0];
            const topDevice = Object.entries(deviceTypeCounts).sort((a, b) => b[1] - a[1])[0];
            const lastSession = sessions[0];
            const hasWeb = platformCounts["WEB"] > 0;
            const hasMobile = deviceTypeCounts["MOBILE"] > 0;

            return (
              <div className="mb-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Top Browser</p>
                    <p className="text-sm font-semibold text-foreground">{topBrowser?.[0] || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{topBrowser?.[1] || 0} sessions</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Top OS</p>
                    <p className="text-sm font-semibold text-foreground">{topOS?.[0] || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{topOS?.[1] || 0} sessions</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Device Type</p>
                    <p className="text-sm font-semibold text-foreground">{topDevice?.[0] || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{hasWeb && hasMobile ? "Web + Mobile" : hasWeb ? "Web only" : hasMobile ? "Mobile only" : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Total Sessions</p>
                    <p className="text-sm font-semibold text-foreground">{sessions.length}</p>
                    <p className="text-[10px] text-muted-foreground">{totalPageViews} page views</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Last Seen</p>
                    <p className="text-sm font-semibold text-foreground">{lastSession ? new Date(lastSession.sessionStart).toLocaleDateString() : "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{lastSession?.ipAddress || "—"}</p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Last Device</p>
                    <p className="text-sm font-semibold text-foreground">{lastSession?.browser || "—"} {lastSession?.os ? `/ ${lastSession.os}` : ""}</p>
                    <p className="text-[10px] text-muted-foreground">{lastSession?.device || lastSession?.deviceType || "—"}</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="space-y-3">
            {sessions.map((s: any) => (
              <div key={s.id} className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {s.deviceType === "MOBILE" ? <Smartphone className="h-4 w-4 text-tone-sky-fg" /> : <Monitor className="h-4 w-4 text-tone-emerald-fg" />}
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {s.browser || "Unknown"} {s.browserVersion || ""} · {s.os || "Unknown"} {s.osVersion || ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.device || s.deviceType || "Unknown device"} · {s.platform || "WEB"} · {s.screenResolution || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-slate-bg text-muted-foreground"}`}>
                      {s.isActive ? "Active" : "Ended"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {s.country || "—"}{s.city ? `, ${s.city}` : ""}{s.region ? ` (${s.region})` : ""}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(s.sessionStart).toLocaleString()}</span>
                  <span>{s.pageViews || 0} page views</span>
                  <span className="flex items-center gap-1">IP: {s.ipAddress || "—"}</span>
                </div>
                {s.language && <p className="text-xs text-muted-foreground mt-1">Language: {s.language}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Behavior Tracking */}
      {(eventCounts.length > 0 || recentEvents.length > 0) && (
        <div className={sectionCls("overview")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <MousePointer className="mr-2 inline h-5 w-5" /> User Behavior
          </h2>

          {/* Event Summary */}
          {eventCounts.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Event Summary</p>
              <div className="flex flex-wrap gap-2">
                {eventCounts.map((ec: any) => (
                  <span key={ec.event} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {ec.event}: {ec._count?.id || 0}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recent Events Timeline */}
          {recentEvents.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Recent Activity (Last 30)</p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {recentEvents.map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                        ev.event === "PAGE_VIEW" ? "bg-tone-sky-bg text-tone-sky-fg" :
                        ev.event === "BUTTON_CLICK" ? "bg-tone-orange-bg text-tone-orange-fg" :
                        ev.event === "SEARCH" ? "bg-tone-honey-bg text-tone-honey-fg" :
                        ev.event === "LOGIN" ? "bg-tone-sage-bg text-tone-sage-fg" :
                        "bg-tone-slate-bg text-muted-foreground"
                      }`}>{ev.event}</span>
                      <span className="text-muted-foreground text-xs truncate max-w-[250px]">{ev.page || "—"}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(ev.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Move Transition Context */}
      {activeMove && (
        <div className="rounded-xl border border-tone-honey-br bg-tone-honey-bg p-6">
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-5 w-5 shrink-0 text-tone-honey-fg" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-1.5 text-lg font-semibold text-foreground">
                    Move Transition Support Context
                    <InfoHint
                      text="Background on this user's in-progress move so a support agent can give informed manual guidance. It is read-only context — nothing here changes the user's utility or service accounts."
                      label="Move Transition Support Context"
                    />
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This is operator context for manual guidance. LocateFlow does not update provider accounts or execute address changes.
                  </p>
                </div>
                <span className="rounded-full border border-tone-honey-br bg-background px-2.5 py-1 text-xs font-medium text-tone-honey-fg">
                  Manual guidance only
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <InfoCard
                  label="Move type"
                  value={activeMoveIsInterstate ? "Interstate" : "Same state"}
                />
                <InfoCard
                  label="Origin services"
                  value={activeMoveOriginServices}
                  hint="Count of services (electric, internet, etc.) tracked at the address the user is moving FROM — typically things to stop or transfer."
                />
                <InfoCard
                  label="Destination services"
                  value={activeMoveDestinationServices}
                  hint="Count of services tracked at the address the user is moving TO — typically things to set up or shop for."
                />
                <InfoCard
                  label="Route"
                  value={`${activeMove.fromAddress?.state || "?"} to ${activeMove.toAddress?.state || "?"}`}
                />
              </div>
              {activeMoveOriginServices > 0 && activeMoveDestinationServices === 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-tone-honey-br bg-background/70 p-3 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-tone-honey-fg" />
                  <p>
                    Origin services exist, but no destination services are tracked yet. Support should expect stop, verify, shop, or start-service guidance depending on provider coverage.
                  </p>
                </div>
              )}
              {moveTasks.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Recent move tasks</p>
                  <div className="grid gap-2 lg:grid-cols-2">
                    {moveTasks.slice(0, 6).map((task: any) => (
                      <div key={task.id} className="rounded-lg border border-border bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatTaskAction(task.actionType)} · {task.service?.providerName || task.provider?.name || task.customProvider?.name || task.destinationProvider?.name || "No provider selected"}
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${taskStatusClass(task.status)}`}>
                            {formatStatus(task.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Confidence: {formatStatus(task.confidence)}. Completion updates LocateFlow only; no external provider account is changed.
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User-created Providers */}
      {customProviders.length > 0 && (
        <div className={sectionCls("data")}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">User-Created Providers ({customProviders.length})</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Private provider records for local/manual tracking. They are not global catalog entries and are not source verified.
              </p>
            </div>
            <Link href="/provider-governance" className="text-xs text-primary hover:underline">
              Governance queue
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {customProviders.slice(0, 8).map((provider: any) => (
              <div key={provider.id} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{provider.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {provider.category} · {provider.providerType || "OTHER"} · {provider.trustStatus || "USER_CUSTOM"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${provider.adminReviewStatus === "REVIEWED" ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-honey-bg text-tone-honey-fg"}`}>
                    {formatStatus(provider.adminReviewStatus || "NOT_REVIEWED")}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {provider._count?.services || 0} service(s), {provider._count?.moveTasks || 0} move task(s), {provider._count?.governanceIssues || 0} governance issue(s).
                </p>
                {provider.linkedServiceProvider && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Linked to listed provider: {provider.linkedServiceProvider.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Addresses */}
      {user.addresses?.length > 0 && (
        <div className={sectionCls("data")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <MapPin className="mr-2 inline h-5 w-5" /> Addresses ({user.addresses.length})
          </h2>
          <div className="space-y-3">
            {user.addresses.map((addr: any) => (
              <div key={addr.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="font-medium text-foreground">{addr.label || "Address"}</p>
                  <p className="text-sm text-muted-foreground">
                    {addr.street}, {addr.city}, {addr.state} {addr.zip}
                  </p>
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {addr.services?.length || 0} services
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Push Devices */}
      {pushDevices.length > 0 && (
        <div className={sectionCls("data")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <Bell className="mr-2 inline h-5 w-5" /> Push Devices ({pushDevices.length})
          </h2>
          <div className="space-y-2">
            {pushDevices.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <Smartphone className={`h-4 w-4 shrink-0 ${d.platform === "ios" ? "text-tone-sky-fg" : "text-tone-emerald-fg"}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {d.deviceName || "Unnamed device"} <span className="text-xs font-normal text-muted-foreground">· {d.platform}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">Token redacted from admin browser response</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground">Last seen</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(d.lastSeenAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Moving Plans */}
      {user.movingPlans?.length > 0 && (
        <div className={sectionCls("data")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Moving Plans ({user.movingPlans.length})</h2>
          <div className="space-y-3">
            {user.movingPlans.map((plan: any) => (
              <div key={plan.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <div>
                  <p className="font-medium text-foreground">
                    {plan.fromAddress?.city}, {plan.fromAddress?.state} → {plan.toAddress?.city}, {plan.toAddress?.state}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Move date: {plan.moveDate ? new Date(plan.moveDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  plan.status === "COMPLETED" ? "bg-tone-sage-bg text-tone-sage-fg" : "bg-tone-sky-bg text-tone-sky-fg"
                }`}>{plan.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Tickets */}
      {supportTickets.length > 0 && (
        <div className={sectionCls("overview")}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              <LifeBuoy className="mr-2 inline h-5 w-5" /> Recent Support Tickets ({supportTickets.length})
            </h2>
            <Link href="/support" className="text-xs text-primary hover:underline">View all tickets</Link>
          </div>
          <div className="space-y-2">
            {supportTickets.map((ticket: any) => {
              const lastMsg = ticket.messages?.[0];
              const statusColor =
                ticket.status === "OPEN" ? "bg-tone-sky-bg text-tone-sky-fg" :
                ticket.status === "IN_PROGRESS" ? "bg-tone-honey-bg text-tone-honey-fg" :
                ticket.status === "WAITING_USER" ? "bg-tone-orange-bg text-tone-orange-fg" :
                "bg-muted text-muted-foreground";
              return (
                <Link key={ticket.id} href={`/support/${ticket.id}`}>
                  <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/50 p-3 text-sm hover:bg-muted/70 transition cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>{ticket.status.replace("_", " ")}</span>
                        <span className="text-xs text-muted-foreground">{ticket.category}</span>
                      </div>
                      <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {lastMsg.senderType === "ADMIN" ? "Support: " : "User: "}{lastMsg.content}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {auditLogs.length > 0 && (
        <div className={sectionCls("overview")}>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Activity Log (Recent 20)</h2>
          <div className="space-y-2">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{log.action}</span>
                  <span className="text-muted-foreground">{log.entityType}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <PasswordConfirmModal
        open={showProfileConfirm}
        title="Update user profile"
        description={`Enter your admin password and MFA code or backup code to update profile PII for ${maskEmail(user.email)}.`}
        confirmLabel="Save Profile"
        busy={saving}
        error={profileConfirmError}
        requiresMfa={profileRequiresMfa}
        onClose={() => {
          if (!saving) {
            setShowProfileConfirm(false);
            setProfileConfirmError(null);
            setProfileRequiresMfa(false);
          }
        }}
        onConfirm={confirmProfileUpdate}
      />
      <PasswordConfirmModal
        open={Boolean(pendingLoginSessionRevoke)}
        title={pendingLoginSessionRevoke?.sessionId ? "Revoke login session" : "Revoke all login sessions"}
        description={`Enter your admin password and MFA code or backup code to revoke ${pendingLoginSessionRevoke?.sessionId ? "this login session" : "all active login sessions"} for ${maskEmail(user.email)}.`}
        confirmLabel="Revoke"
        busy={revokingLoginSessions}
        error={loginSessionRevokeError}
        requiresMfa={loginSessionRevokeRequiresMfa}
        onClose={() => {
          if (!revokingLoginSessions) {
            setPendingLoginSessionRevoke(null);
            setLoginSessionRevokeError(null);
            setLoginSessionRevokeRequiresMfa(false);
          }
        }}
        onConfirm={confirmRevokeLoginSessions}
      />
      <PasswordConfirmModal
        open={showDeleteConfirm}
        title="Delete user"
        description={`This removes ${maskEmail(user.email)} from the active list and queues staged GDPR cleanup. Enter your admin password to continue.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        error={deleteError}
        requiresMfa={deleteRequiresMfa}
        onClose={() => {
          if (!deleteBusy) {
            setShowDeleteConfirm(false);
            setDeleteError(null);
            setDeleteRequiresMfa(false);
          }
        }}
        onConfirm={confirmDelete}
      />
      <PasswordConfirmModal
        open={showRestoreConfirm}
        title="Restore / unblock user"
        description={`This restores ${maskEmail(user.email)} to the active user list. Existing sessions remain revoked; the user must sign in again or reset their password.`}
        confirmLabel="Restore / Unblock"
        busy={restoreBusy}
        error={restoreError}
        requiresMfa={restoreRequiresMfa}
        onClose={() => {
          if (!restoreBusy) {
            setShowRestoreConfirm(false);
            setRestoreError(null);
            setRestoreRequiresMfa(false);
          }
        }}
        onConfirm={confirmRestore}
      />
      <PasswordConfirmModal
        open={Boolean(pendingPlan)}
        title="Change user plan"
        description={`Enter your admin password and MFA code or backup code to change ${maskEmail(user.email)} from ${editForm.plan || "current plan"} to ${pendingPlan || "the selected plan"}.`}
        confirmLabel="Change Plan"
        busy={changingPlan}
        error={planConfirmError}
        requiresMfa={planRequiresMfa}
        onClose={() => {
          if (!changingPlan) {
            setPendingPlan(null);
            setPlanConfirmError(null);
            setPlanRequiresMfa(false);
          }
        }}
        onConfirm={confirmPlanChange}
      />
      <PasswordConfirmModal
        open={Boolean(pendingSubscriptionAction)}
        title="Update Stripe renewal"
        description={`Enter your admin password and MFA code or backup code to ${
          pendingSubscriptionAction === "resume_renewal"
            ? "resume renewal for"
            : pendingSubscriptionAction === "cancel_trial"
              ? "cancel the trial for"
              : "cancel renewal for"
        } ${maskEmail(user.email)}.`}
        confirmLabel={
          pendingSubscriptionAction === "resume_renewal"
            ? "Resume Renewal"
            : pendingSubscriptionAction === "cancel_trial"
              ? "Cancel Trial"
              : "Cancel Renewal"
        }
        busy={subscriptionActionBusy}
        error={subscriptionActionError}
        requiresMfa={subscriptionActionRequiresMfa}
        onClose={() => {
          if (!subscriptionActionBusy) {
            setPendingSubscriptionAction(null);
            setSubscriptionActionError(null);
            setSubscriptionActionRequiresMfa(false);
          }
        }}
        onConfirm={confirmSubscriptionAction}
      />
      <PasswordConfirmModal
        open={Boolean(pendingGrantAction)}
        title={pendingGrantAction === "revoke" ? "Revoke premium access" : "Grant premium access"}
        description={
          pendingGrantAction === "revoke"
            ? `Revoke the admin premium grant for ${maskEmail(user.email)} and drop the user back to default free access. Enter your admin password and MFA code or backup code to continue.`
            : `Grant manual premium access to ${maskEmail(user.email)}${grantReason ? ` — "${grantReason}"` : ""}. Enter your admin password and MFA code or backup code to continue.`
        }
        confirmLabel={pendingGrantAction === "revoke" ? "Revoke Premium" : "Grant Premium"}
        busy={grantActionBusy}
        error={grantActionError}
        requiresMfa={grantActionRequiresMfa}
        onClose={() => {
          if (!grantActionBusy) {
            setPendingGrantAction(null);
            setGrantActionError(null);
            setGrantActionRequiresMfa(false);
          }
        }}
        onConfirm={confirmGrantPremiumAction}
      />
      <PasswordConfirmModal
        open={showPremiumConfirm}
        title="Update billing entitlements"
        description={`Enter your admin password and MFA code or backup code to update subscription, premium, or trial entitlement fields for ${maskEmail(user.email)}.`}
        confirmLabel="Save Entitlements"
        busy={savingPremium}
        error={premiumConfirmError}
        requiresMfa={premiumRequiresMfa}
        onClose={() => {
          if (!savingPremium) {
            setShowPremiumConfirm(false);
            setPremiumConfirmError(null);
            setPremiumRequiresMfa(false);
          }
        }}
        onConfirm={confirmPremiumUpdate}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string | number;
  detail?: string | null;
  accent?: "sage" | "honey";
}) {
  const accentClass =
    accent === "sage" ? "text-tone-sage-fg" : accent === "honey" ? "text-tone-honey-fg" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</p>
      {detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function InfoCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-4">
      <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-muted-foreground">
        {label}
        {hint ? <InfoHint text={hint} label={label} /> : null}
      </p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatStatus(value: string) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTaskAction(value: string) {
  return formatStatus(value || "NO_ACTION");
}

function taskStatusClass(status: string) {
  if (status === "COMPLETED") return "bg-tone-sage-bg text-tone-sage-fg";
  if (status === "DISMISSED") return "bg-muted text-muted-foreground";
  if (status === "ACCEPTED" || status === "IN_PROGRESS") return "bg-tone-sky-bg text-tone-sky-fg";
  if (status === "REOPENED") return "bg-tone-foil-bg text-tone-foil-fg";
  return "bg-tone-honey-bg text-tone-honey-fg";
}

function buildLatestConsentEntries(entries: any[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.category)) return false;
    seen.add(entry.category);
    return true;
  });
}

function formatConsentCategory(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAuthProvider(provider: string) {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return provider;
}

function maskProviderIdentifier(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function extractAdminNote(note: any) {
  try {
    const parsed = JSON.parse(note?.changes || "{}");
    return typeof parsed.note === "string" ? parsed.note : "Internal note";
  } catch {
    return typeof note?.changes === "string" ? note.changes : "Internal note";
  }
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
