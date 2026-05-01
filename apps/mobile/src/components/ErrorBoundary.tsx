import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { theme } from "@/lib/theme";
import { captureException } from "@/lib/sentry";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-wide error boundary. React render errors that escape every screen would
 * otherwise show an unrecoverable white/black screen on native — `setGlobalHandler`
 * in sentry.ts catches uncaught JS errors but does NOT catch React render errors,
 * so this is the only safety net for the user-facing UI when a screen throws.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { componentStack: info.componentStack ?? undefined });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, error);

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={6}>
            {error.message || "An unexpected error occurred. Please try again."}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.7}>
            <Text style={styles.buttonText}>Try again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.text, marginBottom: 8, textAlign: "center" },
  message: { fontSize: 14, color: theme.colors.textTertiary, textAlign: "center", lineHeight: 20, marginBottom: 24, maxWidth: 320 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 28,
    ...theme.shadow.glow,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
