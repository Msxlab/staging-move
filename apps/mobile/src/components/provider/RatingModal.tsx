import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Star, X } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

interface RatingModalProps {
  visible: boolean;
  providerId: string;
  providerName: string;
  initialRating?: number | null;
  initialComment?: string | null;
  onClose: () => void;
  onSaved: (payload: { avgRating: number | null; reviewCount: number; rating: number }) => void;
}

/**
 * Modal for submitting a 1-5 star rating + optional comment.
 * POSTs to /api/providers/[id]/reviews and returns refreshed aggregates.
 */
export function RatingModal({
  visible,
  providerId,
  providerName,
  initialRating,
  initialComment,
  onClose,
  onSaved,
}: RatingModalProps) {
  const [rating, setRating] = useState<number>(initialRating ?? 0);
  const [comment, setComment] = useState<string>(initialComment ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(initialRating ?? 0);
      setComment(initialComment ?? "");
    }
  }, [visible, initialRating, initialComment]);

  const submit = async () => {
    if (rating < 1) {
      Alert.alert("Pick a rating", "Tap a star between 1 and 5 to rate this provider.");
      return;
    }
    setSaving(true);
    const res = await api.post<{ avgRating: number | null; reviewCount: number }>(
      `/api/providers/${providerId}/reviews`,
      { rating, comment: comment.trim() || undefined }
    );
    setSaving(false);

    if (res.error || !res.data) {
      Alert.alert("Couldn't save", res.error || "Unknown error — please try again.");
      return;
    }

    onSaved({
      avgRating: res.data.avgRating,
      reviewCount: res.data.reviewCount,
      rating,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate {providerName}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close rating"
              style={styles.closeBtn}
            >
              <X size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setRating(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
                accessibilityState={{ selected: rating >= n }}
                style={styles.starBtn}
                activeOpacity={0.7}
              >
                <Star
                  size={36}
                  color={rating >= n ? theme.colors.amber.text : theme.colors.textMuted}
                  fill={rating >= n ? theme.colors.amber.text : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.commentInput}
            placeholder="Share what worked or didn't (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            accessibilityLabel="Review comment"
            accessibilityHint="Optional — describe your experience in 1000 characters or less"
          />

          <Button
            title={saving ? "Saving..." : "Submit rating"}
            onPress={submit}
            variant="primary"
            size="md"
            fullWidth
            disabled={saving || rating < 1}
            loading={saving}
            style={{ marginTop: 16 }}
          />

          {saving ? null : (
            <TouchableOpacity onPress={onClose} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}

          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius["2xl"],
    borderTopRightRadius: theme.radius["2xl"],
    padding: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  starBtn: {
    padding: 4,
  },
  commentInput: {
    minHeight: 100,
    maxHeight: 160,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  cancel: {
    alignItems: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: "500",
  },
  savingRow: {
    alignItems: "center",
    marginTop: 12,
  },
});
