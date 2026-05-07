import React, { useState, useMemo } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useAppTheme, type Theme } from "@/lib/theme";
import { Eye, EyeOff } from "lucide-react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  isPassword?: boolean;
}

export function Input({
  label,
  error,
  hint,
  icon,
  leftIcon,
  rightIcon,
  containerStyle,
  isPassword,
  style,
  ...props
}: InputProps) {

  // theme: hook-injected styles

  const theme = useAppTheme();

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [focused, setFocused] = useState(false);
  const [secureEntry, setSecureEntry] = useState(isPassword);
  const leadingIcon = leftIcon || icon;

  return (
    <View style={containerStyle}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        {leadingIcon && <View style={styles.iconLeft}>{leadingIcon}</View>}
        <TextInput
          style={[styles.input, leadingIcon ? styles.inputWithIcon : undefined, style]}
          placeholderTextColor={theme.colors.textMuted}
          selectionColor={theme.colors.primary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secureEntry}
          accessibilityLabel={props.accessibilityLabel || label || props.placeholder}
          accessibilityHint={props.accessibilityHint || error || hint}
          accessibilityState={{ disabled: props.editable === false }}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setSecureEntry(!secureEntry)}
            style={styles.iconRight}
            accessibilityRole="button"
            accessibilityLabel={secureEntry ? "Show password" : "Hide password"}
            accessibilityHint="Toggles password visibility"
          >
            {secureEntry ? (
              <Eye size={18} color={theme.colors.textMuted} />
            ) : (
              <EyeOff size={18} color={theme.colors.textTertiary} />
            )}
          </TouchableOpacity>
        )}
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputFocused: {
    borderColor: theme.colors.borderFocus,
    backgroundColor: theme.colors.card,
  },
  inputError: {
    // Aurora coral (#F08C8E) at 50% — matches `theme.colors.error`.
    borderColor: "rgba(240, 140, 142, 0.50)",
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputWithIcon: {
    paddingLeft: 8,
  },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  error: {
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 4,
    marginLeft: 2,
  },
});
