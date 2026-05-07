import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Path,
  Circle,
} from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Edition VI · Champagne & Rose. Geometry mirrors apps/web/public/logo-mark.svg
// (foil curve from start dot to rose pin) so the boot screen reads as the same
// brand as the web sign-in.
export function AnimatedSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
  const markScale = useRef(new Animated.Value(0)).current;
  const markY = useRef(new Animated.Value(-40)).current;
  const sweep = useRef(new Animated.Value(0)).current;       // 0–1 along the foil curve
  const pinScale = useRef(new Animated.Value(0)).current;    // rose pin pop-in
  const ringScale = useRef(new Animated.Value(0.6)).current; // rose ripple
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.12)).current;
  const glowScale = useRef(new Animated.Value(0.85)).current;
  const overallOpacity = useRef(new Animated.Value(1)).current;
  const [introDone, setIntroDone] = useState(false);
  const didFinish = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const introAnimation = Animated.sequence([
      // Phase 1: Mark drops in
      Animated.parallel([
        Animated.spring(markScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(markY, {
          toValue: 0,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      // Phase 2: Foil curve sweeps in (start dot already visible)
      Animated.timing(sweep, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      // Phase 3: Rose pin pops at the end of the curve, ripple bursts
      Animated.parallel([
        Animated.spring(pinScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0.55,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1.9,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]);
    introAnimation.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });

    // Foil glow breathing
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowPulse, {
            toValue: 0.30,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.1,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(glowPulse, {
            toValue: 0.12,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 0.85,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    glowAnimation.start();

    return () => {
      introAnimation.stop();
      glowAnimation.stop();
    };
  }, [glowPulse, glowScale, markScale, markY, pinScale, ringOpacity, ringScale, sweep]);

  useEffect(() => {
    if (!ready || !introDone || didFinish.current) return;
    didFinish.current = true;

    const fadeAnimation = Animated.timing(overallOpacity, {
      toValue: 0,
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    fadeAnimation.start(({ finished }) => {
      if (finished) onFinishRef.current();
    });

    return () => fadeAnimation.stop();
  }, [introDone, overallOpacity, ready]);

  // The foil curve has total length ≈ 88 SVG units; sweep 0→1 maps to
  // strokeDashoffset 88→0 so the path "draws" left-to-right.
  const FOIL_LEN = 88;
  const dashOffset = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [FOIL_LEN, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: overallOpacity }]}>
      {/* Foil radial glow */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowPulse, transform: [{ scale: glowScale }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(212,132,106,0.40)", "rgba(229,201,168,0.10)", "transparent"]}
          style={styles.glowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Mark — flow-curve with rose pin */}
      <View style={styles.logoArea}>
        <Animated.View
          style={[
            styles.markContainer,
            {
              transform: [
                { scale: markScale },
                { translateY: markY },
              ],
            },
          ]}
        >
          <Svg width={180} height={180} viewBox="0 0 100 100">
            <Defs>
              <SvgLinearGradient id="splash-bg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#1A2438" />
                <Stop offset="60%" stopColor="#131C2C" />
                <Stop offset="100%" stopColor="#0A0F18" />
              </SvgLinearGradient>
              <RadialGradient id="splash-icon-glow" cx="72%" cy="24%" r="62%">
                <Stop offset="0%" stopColor="#F4E4D0" stopOpacity="0.22" />
                <Stop offset="100%" stopColor="#F4E4D0" stopOpacity="0" />
              </RadialGradient>
              <SvgLinearGradient id="splash-foil" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0%" stopColor="#B8936C" />
                <Stop offset="45%" stopColor="#E5C9A8" />
                <Stop offset="100%" stopColor="#F4E4D0" />
              </SvgLinearGradient>
              <SvgLinearGradient id="splash-rose" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#EDB99D" />
                <Stop offset="100%" stopColor="#A85A42" />
              </SvgLinearGradient>
            </Defs>

            <Rect width="100" height="100" rx="22" fill="url(#splash-bg)" />
            <Rect width="100" height="100" rx="22" fill="url(#splash-icon-glow)" />

            {/* Rose ripple */}
            <AnimatedCircle
              cx="80"
              cy="40"
              r="10"
              fill="none"
              stroke="url(#splash-rose)"
              strokeWidth="1.5"
              opacity={ringOpacity as unknown as number}
              {...({ style: { transform: [{ scale: ringScale }] } } as any)}
            />

            {/* Foil curve — animates dashoffset to "draw" itself */}
            <AnimatedCircle cx="20" cy="65" r="5.5" fill="url(#splash-foil)" />
            <AnimatedCircle cx="20" cy="65" r="1.7" fill="#0A0F18" />
            <Path
              d="M20 65 Q 30 32, 50 48 T 80 40"
              stroke="url(#splash-foil)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={FOIL_LEN}
              {...({ strokeDashoffset: dashOffset } as any)}
            />

            {/* Rose pin */}
            <AnimatedCircle
              cx="80"
              cy="40"
              r="9"
              fill="url(#splash-rose)"
              {...({ style: { transform: [{ scale: pinScale }] } } as any)}
            />
            <AnimatedCircle
              cx="80"
              cy="40"
              r="3"
              fill="#F5F1EA"
              {...({ style: { transform: [{ scale: pinScale }] } } as any)}
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Loading bar */}
      <View style={styles.loadingBarContainer}>
        <LoadingBar />
      </View>
    </Animated.View>
  );
}

function LoadingBar() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [progress]);

  return (
    <View style={styles.loadingTrack}>
      <Animated.View
        style={[
          styles.loadingFill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={["#5C9DDC", "#7FB6E8", "#DDE7F5"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, borderRadius: 2 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#0A0F18",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    top: "25%",
    alignSelf: "center",
  },
  glowGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 160,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 28,
  },
  markContainer: {
    width: 180,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingBarContainer: {
    position: "absolute",
    bottom: 80,
    width: 120,
  },
  loadingTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(245, 241, 234, 0.06)",
    overflow: "hidden",
  },
  loadingFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
});
