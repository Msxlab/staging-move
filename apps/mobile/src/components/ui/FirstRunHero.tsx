import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useAppTheme, type Theme } from "@/lib/theme";
import { RaccoonMascot } from "@/components/ui/RaccoonMascot";
import { hapticLight } from "@/lib/haptics";

/**
 * Warm first-run hero for the dashboard, shown to users who have nothing set up
 * yet (no addresses / services). PlanHero only renders for Family/Pro, so Free
 * users would otherwise land on a cold "0 / 0 / $0" grid — this gives them a
 * friendly raccoon greeting + a single clear "Set up your first address" CTA.
 *
 * Animation budget matches PlanHero exactly: a spring entrance + a tiny ±1px
 * breathing bob on the mascot (the agreed idle ceiling). Honours reduce-motion
 * (settled pose, no loops) and cancels the loop on unmount.
 */
export function FirstRunHero({ onSetup }: { onSetup: () => void }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();

  const enter = useSharedValue(reduceMotion ? 1 : 0);
  const bob = useSharedValue(0);

  React.useEffect(() => {
    if (reduceMotion) {
      enter.value = 1;
      return;
    }
    enter.value = withSpring(1, { mass: 0.6, damping: 12, stiffness: 130 });
    bob.value = withRepeat(
      withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(enter);
      cancelAnimation(bob);
    };
  }, [reduceMotion, enter, bob]);

  const mascotStyle = useAnimatedStyle(() => {
    const enterScale = 0.9 + enter.value * 0.1;
    const bobY = (0.5 - bob.value) * 2; // ±1px
    return {
      opacity: enter.value,
      transform: [{ translateY: bobY }, { scale: enterScale }],
    };
  });

  const handlePress = () => {
    hapticLight();
    onSetup();
  };

  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <LinearGradient
        colors={[`${theme.colors.primary}24`, `${theme.colors.primary}00`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1.2 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.top}>
        <Animated.View style={mascotStyle}>
          <RaccoonMascot size={58} fur="#aeb9c6" variant="kid" />
        </Animated.View>
        <View style={styles.copy}>
          <Text style={styles.title}>{t("dashboard.firstRunTitle")}</Text>
          <Text style={styles.subtitle}>{t("dashboard.firstRunBody")}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.cta}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t("dashboard.firstRunCta")}
      >
        <Text style={styles.ctaText}>{t("dashboard.firstRunCta")}</Text>
        <ArrowRight size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      marginTop: 16,
      padding: 16,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: `${t.colors.primary}33`,
    },
    top: { flexDirection: "row", alignItems: "center", gap: 12 },
    copy: { flex: 1 },
    title: { fontSize: 16, fontWeight: "800", color: t.colors.text },
    subtitle: {
      fontSize: 12.5,
      color: t.colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      height: 44,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
      ...t.shadow.glow,
    },
    ctaText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  });
