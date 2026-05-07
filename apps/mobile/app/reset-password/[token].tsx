import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Lock } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api } from "@/lib/api";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { theme } from "@/lib/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!token) {
      setError("This reset link is missing a token.");
      return;
    }
    if (!newPassword || newPassword !== confirmPassword) {
      setError("Enter matching passwords first.");
      return;
    }

    setSaving(true);
    const res = await api.post<{ success?: boolean }>("/api/auth/password/reset/confirm", {
      token,
      newPassword,
    });
    setSaving(false);

    if (res.error || !res.data?.success) {
      const message = res.error || "Could not reset your password.";
      setError(message);
      hapticError();
      return;
    }

    hapticSuccess();
    Alert.alert("Password reset", "Your password has been changed. Please sign in again.", [
      { text: "Sign in", onPress: () => router.replace("/(auth)/sign-in") },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reset password</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Lock size={28} color={theme.colors.primary} />
          </View>
          <Text style={styles.heading}>Choose a new password</Text>
          <Text style={styles.copy}>Use a strong password you have not used before.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            isPassword
            autoCapitalize="none"
            placeholder="Min 12 characters"
          />
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoCapitalize="none"
            placeholder="Repeat password"
          />
          <Button
            title={saving ? "Saving..." : "Reset password"}
            onPress={submit}
            loading={saving}
            disabled={saving || !newPassword || !confirmPassword}
            fullWidth
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 12 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryFaded,
    borderWidth: 1,
    borderColor: "rgba(127, 182, 232,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heading: { fontSize: 24, fontWeight: "800", color: theme.colors.text },
  copy: { fontSize: 14, color: theme.colors.textTertiary, lineHeight: 20, marginBottom: 8 },
  error: { color: "#E08A6E", fontSize: 13, marginBottom: 4 },
});
