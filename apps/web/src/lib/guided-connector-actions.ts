export interface GuidedConnectorAction {
  key: string;
  label: string;
  url: string;
  helperText: string;
}

const GUIDED_CONNECTOR_ACTIONS: Record<string, GuidedConnectorAction> = {
  "usps:MAIL_FORWARDING:DEEP_LINK": {
    key: "usps:MAIL_FORWARDING:DEEP_LINK",
    label: "Open update",
    url: "https://moversguide.usps.com/",
    helperText: "Continue on USPS to submit and verify your mail-forwarding request.",
  },
};

export function getGuidedConnectorAction(actionKey: string | null | undefined): GuidedConnectorAction | null {
  if (!actionKey) return null;
  return GUIDED_CONNECTOR_ACTIONS[actionKey] ?? null;
}
