import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { RaccoonWalking } from "@/components/ui/RaccoonWalking";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const FOIL_LEN = 88;

export function AnimatedSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.94)).current;
  const lineProgress = useRef(new Animated.Value(0)).current;
  const endDotOpacity = useRef(new Animated.Value(0)).current;
  const overallOpacity = useRef(new Animated.Value(1)).current;
  const [introDone, setIntroDone] = useState(false);
  const [barActive, setBarActive] = useState(false);
  const didFinish = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const barTimer = setTimeout(() => setBarActive(true), 440);
    const introAnimation = Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(markScale, {
          toValue: 1,
          tension: 58,
          friction: 9,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(180),
      Animated.timing(lineProgress, {
        toValue: 1,
        duration: 820,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(endDotOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(160),
    ]);

    introAnimation.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });

    return () => {
      clearTimeout(barTimer);
      introAnimation.stop();
    };
  }, [endDotOpacity, lineProgress, markOpacity, markScale]);

  useEffect(() => {
    if (!ready || !introDone || didFinish.current) return;
    didFinish.current = true;

    const fadeAnimation = Animated.timing(overallOpacity, {
      toValue: 0,
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    fadeAnimation.start(({ finished }) => {
      if (finished) onFinishRef.current();
    });

    return () => fadeAnimation.stop();
  }, [introDone, overallOpacity, ready]);

  const dashOffset = lineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [FOIL_LEN, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: overallOpacity }]}>
      {/* Branded mascot beat: the LocateFlow raccoon strolls in with a little
          suitcase while the wordmark mark draws. Purely decorative — it owns its
          own Reanimated drivers and never touches the ready/onFinish hand-off, so
          it can never block or delay app readiness. */}
      <View style={styles.mascotArea} pointerEvents="none">
        <RaccoonWalking size={150} />
      </View>

      <View style={styles.logoArea}>
        <Animated.View
          style={[
            styles.markContainer,
            {
              opacity: markOpacity,
              transform: [{ scale: markScale }],
            },
          ]}
        >
          <Svg width={168} height={168} viewBox="0 0 100 100">
            <Defs>
              <SvgLinearGradient id="splash-bg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#1A2438" />
                <Stop offset="60%" stopColor="#131C2C" />
                <Stop offset="100%" stopColor="#0A0F18" />
              </SvgLinearGradient>
              <SvgLinearGradient id="splash-shine" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#ECF1F8" stopOpacity="0.15" />
                <Stop offset="48%" stopColor="#ECF1F8" stopOpacity="0.05" />
                <Stop offset="100%" stopColor="#ECF1F8" stopOpacity="0" />
              </SvgLinearGradient>
              <SvgLinearGradient id="splash-foil" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0%" stopColor="#5C9DDC" />
                <Stop offset="45%" stopColor="#7FB6E8" />
                <Stop offset="100%" stopColor="#DDE7F5" />
              </SvgLinearGradient>
            </Defs>

            <Rect width="100" height="100" rx="22" fill="url(#splash-bg)" />
            <Rect width="100" height="100" rx="22" fill="url(#splash-shine)" />
            <Path
              d="M20 65 Q 30 32, 50 48 T 80 40"
              stroke="rgba(221, 231, 245, 0.13)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx="20" cy="65" r="5.4" fill="#7FB6E8" />
            <Circle cx="20" cy="65" r="1.7" fill="#0A0F18" />
            <Path
              d="M20 65 Q 30 32, 50 48 T 80 40"
              stroke="url(#splash-foil)"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={FOIL_LEN}
              {...({ strokeDashoffset: dashOffset } as any)}
            />
            <AnimatedCircle
              cx="80"
              cy="40"
              r="6.8"
              fill="#7FB6E8"
              opacity={endDotOpacity as unknown as number}
            />
            <AnimatedCircle
              cx="80"
              cy="40"
              r="2.2"
              fill="#ECF1F8"
              opacity={endDotOpacity as unknown as number}
            />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.loadingBarContainer}>
        <LoadingBar active={barActive} />
      </View>
    </Animated.View>
  );
}

function LoadingBar({ active }: { active: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1700,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();

    return () => animation.stop();
  }, [active, progress]);

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
          style={styles.loadingGradient}
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
  mascotArea: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 28,
  },
  markContainer: {
    width: 168,
    height: 168,
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
    backgroundColor: "rgba(236, 241, 248, 0.06)",
    overflow: "hidden",
  },
  loadingFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  loadingGradient: {
    flex: 1,
    borderRadius: 2,
  },
});
