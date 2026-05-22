import React, { useEffect, useRef, useState, useMemo } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";
import { MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/Input";
import { useAppTheme, type Theme } from "@/lib/theme";
import {
  createAddressAutocompleteSessionToken,
  lookupAddressAutocomplete,
  searchAddressAutocomplete,
  type AddressAutocompleteResult,
} from "@/lib/address-autocomplete";
import type { AddressAutocompletePrediction } from "@locateflow/shared";

const GOOGLE_POWERED_BY_SRC = {
  uri: "https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png",
};

interface AddressAutocompleteFieldProps {
  label?: string;
  value: string;
  placeholder?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  onValueChange: (value: string) => void;
  onSelect: (result: AddressAutocompleteResult) => void;
  onManualChange?: () => void;
}

export function AddressAutocompleteField({
  label,
  value,
  placeholder,
  hint,
  containerStyle,
  onValueChange,
  onSelect,
  onManualChange,
}: AddressAutocompleteFieldProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const sessionTokenRef = useRef(createAddressAutocompleteSessionToken());
  const skipNextQueryRef = useRef<string | null>(null);
  const [predictions, setPredictions] = useState<AddressAutocompletePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const helperText = hint || (enabled ? t("addresses.autocompleteHint") : t("addresses.autocompleteUnavailable"));

  useEffect(() => {
    const query = value.trim();
    if (skipNextQueryRef.current && skipNextQueryRef.current === query) {
      skipNextQueryRef.current = null;
      setPredictions([]);
      return;
    }
    if (query.length < 3) {
      setPredictions([]);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      const res = await searchAddressAutocomplete(query, sessionTokenRef.current);
      if (!active) return;
      setLoading(false);
      if (res.error) {
        setPredictions([]);
        return;
      }
      setEnabled(res.data?.enabled !== false);
      setPredictions(res.data?.predictions || []);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [value]);

  async function handleSelect(prediction: AddressAutocompletePrediction) {
    setLoading(true);
    const res = await lookupAddressAutocomplete(prediction.placeId, sessionTokenRef.current);
    setLoading(false);
    if (res.error || !res.data?.result) {
      return;
    }
    skipNextQueryRef.current = res.data.result.street || prediction.primaryText;
    onSelect(res.data.result);
    setPredictions([]);
    sessionTokenRef.current = createAddressAutocompleteSessionToken();
  }

  return (
    <View style={containerStyle}>
      <Input
        label={label}
        value={value}
        placeholder={placeholder}
        onChangeText={(nextValue) => {
          onValueChange(nextValue);
          onManualChange?.();
        }}
        rightIcon={loading ? <ActivityIndicator size="small" color={theme.colors.primary} /> : enabled ? <MapPin size={16} color={theme.colors.textMuted} /> : null}
      />
      <Text style={styles.hint}>{helperText}</Text>
      {predictions.length > 0 ? (
        <View style={styles.resultsCard}>
          {predictions.map((prediction) => (
            <TouchableOpacity
              key={prediction.placeId}
              style={styles.resultRow}
              activeOpacity={0.8}
              onPress={() => void handleSelect(prediction)}
            >
              <Text style={styles.resultPrimary}>{prediction.primaryText}</Text>
              <Text style={styles.resultSecondary}>{prediction.secondaryText || prediction.description}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.attributionFooter}>
            <Image
              source={GOOGLE_POWERED_BY_SRC}
              style={styles.googleAttribution}
              resizeMode="contain"
              accessibilityLabel="Powered by Google"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
  resultsCard: {
    marginTop: 8,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  resultRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  resultPrimary: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  resultSecondary: {
    marginTop: 2,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  attributionFooter: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  googleAttribution: {
    width: 120,
    height: 15,
  },
});
