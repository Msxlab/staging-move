import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Users, Trash2, ExternalLink, Ticket, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, fonts, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { useAuthStore } from "@/lib/auth-store";
import { getSelectedWorkspaceId, setSelectedWorkspaceId } from "@/lib/workspace-selection";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { HeroCard, SectionHeader, Pill } from "@/components/move";

interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  planLabel: string;
  seatLimit: number;
  memberCount: number;
  isPersonalSolo?: boolean;
}
interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  managedSyncEnabled: boolean | null;
  displayName: string | null;
  email: string;
}
interface Invitation {
  id: string;
  invitedEmail: string;
  role: string;
  status: string;
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  CHILD: "Child",
  VIEW_ONLY: "View only",
};
const ASSIGNABLE = ["ADMIN", "MEMBER", "CHILD", "VIEW_ONLY"];

function isManagerRole(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}
function managedSyncOn(role: string, flag: boolean | null): boolean {
  return typeof flag === "boolean" ? flag : role === "CHILD";
}

// Managed sync (pushing an address change to a member's partner connectors on their
// behalf) is not yet generally available: the connector backend stays gated behind
// FEATURE_API_CONNECTORS until partner agreements + legal sign-off. Until then we surface
// "Coming soon" and disable the consent switch so Family/Pro users aren't shown a feature
// that can't run yet. Flip to false once connectors are live to restore the switch.
const MANAGED_SYNC_COMING_SOON = true;

export default function WorkspaceScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.user?.id) ?? null;

  const [pageLoading, setPageLoading] = useState(true);
  const [featureOff, setFeatureOff] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [myManagedSync, setMyManagedSync] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const selected = workspaces.find((w) => w.id === selectedId) ?? null;
  const iAmManager = selected ? isManagerRole(selected.role) : false;
  const iAmOwner = selected ? selected.role === "OWNER" : false;

  const selectWorkspace = useCallback((workspaceId: string | null) => {
    setSelectedId(workspaceId);
    void setSelectedWorkspaceId(workspaceId).catch(() => {});
  }, []);

  const loadDetail = useCallback(async (workspaceId: string, manager: boolean) => {
    const memRes = await api.get<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`);
    setMembers(memRes.data?.members ?? []);
    const msRes = await api.get<{ enabled: boolean }>(`/api/workspaces/${workspaceId}/managed-sync`);
    setMyManagedSync(typeof msRes.data?.enabled === "boolean" ? msRes.data.enabled : null);
    if (manager) {
      const invRes = await api.get<{ invitations: Invitation[] }>(`/api/workspaces/${workspaceId}/invitations`);
      setInvitations(invRes.data?.invitations ?? []);
    } else {
      setInvitations([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    const [storedWorkspaceId, res] = await Promise.all([
      getSelectedWorkspaceId(),
      api.get<{ workspaces: Workspace[] }>("/api/workspaces"),
    ]);
    if (res.code === "WORKSPACE_DISABLED") {
      // Feature is genuinely off for this environment (server gate).
      setFeatureOff(true);
      selectWorkspace(null);
      setPageLoading(false);
      return;
    }
    if (res.error && !res.data) {
      // Transient/network failure — show a retryable error, NOT the permanent
      // "coming soon" state (which would be a lie on a flaky connection).
      setLoadError(true);
      setPageLoading(false);
      return;
    }
    setFeatureOff(false);
    const list = res.data?.workspaces ?? [];
    setWorkspaces(list);
    // Default to a shared (non-personal) workspace when present so a Family/Pro
    // member lands on the household they actually share, not their own personal
    // data container. The empty, redundant personal-solo is already excluded
    // server-side, so it never appears in the switcher.
    if (list.length > 0) {
      const stored = storedWorkspaceId ? list.find((w) => w.id === storedWorkspaceId)?.id ?? null : null;
      selectWorkspace(stored ?? list.find((w) => !w.isPersonalSolo)?.id ?? list[0].id);
    } else {
      selectWorkspace(null);
    }
    setPageLoading(false);
  }, [selectWorkspace]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId, iAmManager);
  }, [selectedId, iAmManager, loadDetail]);

  const refresh = () => {
    if (selectedId) void loadDetail(selectedId, iAmManager);
  };

  const changeRole = async (m: Member, role: string) => {
    if (!selectedId) return;
    setBusy(true);
    const res = await api.patch(`/api/workspaces/${selectedId}/members/${m.id}`, { role });
    setBusy(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry", "Try again"), res.error);
      return;
    }
    hapticSuccess();
    refresh();
  };

  const removeMember = (m: Member) => {
    if (!selectedId) return;
    Alert.alert(t("workspace.removeTitle", "Remove member?"), m.displayName || m.email, [
      { text: t("common.cancel", "Cancel"), style: "cancel" },
      {
        text: t("workspace.remove", "Remove"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const res = await api.delete(`/api/workspaces/${selectedId}/members/${m.id}`);
          setBusy(false);
          if (res.error) {
            hapticError();
            Alert.alert(t("common.retry", "Try again"), res.error);
            return;
          }
          hapticSuccess();
          refresh();
        },
      },
    ]);
  };

  const renameWorkspace = async () => {
    const name = nameInput.trim();
    if (!name || name.length > 60 || !selectedId) return;
    setBusy(true);
    const res = await api.patch(`/api/workspaces/${selectedId}`, { name });
    setBusy(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry", "Try again"), res.error);
      return;
    }
    hapticSuccess();
    setRenaming(false);
    void load();
  };

  const transfer = (m: Member) => {
    if (!selectedId) return;
    Alert.alert(
      t("workspace.transferTitle", "Make owner?"),
      `${m.displayName || m.email} ${t("workspace.transferBody", "will become the owner; you'll become an admin.")}`,
      [
        { text: t("common.cancel", "Cancel"), style: "cancel" },
        {
          text: t("workspace.makeOwner", "Make owner"),
          onPress: async () => {
            setBusy(true);
            const res = await api.post(`/api/workspaces/${selectedId}/transfer`, { toUserId: m.userId });
            setBusy(false);
            if (res.error) {
              hapticError();
              Alert.alert(t("common.retry", "Try again"), res.error);
              return;
            }
            hapticSuccess();
            void load();
            refresh();
          },
        },
      ],
    );
  };

  const memberActions = (m: Member) => {
    const isSelf = myUserId != null && m.userId === myUserId;
    if (!iAmManager || isSelf || m.role === "OWNER") return;
    const buttons: Array<{ text: string; style?: "cancel" | "destructive"; onPress?: () => void }> = [
      {
        text: t("workspace.changeRole", "Change role"),
        onPress: () =>
          Alert.alert(t("workspace.changeRole", "Change role"), m.displayName || m.email, [
            ...ASSIGNABLE.map((r) => ({ text: ROLE_LABEL[r], onPress: () => changeRole(m, r) })),
            { text: t("common.cancel", "Cancel"), style: "cancel" as const },
          ]),
      },
    ];
    if (iAmOwner && m.status === "ACTIVE" && (m.role === "ADMIN" || m.role === "MEMBER")) {
      buttons.push({ text: t("workspace.makeOwner", "Make owner"), onPress: () => transfer(m) });
    }
    buttons.push({ text: t("workspace.remove", "Remove"), style: "destructive", onPress: () => removeMember(m) });
    buttons.push({ text: t("common.cancel", "Cancel"), style: "cancel" });
    Alert.alert(m.displayName || m.email, undefined, buttons);
  };

  const leave = () => {
    if (!selectedId) return;
    Alert.alert(t("workspace.leaveTitle", "Leave workspace?"), undefined, [
      { text: t("common.cancel", "Cancel"), style: "cancel" },
      {
        text: t("workspace.leave", "Leave"),
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const res = await api.post(`/api/workspaces/${selectedId}/members/leave`, {});
          setBusy(false);
          if (res.error) {
            hapticError();
            Alert.alert(t("common.retry", "Try again"), res.error);
            return;
          }
          hapticSuccess();
          selectWorkspace(null);
          void load();
        },
      },
    ]);
  };

  const sendInvite = async () => {
    if (!selectedId || !inviteEmail.trim()) return;
    setBusy(true);
    const res = await api.post<{ devInviteUrl?: string }>(`/api/workspaces/${selectedId}/invitations`, {
      email: inviteEmail.trim(),
      role: inviteRole,
    });
    setBusy(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry", "Try again"), res.error);
      return;
    }
    hapticSuccess();
    setInviteEmail("");
    refresh();
  };

  const revokeInvite = async (inv: Invitation) => {
    if (!selectedId) return;
    setBusy(true);
    const res = await api.delete(`/api/workspaces/${selectedId}/invitations/${inv.id}`);
    setBusy(false);
    if (res.error) {
      hapticError();
      Alert.alert(t("common.retry", "Try again"), res.error);
      return;
    }
    hapticSuccess();
    refresh();
  };

  const toggleManagedSync = async (next: boolean) => {
    if (!selectedId) return;
    setMyManagedSync(next);
    const res = await api.put<{ enabled: boolean }>(`/api/workspaces/${selectedId}/managed-sync`, { enabled: next });
    if (res.error) {
      setMyManagedSync(!next);
      hapticError();
      Alert.alert(t("common.retry", "Try again"), res.error);
    }
  };

  if (pageLoading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.workspace", "Workspace")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {loadError ? (
          <View style={styles.stateWrap}>
            <View style={styles.stateIcon}>
              <Users size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.empty}>
              {t("workspace.loadError", "Couldn't load your workspace. Check your connection and try again.")}
            </Text>
            <TouchableOpacity
              onPress={() => { setPageLoading(true); void load(); }}
              style={styles.gradientBtnWrap}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBtn}
              >
                <Text style={styles.gradientBtnText}>{t("common.retry", "Retry")}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : featureOff ? (
          <View style={styles.stateWrap}>
            <View style={styles.stateIcon}>
              <Users size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.empty}>{t("workspace.unavailable", "Shared household workspaces (members, shared services, child accounts) are rolling out for Family & Pro — coming soon. Your plan's higher limits are already active.")}</Text>
          </View>
        ) : workspaces.length === 0 ? (
          <View style={styles.stateWrap}>
            <View style={styles.stateIcon}>
              <Users size={22} color={theme.colors.primary} />
            </View>
            <Text style={styles.empty}>
              {t("workspace.none", "You're not part of any shared workspace yet. A Family or Pro plan lets you create one.")}
            </Text>
            <TouchableOpacity
              onPress={() => openWebUrl(`${APP_WEB_URL}/pricing#family-pro`)}
              style={styles.gradientBtnWrap}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t("workspace.upgradeWebA11y", "See Family and Pro plans on the web")}
            >
              <LinearGradient
                colors={theme.colors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.gradientBtn, { flexDirection: "row", gap: 8 }]}
              >
                <ExternalLink size={16} color={theme.colors.onAccent} />
                <Text style={styles.gradientBtnText}>
                  {t("workspace.upgradeWeb", "See Family & Pro on the web")}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/workspace/accept-invite" as Href)}
              style={styles.joinInviteRow}
              accessibilityRole="button"
              accessibilityLabel={t("workspace.haveInviteA11y", "Have an invite? Join a workspace")}
            >
              <Ticket size={16} color={theme.colors.primary} />
              <Text style={styles.joinInviteText}>
                {t("workspace.haveInvite", "Have an invite? Join a workspace")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {workspaces.length > 1 && (
              <View style={styles.chips}>
                {workspaces.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => selectWorkspace(w.id)}
                    style={[styles.chip, w.id === selectedId && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, w.id === selectedId && styles.chipTextActive]}>{w.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selected && (
              <>
                <HeroCard style={styles.heroCard} padding={18} radius={20}>
                  {selected.role === "OWNER" && renaming ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <TextInput
                        value={nameInput}
                        onChangeText={setNameInput}
                        maxLength={60}
                        autoFocus
                        style={styles.renameInput}
                        placeholderTextColor={theme.colors.faint}
                      />
                      <TouchableOpacity onPress={renameWorkspace} disabled={busy}>
                        <Text style={styles.renameSave}>{t("common.save", "Save")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRenaming(false)} disabled={busy}>
                        <Text style={styles.renameCancel}>{t("common.cancel", "Cancel")}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={styles.wsAvatar}>
                        <Users size={18} color={theme.colors.primary} />
                      </View>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={selected.role === "OWNER" ? () => { setNameInput(selected.name); setRenaming(true); } : undefined}
                        disabled={selected.role !== "OWNER"}
                        activeOpacity={selected.role === "OWNER" ? 0.6 : 1}
                      >
                        <View style={styles.wsNameRow}>
                          <Text style={styles.wsName}>{selected.name}</Text>
                          {selected.role === "OWNER" && <Pencil size={14} color={theme.colors.faint} />}
                        </View>
                      </TouchableOpacity>
                      {selected.isPersonalSolo && (
                        <Pill label={t("workspace.personal", "Personal")} tone="muted" />
                      )}
                    </View>
                  )}
                  <Text style={styles.wsMeta}>
                    {selected.isPersonalSolo
                      ? `${selected.planLabel} · ${t("workspace.justYou", "Personal · just you")}`
                      : `${selected.planLabel} · ${ROLE_LABEL[selected.role] ?? selected.role} · ${selected.memberCount}/${selected.seatLimit} ${t("workspace.membersLower", "members")}`}
                  </Text>
                  {selected.role !== "OWNER" && (
                    <TouchableOpacity onPress={leave} disabled={busy} style={styles.leaveBtn}>
                      <Text style={styles.leaveBtnText}>{t("workspace.leave", "Leave")}</Text>
                    </TouchableOpacity>
                  )}
                </HeroCard>

                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.cardTitle}>
                        {t("workspace.managedSync", "Managed sync")}
                        {MANAGED_SYNC_COMING_SOON ? `  ·  ${t("common.comingSoon", "Coming soon")}` : ""}
                      </Text>
                      <Text style={styles.cardDesc}>
                        {MANAGED_SYNC_COMING_SOON
                          ? t(
                              "workspace.managedSyncSoon",
                              "Soon, an owner or admin will be able to push an address change to your connected partners on your behalf. We'll let you know when it's ready.",
                            )
                          : t(
                              "workspace.managedSyncDesc",
                              "Let an owner or admin push an address change to your connected partners on your behalf.",
                            )}
                      </Text>
                    </View>
                    <Switch
                      value={MANAGED_SYNC_COMING_SOON ? false : Boolean(myManagedSync)}
                      onValueChange={toggleManagedSync}
                      disabled={MANAGED_SYNC_COMING_SOON}
                    />
                  </View>
                </View>

                <SectionHeader label={t("workspace.members", "MEMBERS")} style={styles.sectionHeader} />
                <View style={styles.listCard}>
                  {members.map((m, i) => {
                    const isSelf = myUserId != null && m.userId === myUserId;
                    const tappable = iAmManager && !isSelf && m.role !== "OWNER";
                    return (
                      <TouchableOpacity
                        key={m.id}
                        disabled={!tappable || busy}
                        onPress={() => memberActions(m)}
                        style={[styles.memberRow, i < members.length - 1 && styles.rowBorder]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>
                            {m.displayName || m.email}
                            {isSelf ? ` ${t("workspace.you", "(you)")}` : ""}
                          </Text>
                          <Text style={styles.memberSub}>
                            {ROLE_LABEL[m.role] ?? m.role}
                            {m.status && m.status !== "ACTIVE" ? ` · ${m.status.toLowerCase()}` : ""}
                            {!MANAGED_SYNC_COMING_SOON && iAmManager && managedSyncOn(m.role, m.managedSyncEnabled)
                              ? " · sync on"
                              : ""}
                          </Text>
                        </View>
                        {tappable && (
                          <View style={styles.managePill}>
                            <Text style={styles.manage}>{t("workspace.manage", "Manage")}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {iAmManager && selected.isPersonalSolo && (
                  <View style={[styles.card, { marginTop: 22 }]}>
                    <Text style={styles.cardDesc}>
                      {t(
                        "workspace.personalHint",
                        "This is your personal workspace — just your own data. Upgrade to a Family or Pro plan to invite people and share it as a household.",
                      )}
                    </Text>
                  </View>
                )}

                {iAmManager && !selected.isPersonalSolo && (
                  <>
                    <SectionHeader label={t("workspace.invite", "INVITE A MEMBER")} style={styles.sectionHeader} />
                    <View style={styles.card}>
                      <TextInput
                        value={inviteEmail}
                        onChangeText={setInviteEmail}
                        placeholder="name@email.com"
                        placeholderTextColor={theme.colors.faint}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                      />
                      <View style={styles.roleChips}>
                        {ASSIGNABLE.map((r) => (
                          <TouchableOpacity
                            key={r}
                            onPress={() => setInviteRole(r)}
                            style={[styles.roleChip, inviteRole === r && styles.roleChipActive]}
                          >
                            <Text style={[styles.roleChipText, inviteRole === r && styles.roleChipTextActive]}>
                              {ROLE_LABEL[r]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        onPress={sendInvite}
                        disabled={busy || !inviteEmail.trim()}
                        style={styles.primaryBtnWrap}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={theme.colors.gradient.primary}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[styles.primaryBtn, (busy || !inviteEmail.trim()) && { opacity: 0.5 }]}
                        >
                          {busy ? (
                            <ActivityIndicator size="small" color={theme.colors.onAccent} />
                          ) : (
                            <Text style={styles.primaryBtnText}>{t("workspace.sendInvite", "Send invite")}</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>

                      {invitations.map((inv) => (
                        <View key={inv.id} style={[styles.memberRow, styles.rowBorderTop]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{inv.invitedEmail}</Text>
                            <Text style={styles.memberSub}>
                              {ROLE_LABEL[inv.role] ?? inv.role} · {t("workspace.pending", "pending")}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => revokeInvite(inv)} disabled={busy}>
                            <Trash2 size={18} color={theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* Persistent entry point: a Pro user can be invited to additional
                workspaces, so keep "Join a workspace" reachable even when one
                workspace already exists. */}
            <TouchableOpacity
              onPress={() => router.push("/workspace/accept-invite" as Href)}
              style={styles.joinInviteRow}
              accessibilityRole="button"
              accessibilityLabel={t("workspace.haveInviteA11y", "Have an invite? Join a workspace")}
            >
              <Ticket size={16} color={theme.colors.primary} />
              <Text style={styles.joinInviteText}>
                {t("workspace.haveInvite", "Have an invite? Join a workspace")}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontFamily: fonts.serifBold, color: theme.colors.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },

    // ── State (error / coming-soon / empty) ──────────────────────────────
    stateWrap: { alignItems: "center", marginTop: 24 },
    stateIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    empty: {
      fontSize: 14,
      fontFamily: fonts.sans,
      color: theme.colors.dim,
      lineHeight: 20,
      marginTop: 14,
      textAlign: "center",
    },
    gradientBtnWrap: { marginTop: 18, borderRadius: theme.radius.md, overflow: "hidden" },
    gradientBtn: {
      paddingVertical: 13,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    gradientBtnText: { color: theme.colors.onAccent, fontFamily: fonts.sansSemibold, fontSize: 14 },

    // ── Workspace switcher chips ─────────────────────────────────────────
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
    chip: {
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    chipActive: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSoft },
    chipText: { fontSize: 13, fontFamily: fonts.sansMedium, color: theme.colors.dim },
    chipTextActive: { color: theme.colors.primary, fontFamily: fonts.sansSemibold },

    // ── Cards ────────────────────────────────────────────────────────────
    heroCard: { marginTop: 12 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginTop: 12,
    },
    listCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      marginTop: 10,
      overflow: "hidden",
    },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

    // ── Selected workspace hero ──────────────────────────────────────────
    wsAvatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.accentSoft,
      borderWidth: 1,
      borderColor: theme.colors.accentBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    wsName: { fontSize: 17, fontFamily: fonts.serifBold, color: theme.colors.text },
    wsNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    wsMeta: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 8 },
    renameInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface2,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontFamily: fonts.sansMedium,
      color: theme.colors.text,
    },
    renameSave: { color: theme.colors.primary, fontFamily: fonts.sansBold },
    renameCancel: { color: theme.colors.faint, fontFamily: fonts.sansMedium },
    leaveBtn: {
      alignSelf: "flex-start",
      marginTop: 14,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.redLine,
      backgroundColor: theme.colors.redSoft,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    leaveBtnText: { fontSize: 13, fontFamily: fonts.sansSemibold, color: theme.colors.red },

    cardTitle: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
    cardDesc: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.dim, marginTop: 6, lineHeight: 18 },
    sectionHeader: { marginTop: 22, marginBottom: 2, marginLeft: 2 },

    // ── Member / invitation rows ─────────────────────────────────────────
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowBorderTop: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4 },
    memberName: { fontSize: 15, fontFamily: fonts.sansSemibold, color: theme.colors.text },
    memberSub: { fontSize: 12, fontFamily: fonts.sans, color: theme.colors.faint, marginTop: 2 },
    managePill: {
      borderRadius: 8,
      backgroundColor: theme.colors.accentSoft,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    manage: { fontSize: 12, color: theme.colors.primary, fontFamily: fonts.sansSemibold },

    // ── Invite form ──────────────────────────────────────────────────────
    input: {
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontSize: 14,
      fontFamily: fonts.sansMedium,
      color: theme.colors.text,
    },
    roleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    roleChip: {
      borderRadius: theme.radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    roleChipActive: { borderColor: theme.colors.accentBorder, backgroundColor: theme.colors.accentSoft },
    roleChipText: { fontSize: 12, fontFamily: fonts.sansMedium, color: theme.colors.dim },
    roleChipTextActive: { color: theme.colors.primary, fontFamily: fonts.sansSemibold },
    primaryBtnWrap: { marginTop: 14, borderRadius: theme.radius.md, overflow: "hidden" },
    primaryBtn: {
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: { fontSize: 14, fontFamily: fonts.sansBold, color: theme.colors.onAccent },

    joinInviteRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      paddingVertical: 10,
    },
    joinInviteText: { fontSize: 14, fontFamily: fonts.sansSemibold, color: theme.colors.primary },
  });
