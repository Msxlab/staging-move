import React, { useState } from "react";
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
  TouchableOpacity, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Mail, Lock, ArrowRight } from "lucide-react-native";
import { theme } from "@/lib/theme";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LogoBrand } from "@/components/ui/LogoBrand";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { api, API_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { registerForPushNotifications } from "@/lib/push";

export default function SignInScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const webBase = API_URL.replace(/\/api\/?$/, "");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const res = await api.post<{ token?: string; user?: any; requiresMfa?: boolean; error?: string }>(
      "/api/auth/login",
      {
        email: email.trim(),
        password,
        ...(requiresMfa && mfaCode ? { mfaCode } : {}),
      },
    );

    if (res.data?.requiresMfa) {
      setRequiresMfa(true);
      setLoading(false);
      return;
    }

    if (res.error || !res.data?.token || !res.data.user) {
      setError(res.error || "Sign-in failed.");
      hapticError();
      setLoading(false);
      return;
    }

    await setSession(res.data.token, res.data.user);
    hapticSuccess();
    registerForPushNotifications().catch(() => {});
    router.replace("/(tabs)");
  };

  const openOAuth = (provider: "google" | "apple") => {
    // OAuth on mobile hands off to an in-app browser. The server sets a session
    // cookie at the end of the flow, which the WebView/browser can carry back
    // via the expo-web-browser auth-session return URL. For simplicity in MVP
    // we just open the web URL — the user sees the /dashboard cookie session
    // and can return to the app manually. A tighter flow (expo-auth-session)
    // can be added post-MVP.
    Linking.openURL(`${webBase}/api/auth/oauth/${provider}?redirect=/dashboard`);
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
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Welcome back to LocateFlow</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!requiresMfa && (
          <>
            <Button
              title="Continue with Google"
              variant="outline"
              onPress={() => openOAuth("google")}
              style={styles.oauthBtn}
            />
            <Button
              title="Continue with Apple"
              variant="primary"
              onPress={() => openOAuth("apple")}
              style={{ ...styles.oauthBtn, backgroundColor: "#000" }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon={<Mail size={16} color={theme.colors.textMuted} />}
            />
            <Input
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              leftIcon={<Lock size={16} color={theme.colors.textMuted} />}
            />
          </>
        )}

        {requiresMfa && (
          <Input
            placeholder="6-digit authenticator code"
            value={mfaCode}
            onChangeText={(v) => setMfaCode(v.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
        )}

        <Button
          title={loading ? "Signing in…" : requiresMfa ? "Verify" : "Sign in"}
          onPress={handleSubmit}
          disabled={loading || !email || !password || (requiresMfa && mfaCode.length !== 6)}
          rightIcon={<ArrowRight size={16} color="#fff" />}
          style={{ marginTop: 12 }}
        />

        {!requiresMfa && (
          <>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/sign-up")}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                Don't have an account? <Text style={styles.linkEmphasis}>Create one</Text>
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
  oauthBtn: { marginBottom: 6 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.textMuted, fontSize: 10, letterSpacing: 1.5 },
  linkRow: { alignItems: "center", marginTop: 10 },
  linkText: { color: theme.colors.textMuted, fontSize: 13 },
  linkEmphasis: { color: theme.colors.primary, fontWeight: "600" },
});
