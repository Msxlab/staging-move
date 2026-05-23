import React, { useState, useMemo } from "react";
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Check, ChevronDown, ChevronUp, FileText, ShieldAlert } from "lucide-react-native";
import { APP_WEB_URL } from "@/lib/api";
import { openWebUrl } from "@/lib/in-app-browser";
import { useAppTheme, type Theme } from "@/lib/theme";
import {
  LEGAL_CONSENT_DOCUMENTS,
  getDefaultLegalConsents,
  type LegalConsentDocumentKey,
  type LegalConsentState,
} from "@/lib/legal";

const documentIcons = {
  terms: FileText,
  disclaimer: ShieldAlert,
} as const;

type LegalConsentPanelProps = {
  consents: LegalConsentState;
  onChange: (next: LegalConsentState) => void;
  title?: string;
  description?: string;
  compact?: boolean;
  disabled?: boolean;
};

export function LegalConsentPanel({
  consents,
  onChange,
  title = "Required legal acknowledgements",
  description = "You must accept both documents before continuing.",
  disabled = false,
}: LegalConsentPanelProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [expanded, setExpanded] = useState<LegalConsentDocumentKey | null>(null);

  const updateConsent = (key: LegalConsentDocumentKey, checked: boolean) => {
    onChange(
      getDefaultLegalConsents({
        ...consents,
        [key === "terms" ? "termsAccepted" : "disclaimerAccepted"]: checked,
      }),
    );
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.list}>
        {LEGAL_CONSENT_DOCUMENTS.map((document) => {
          const Icon = documentIcons[document.key];
          const checked = document.key === "terms" ? consents.termsAccepted : consents.disclaimerAccepted;
          const isExpanded = expanded === document.key;
          return (
            <View key={document.key} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.headerMain}>
                  <View style={styles.iconWrap}>
                    <Icon size={16} color={theme.colors.primaryLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{document.title}</Text>
                    <Text style={styles.cardSummary}>{document.summary}</Text>
                  </View>
                </View>
                <TouchableOpacity disabled={disabled} onPress={() => setExpanded(isExpanded ? null : document.key)} style={styles.expandBtn}>
                  {isExpanded ? <ChevronUp size={16} color={theme.colors.textSecondary} /> : <ChevronDown size={16} color={theme.colors.textSecondary} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                disabled={disabled}
                onPress={() => updateConsent(document.key, !checked)}
                activeOpacity={0.85}
                style={styles.checkboxRow}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked, disabled && styles.checkboxDisabled]}>
                  {checked ? <Check size={14} color="#fff" /> : null}
                </View>
                <Text style={styles.checkboxLabel}>{document.checkboxLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={disabled}
                onPress={() => void openWebUrl(`${APP_WEB_URL}${document.route}`)}
                style={styles.fullLink}
              >
                <Text style={styles.fullLinkText}>Read full document</Text>
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.sectionBox}>
                  <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                    {document.sections.map((section) => (
                      <View key={section.heading} style={styles.sectionItem}>
                        <Text style={styles.sectionTitle}>{section.heading}</Text>
                        {section.paragraphs.map((paragraph) => (
                          <Text key={paragraph} style={styles.sectionText}>{paragraph}</Text>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  wrapper: { marginTop: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: "700", color: theme.colors.text },
  description: { fontSize: 13, lineHeight: 20, color: theme.colors.textTertiary },
  list: { gap: 12 },
  card: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: 14,
    gap: 12,
  },
  headerRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  headerMain: { flexDirection: "row", gap: 10, flex: 1 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryFaded,
  },
  expandBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  cardSummary: { marginTop: 4, fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  checkboxDisabled: { opacity: 0.5 },
  checkboxLabel: { flex: 1, fontSize: 13, lineHeight: 20, color: theme.colors.textSecondary },
  fullLink: {
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fullLinkText: { color: theme.colors.primaryLight, fontSize: 12, fontWeight: "700" },
  sectionBox: {
    maxHeight: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 12,
    gap: 12,
  },
  sectionItem: { gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  sectionText: { fontSize: 12, lineHeight: 19, color: theme.colors.textSecondary },
});
