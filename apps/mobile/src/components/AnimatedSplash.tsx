import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { LogoBrand } from "@/components/ui/LogoBrand";

export function AnimatedSplash({ onFinish, ready = true }: { onFinish: () => void; ready?: boolean }) {
  const reduceMotion = useReducedMotion();
  const markOpacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const markScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.94)).current;
  const overallOpacity = useRef(new Animated.Value(1)).current;
  const [introDone, setIntroDone] = useState(reduceMotion);
  const [barActive, setBarActive] = useState(false);
  const didFinish = useRef(false);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    // Reduce-motion: no logo pop, no bar sweep — settle immediately and only
    // hold briefly for brand presence; the real gate to dismiss is `ready`.
    if (reduceMotion) {
      markOpacity.setValue(1);
      markScale.setValue(1);
      const brandHold = setTimeout(() => setIntroDone(true), 200);
      return () => clearTimeout(brandHold);
    }

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
      // Short brand hold only — dismissal is gated on `ready`, not on a long
      // fixed delay, so a fast boot isn't padded with dead time.
      Animated.delay(300),
    ]);

    introAnimation.start(({ finished }) => {
      if (finished) setIntroDone(true);
    });

    return () => {
      clearTimeout(barTimer);
      introAnimation.stop();
    };
  }, [markOpacity, markScale, reduceMotion]);

  useEffect(() => {
    if (!ready || !introDone || didFinish.current) return;
    didFinish.current = true;

    if (reduceMotion) {
      overallOpacity.setValue(0);
      onFinishRef.current();
      return;
    }

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
  }, [introDone, overallOpacity, ready, reduceMotion]);

  return (
    <Animated.View style={[styles.container, { opacity: overallOpacity }]}>
      <View style={styles.logoArea} pointerEvents="none">
        <Animated.View
          style={[
            styles.markContainer,
            {
              opacity: markOpacity,
              transform: [{ scale: markScale }],
            },
          ]}
        >
          <LogoBrand size="lg" />
        </Animated.View>
      </View>

      <View style={styles.loadingBarContainer}>
        <LoadingBar active={barActive} reduceMotion={reduceMotion} />
      </View>
    </Animated.View>
  );
}

function LoadingBar({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  // scaleX (anchored left) on the native driver instead of a JS-thread `width`
  // interpolation, so the bar doesn't compete with app bootstrap on the JS thread.
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    if (!active) return;

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1700,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();

    return () => animation.stop();
  }, [active, progress, reduceMotion]);

  return (
    <View style={styles.loadingTrack}>
      <Animated.View
        style={[
          styles.loadingFill,
          { transform: [{ scaleX: progress }], transformOrigin: "left" },
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
  logoArea: {
    alignItems: "center",
    marginBottom: 28,
  },
  markContainer: {
    width: 118,
    height: 118,
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
    width: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
  loadingGradient: {
    flex: 1,
    borderRadius: 2,
  },
});
