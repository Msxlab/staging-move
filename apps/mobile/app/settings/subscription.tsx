import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Check,
  Crown,
  Zap,
} from "lucide-react-native";
import { theme } from "@/lib/theme";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Badge as UiBadge } from "@/components/ui/Badge";
import { hapticError, hapticSuccess } from "@/lib/haptics";

const PLANS = [
  {
    key: "FREE_TRIAL",
    name: "Free Trial",
    price: "Free",
    period: "7 days",
    features: [
      "Up to 2 addresses",
      "Up to 10 services",
      "Basic moving checklist",
    ],
  },
  {
    key: "INDIVIDUAL",
    name: "Individual",
    price: "$4.99",
    period: "/month",
    features: [
      "Up to 10 addresses",
      "Up to 100 services",
      "Full moving planner",
      "QR box tracking",
    ],
  },
] as const;

type SubscriptionRecord = {
  plan?: string | null;
  status?: string | null;
  stripeCustomerId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  premiumUntil?: string | null;
};

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function LegacySubscriptionScreen() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    const res = await api.get<any>("/api/profile");
    if (res.data) {
      setSubscription(res.data.subscription || null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchSubscription();
    setLoading(false);
  }, [fetchSubscription]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(useCallback(() => {
    void fetchSubscription();
  }, [fetchSubscription]));

  const currentPlanKey = subscription?.plan || "FREE_TRIAL";
  const currentStatus = subscription?.status || "TRIALING";
  const currentPlan = useMemo(
    () => PLANS.find((plan) => plan.key === currentPlanKey) || PLANS[0],
    [currentPlanKey]
  );
  const periodEndLabel = formatDateLabel(subscription?.stripeCurrentPeriodEnd || subscription?.premiumUntil);
  const trialEndLabel = formatDateLabel(subscription?.trialEndsAt);
  const canManageBilling = !!subscription?.stripeCustomerId;

  const openExternalUrl = useCallback(async (url: string) => {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      hapticError();
      Alert.alert("Unavailable", "This billing link could not be opened on your device.");
      return;
    }

    await Linking.openURL(url);
  }, []);

  const handleUpgrade = useCallback(async (planKey: "INDIVIDUAL") => {
    setProcessingPlan(planKey);
    const res = await api.post<any>("/api/stripe/checkout", { plan: planKey });
    setProcessingPlan(null);

    if (res.error || !res.data?.url) {
      hapticError();
      Alert.alert("Upgrade unavailable", res.error || "Failed to start checkout.");
      return;
    }

    hapticSuccess();
    await openExternalUrl(res.data.url);
  }, [openExternalUrl]);

  const handleManageBilling = useCallback(async () => {
    setProcessingPlan("MANAGE");
    const res = await api.post<any>("/api/stripe/portal", {});
    setProcessingPlan(null);

    if (res.error || !res.data?.url) {
      hapticError();
      Alert.alert("Billing unavailable", res.error || "Failed to open billing portal.");
      return;
    }

    hapticSuccess();
    await openExternalUrl(res.data.url);
  }, [openExternalUrl]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back" accessibilityHint="Returns to settings">
            <ArrowLeft size={22} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Subscription</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to settings"
        >
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Subscription</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.currentPlanCard}>
          <View style={styles.currentPlanLeft}>
            <View style={styles.currentPlanIcon}>
              <Crown size={18} color={theme.colors.amber.text} />
            </View>
            <View>
              <Text style={styles.currentPlanTitle}>{currentPlan.name}</Text>
              <Text style={styles.currentPlanMeta}>
                {periodEndLabel
                  ? `Next billing: ${periodEndLabel}`
                  : trialEndLabel
                    ? `Trial ends: ${trialEndLabel}`
                    : "Manage your plan and billing"}
              </Text>
            </View>
          </View>
          <UiBadge
            label={currentStatus}
            variant={currentStatus === "ACTIVE" || currentStatus === "TRIALING" ? "success" : "neutral"}
          />
        </View>

        <View style={styles.heroBox}>
          <Crown size={32} color={theme.colors.amber.text} />
          <Text style={styles.heroTitle}>Choose Your Plan</Text>
          <Text style={styles.heroDesc}>
            Upgrade to unlock all features and make your move seamless.
          </Text>
        </View>

        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            variant={plan.key === currentPlanKey ? "glow" : "default"}
            style={{ marginTop: 14 }}
          >
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.key === currentPlanKey && <UiBadge label="Current" variant="success" />}
                </View>
                <Text style={styles.planPrice}>
                  {plan.price}
                  <Text style={styles.planPeriod}> {plan.period}</Text>
                </Text>
              </View>
            </View>

            <View style={styles.featureList}>
              {plan.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Check size={14} color={theme.colors.emerald.text} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            {plan.key === currentPlanKey ? (
              canManageBilling ? (
                <TouchableOpacity
                  style={styles.manageBtn}
                  activeOpacity={0.7}
                  onPress={handleManageBilling}
                  disabled={processingPlan === "MANAGE"}
                  accessibilityRole="button"
                  accessibilityLabel="Manage billing"
                  accessibilityHint="Opens the billing portal"
                  accessibilityState={{ disabled: processingPlan === "MANAGE" }}
                >
                  {processingPlan === "MANAGE" ? (
                    <ActivityIndicator color={theme.colors.primary} />
                  ) : (
                    <Text style={styles.manageBtnText}>Manage Billing</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel="Current plan" accessibilityState={{ disabled: true }}>
                  <Text style={styles.currentBtnText}>Current Plan</Text>
                </TouchableOpacity>
              )
            ) : plan.key === "FREE_TRIAL" ? (
              <TouchableOpacity style={styles.currentBtn} disabled accessibilityRole="button" accessibilityLabel="Free trial plan information" accessibilityState={{ disabled: true }}>
                <Text style={styles.currentBtnText}>Available by default</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.upgradeBtn}
                activeOpacity={0.7}
                onPress={() => handleUpgrade(plan.key)}
                disabled={processingPlan === plan.key}
                accessibilityRole="button"
                accessibilityLabel={`Upgrade to ${plan.name}`}
                accessibilityHint="Opens secure checkout in your browser"
                accessibilityState={{ disabled: processingPlan === plan.key }}
              >
                {processingPlan === plan.key ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Zap size={16} color="#fff" />
                    <Text style={styles.upgradeBtnText}>Upgrade to {plan.name}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </Card>
        ))}

        <Text style={styles.footer}>
          Billing opens in your browser through Stripe checkout and portal.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: theme.colors.textTertiary },
  currentPlanCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    backgroundColor: "rgba(249,115,22,0.08)",
    padding: 16,
  },
  currentPlanLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 12 },
  currentPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,115,22,0.14)",
  },
  currentPlanTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  currentPlanMeta: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  heroBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  heroDesc: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", maxWidth: 280 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  planName: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  planPrice: { fontSize: 28, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  planPeriod: { fontSize: 14, fontWeight: "400", color: theme.colors.textTertiary },
  featureList: { marginTop: 16, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 13, color: theme.colors.textSecondary },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 14, marginTop: 16, ...theme.shadow.glow,
  },
  manageBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    paddingVertical: 14,
    marginTop: 16,
  },
  manageBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
  currentBtn: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    marginTop: 16,
    opacity: 0.7,
  },
  currentBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.textMuted },
  upgradeBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  footer: {
    textAlign: "center", fontSize: 12, color: theme.colors.textMuted, marginTop: 24,
  },
});

export default LegacySubscriptionScreen;
