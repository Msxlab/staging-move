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
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Users, Trash2, ExternalLink } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, type Theme } from "@/lib/theme";
import { api, APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { useAuthStore } from "@/lib/auth-store";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { hapticSuccess, hapticError } from "@/lib/haptics";

interface Workspace {
  id: string;
  name: string;
  role: string;
  status: string;
  planLabel: string;
  seatLimit: number;
  memberCount: number;
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

export default function WorkspaceScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();
  const { t } = useTranslation();
  const myUserId = useAuthStore((s) => s.user?.id) ?? null;

  const [pageLoading, setPageLoading] = useState(true);
  const [featureOff, setFeatureOff] = useState(false);
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
    const res = await api.get<{ workspaces: Workspace[] }>("/api/workspaces");
    if (res.error && !res.data) {
      // 404 = feature off; any other error → also show the unavailable state.
      setFeatureOff(true);
      setPageLoading(false);
      return;
    }
    const list = res.data?.workspaces ?? [];
    setWorkspaces(list);
    if (list.length > 0) setSelectedId((cur) => cur ?? list[0].id);
    setPageLoading(false);
  }, []);

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
          setSelectedId(null);
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
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t("settings.workspace", "Workspace")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {featureOff ? (
          <Text style={styles.empty}>{t("workspace.unavailable", "Shared household workspaces (members, shared services, child accounts) are rolling out for Family & Pro — coming soon. Your plan's higher limits are already active.")}</Text>
        ) : workspaces.length === 0 ? (
          <View style={{ alignItems: "center" }}>
            <Text style={styles.empty}>
              {t("workspace.none", "You're not part of any shared workspace yet. A Family or Pro plan lets you create one.")}
            </Text>
            <TouchableOpacity
              onPress={() => openWebUrl(`${APP_WEB_URL}/pricing#family-pro`)}
              style={{
                marginTop: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: theme.colors.primary,
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 12,
              }}
              accessibilityRole="button"
              accessibilityLabel={t("workspace.upgradeWebA11y", "See Family and Pro plans on the web")}
            >
              <ExternalLink size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                {t("workspace.upgradeWeb", "See Family & Pro on the web")}
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
                    onPress={() => setSelectedId(w.id)}
                    style={[styles.chip, w.id === selectedId && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, w.id === selectedId && styles.chipTextActive]}>{w.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selected && (
              <>
                <View style={styles.card}>
                  {selected.role === "OWNER" && renaming ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <TextInput
                        value={nameInput}
                        onChangeText={setNameInput}
                        maxLength={60}
                        autoFocus
                        style={{ flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: theme.colors.text }}
                        placeholderTextColor={theme.colors.textMuted}
                      />
                      <TouchableOpacity onPress={renameWorkspace} disabled={busy}>
                        <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>{t("common.save", "Save")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setRenaming(false)} disabled={busy}>
                        <Text style={{ color: theme.colors.textTertiary }}>{t("common.cancel", "Cancel")}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={selected.role === "OWNER" ? () => { setNameInput(selected.name); setRenaming(true); } : undefined}
                      disabled={selected.role !== "OWNER"}
                      activeOpacity={selected.role === "OWNER" ? 0.6 : 1}
                    >
                      <Text style={styles.wsName}>{selected.name}{selected.role === "OWNER" ? "  ✎" : ""}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.wsMeta}>
                    {selected.planLabel} · {ROLE_LABEL[selected.role] ?? selected.role} · {selected.memberCount}/
                    {selected.seatLimit} members
                  </Text>
                  {selected.role !== "OWNER" && (
                    <TouchableOpacity onPress={leave} disabled={busy} style={styles.leaveBtn}>
                      <Text style={styles.leaveBtnText}>{t("workspace.leave", "Leave")}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.cardTitle}>{t("workspace.managedSync", "Managed sync")}</Text>
                      <Text style={styles.cardDesc}>
                        {t(
                          "workspace.managedSyncDesc",
                          "Let an owner or admin push an address change to your connected partners on your behalf.",
                        )}
                      </Text>
                    </View>
                    <Switch value={Boolean(myManagedSync)} onValueChange={toggleManagedSync} />
                  </View>
                </View>

                <Text style={styles.section}>{t("workspace.members", "MEMBERS")}</Text>
                <View style={styles.card}>
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
                            {iAmManager && managedSyncOn(m.role, m.managedSyncEnabled) ? " · sync on" : ""}
                          </Text>
                        </View>
                        {tappable && <Text style={styles.manage}>{t("workspace.manage", "Manage")}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {iAmManager && (
                  <>
                    <Text style={styles.section}>{t("workspace.invite", "INVITE A MEMBER")}</Text>
                    <View style={styles.card}>
                      <TextInput
                        value={inviteEmail}
                        onChangeText={setInviteEmail}
                        placeholder="name@email.com"
                        placeholderTextColor={theme.colors.textTertiary}
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
                        style={[styles.primaryBtn, (busy || !inviteEmail.trim()) && { opacity: 0.5 }]}
                      >
                        {busy ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.primaryBtnText}>{t("workspace.sendInvite", "Send invite")}</Text>
                        )}
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
      paddingVertical: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    empty: { fontSize: 14, color: theme.colors.textTertiary, lineHeight: 20, marginTop: 16 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 4 },
    chip: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    chipActive: { borderColor: theme.colors.primary },
    chipText: { fontSize: 13, color: theme.colors.textTertiary },
    chipTextActive: { color: theme.colors.text, fontWeight: "600" },
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginTop: 12,
    },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    wsName: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
    wsMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 4 },
    leaveBtn: {
      alignSelf: "flex-start",
      marginTop: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.error,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    leaveBtnText: { fontSize: 13, fontWeight: "600", color: theme.colors.error },
    cardTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
    cardDesc: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 4, lineHeight: 18 },
    section: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.textTertiary,
      letterSpacing: 0.5,
      marginTop: 22,
      marginLeft: 4,
    },
    memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    rowBorderTop: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 4 },
    memberName: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
    memberSub: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
    manage: { fontSize: 13, color: theme.colors.primary, fontWeight: "600" },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.colors.text,
    },
    roleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
    roleChip: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    roleChipActive: { borderColor: theme.colors.primary },
    roleChipText: { fontSize: 12, color: theme.colors.textTertiary },
    roleChipTextActive: { color: theme.colors.text, fontWeight: "600" },
    primaryBtn: {
      marginTop: 12,
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.md,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  });
