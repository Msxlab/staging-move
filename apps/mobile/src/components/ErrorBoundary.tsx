import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { captureException } from "@/lib/sentry";
import i18n from "@/i18n/config";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * App-wide error boundary. React render errors that escape every screen would
 * otherwise show an unrecoverable white/black screen on native. Global JS error
 * handlers do not catch React render errors, so this is the visible fallback.
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

    return <ErrorFallback error={error} reset={this.reset} />;
  }
}

interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
}

function ErrorFallback({ reset }: ErrorFallbackProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={32} color={theme.colors.error} />
        </View>
        <Text style={styles.title}>{i18n.t("common.errorTitle")}</Text>
        <Text style={styles.message} numberOfLines={6}>
          {i18n.t("common.genericError")}
        </Text>
        <TouchableOpacity style={styles.button} onPress={reset} activeOpacity={0.7}>
          <Text style={styles.buttonText}>{i18n.t("common.retry")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    backgroundColor: theme.colors.errorFaded,
    borderWidth: 1,
    borderColor: "rgba(240, 140, 142, 0.24)",
  },
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
