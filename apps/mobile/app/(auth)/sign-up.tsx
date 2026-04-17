import React, { useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, User, CheckCircle2 } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api, API_URL } from "@/lib/api";

export default function SignUpScreen() {
  const router = useRouter();
  const webBase = API_URL.replace(/\/api\/?$/, "");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ success?: boolean; error?: string }>("/api/auth/register", {
      email: email.trim(),
      password,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    });

    if (res.error || !res.data?.success) {
      setError(res.error || "Sign-up failed.");
      hapticError();
      setLoading(false);
      return;
    }

    hapticSuccess();
    setDone(true);
    setLoading(false);
  };

  const openOAuth = (provider: "google" | "apple") => {
    Linking.openURL(`${webBase}/api/auth/oauth/${provider}?redirect=/dashboard`);
  };

  if (done) {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <CheckCircle2 size={48} color="#34d399" style={{ alignSelf: "center" }} />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to {email}. Click it to confirm your address, then sign in.
        </Text>
        <Button
          title="Back to sign in"
          onPress={() => router.replace("/(auth)/sign-in")}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LogoBrand />
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Free 7-day trial, no card required</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title="Sign up with Google"
          variant="outline"
          onPress={() => openOAuth("google")}
          style={styles.oauthBtn}
        />
        <Button
          title="Sign up with Apple"
          variant="primary"
          onPress={() => openOAuth("apple")}
          style={{ ...styles.oauthBtn, backgroundColor: "#000" }}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input placeholder="First name" value={firstName} onChangeText={setFirstName}
              leftIcon={<User size={16} color={theme.colors.textMuted} />} />
          </View>
          <View style={{ flex: 1 }}>
            <Input placeholder="Last name" value={lastName} onChangeText={setLastName} />
          </View>
        </View>

        <Input
          placeholder="Email" value={email} onChangeText={setEmail}
          keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
        />
        <Input
          placeholder="Password (12+ chars)" value={password} onChangeText={setPassword}
          secureTextEntry autoComplete="password-new"
          leftIcon={<Lock size={16} color={theme.colors.textMuted} />}
        />
        <Text style={styles.hint}>
          At least 12 characters with upper, lower, digit, and special.
        </Text>

        <Button
          title={loading ? "Creating…" : "Create account"}
          onPress={handleSubmit}
          disabled={loading || !email || !password}
          style={{ marginTop: 12 }}
        />

        <TouchableOpacity
          onPress={() => router.replace("/(auth)/sign-in")}
          style={{ alignItems: "center", marginTop: 12 }}
        >
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkEmphasis}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 10, flexGrow: 1, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "700", color: theme.colors.text, marginTop: 24 },
  subtitle: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 16 },
  error: { color: "#f87171", fontSize: 13, marginBottom: 8 },
  oauthBtn: { marginBottom: 6 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  row: { flexDirection: "row", gap: 8 },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: -4 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
