import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { LayoutGrid } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { theme } from "@/lib/theme";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { getCategoryIcon, getCategoryLabel } from "@/lib/recommendation-engine";

export type CategoryChip = {
  value: string;
  label?: string;
  count?: number;
};

interface CategoryChipRowProps {
  categories: CategoryChip[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  showAll?: boolean;
}

/**
 * Horizontal scrollable row of category chips.
 * `null` selection means "All". Chips display category icon + label + optional count.
 */
export function CategoryChipRow({ categories, selected, onSelect, showAll = true }: CategoryChipRowProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {showAll ? (
        <TouchableOpacity
          onPress={() => onSelect(null)}
          style={[styles.chip, selected === null && styles.chipSelected]}
          accessibilityRole="button"
          accessibilityLabel={t("providers.showAllCategories")}
          accessibilityState={{ selected: selected === null }}
          activeOpacity={0.7}
        >
          <LayoutGrid
            size={14}
            color={selected === null ? theme.colors.primary : theme.colors.textSecondary}
          />
          <Text style={[styles.chipText, selected === null && styles.chipTextSelected]}>{t("common.all")}</Text>
        </TouchableOpacity>
      ) : null}

      {categories.map((c) => {
        const isSelected = selected === c.value;
        const label = c.label ?? getCategoryLabel(c.value);
        return (
          <TouchableOpacity
            key={c.value}
            onPress={() => onSelect(isSelected ? null : c.value)}
            style={[styles.chip, isSelected && styles.chipSelected]}
            accessibilityRole="button"
            accessibilityLabel={t("providers.filterByCategory", { category: label })}
            accessibilityState={{ selected: isSelected }}
            activeOpacity={0.7}
          >
            <CategoryIcon
              emoji={getCategoryIcon(c.value)}
              size={14}
              color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
              {label}
            </Text>
            {typeof c.count === "number" && c.count > 0 ? (
              <View style={[styles.countPill, isSelected && styles.countPillSelected]}>
                <Text style={[styles.countText, isSelected && styles.countTextSelected]}>{c.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipSelected: {
    backgroundColor: theme.colors.primaryFaded,
    borderColor: "rgba(212, 132, 106,0.4)",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
  },
  chipTextSelected: {
    color: theme.colors.primary,
  },
  countPill: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.full,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  countPillSelected: {
    backgroundColor: "rgba(212, 132, 106,0.25)",
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textTertiary,
  },
  countTextSelected: {
    color: theme.colors.primary,
  },
});
