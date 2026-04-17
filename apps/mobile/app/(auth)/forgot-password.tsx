import React, { useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ success?: boolean; error?: string }>(
      "/api/auth/password/reset/request",
      { email: email.trim() },
    );

    setLoading(false);

    if (res.error) {
      setError(res.error);
      hapticError();
      return;
    }

    setSent(true);
    hapticSuccess();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <LogoBrand />

        {sent ? (
          <View style={styles.sentBox}>
            <CheckCircle2 size={48} color={theme.colors.primary} />
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>
              If an account exists for {email.trim()}, a password reset link has been sent.
              Follow the link to set a new password.
            </Text>
            <Button
              title="Back to sign in"
              onPress={() => router.replace("/(auth)/sign-in")}
              style={{ marginTop: 16 }}
            />
          </View>
        ) : (
          <>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter your account email and we'll send you a link to reset it.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
            />

            <Button
              title={loading ? "Sending…" : "Send reset link"}
              onPress={handleSubmit}
              disabled={loading || !email}
              rightIcon={<ArrowRight size={16} color="#fff" />}
              style={{ marginTop: 12 }}
            />

            <TouchableOpacity
              onPress={() => router.replace("/(auth)/sign-in")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                Remembered it? <Text style={styles.linkEmphasis}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  sentBox: { alignItems: "center", paddingVertical: 32, gap: 8 },
  linkRow: { alignItems: "center", marginTop: 16 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
