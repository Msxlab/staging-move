import SubscriptionManagementPage from "@/components/settings/subscription-management";

export default function SettingsSubscriptionPage() {
  return <SubscriptionManagementPage initialNowIso={new Date().toISOString()} />;
}
