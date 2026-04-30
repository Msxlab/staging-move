import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const pinScale = useRef(new Animated.Value(0)).current;
  const pinY = useRef(new Animated.Value(-80)).current;
  const pinRotate = useRef(new Animated.Value(-0.05)).current;
  const dotScale = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(30)).current;
  const flowOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.15)).current;
  const glowScale = useRef(new Animated.Value(0.8)).current;
  const overallOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // Phase 1: Pin drops with spring + slight rotation
      Animated.parallel([
        Animated.spring(pinScale, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(pinY, {
          toValue: 0,
          tension: 45,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pinRotate, {
            toValue: 0.03,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(pinRotate, {
            toValue: 0,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
        ]),
      ]),
      // Phase 2: Dot scales in with ring burst
      Animated.parallel([
        Animated.spring(dotScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0.6,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1.8,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Ring fades out
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      // Phase 3: Flow waves sweep in
      Animated.stagger(120, [
        Animated.timing(wave1, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(wave2, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Phase 4: Text slides up
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(textY, {
          toValue: 0,
          tension: 60,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(flowOpacity, {
          toValue: 1,
          duration: 500,
          delay: 150,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Glow breathing
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowPulse, {
            toValue: 0.35,
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
            toValue: 0.15,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 0.8,
            duration: 1400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.timing(overallOpacity, {
        toValue: 0,
        duration: 500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: overallOpacity }]}>
      {/* Radial glow */}
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowPulse, transform: [{ scale: glowScale }] },
        ]}
      >
        <LinearGradient
          colors={["rgba(249,115,22,0.35)", "rgba(251,191,36,0.08)", "transparent"]}
          style={styles.glowGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Logo */}
      <View style={styles.logoArea}>
        {/* Pin */}
        <Animated.View
          style={[
            styles.pinContainer,
            {
              transform: [
                { scale: pinScale },
                { translateY: pinY },
                { rotate: pinRotate.interpolate({
                  inputRange: [-0.1, 0, 0.1],
                  outputRange: ["-6deg", "0deg", "6deg"],
                }) },
              ],
            },
          ]}
        >
          <View style={styles.pinOuter}>
            <View style={styles.pinInner}>
              {/* Dot with ring burst */}
              <Animated.View
                style={[
                  styles.pinRing,
                  { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <Animated.View
                style={[styles.pinDot, { transform: [{ scale: dotScale }] }]}
              >
                <LinearGradient
                  colors={["#FBBF24", "#F97316"]}
                  style={styles.dotGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>
            </View>
            {/* Pin tip */}
            <View style={styles.pinTip} />
          </View>
          <View style={styles.pinShadow} />
        </Animated.View>

        {/* Flow waves */}
        <View style={styles.wavesContainer}>
          <Animated.View
            style={[
              styles.wave,
              {
                top: 2,
                opacity: wave1,
                transform: [
                  { scaleX: wave1.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                  { translateX: wave1.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", "#F97316", "#FBBF24", "#F97316", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.waveGradient}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.wave,
              {
                top: 12,
                opacity: wave2.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
                transform: [
                  { scaleX: wave2.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                  { translateX: wave2.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={["transparent", "#FBBF24", "#FB923C", "#FBBF24", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.waveGradient}
            />
          </Animated.View>
        </View>
      </View>

      {/* Brand text */}
      <Animated.View
        style={[
          styles.textContainer,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}
      >
        <Text style={styles.brandText}>
          <Text style={styles.brandLocate}>Locate</Text>
          <Animated.Text style={[styles.brandFlow, { opacity: flowOpacity }]}>
            Flow
          </Animated.Text>
        </Text>
        <Text style={styles.tagline}>Smart Relocation Management</Text>
      </Animated.View>

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
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, []);

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
          colors={["#EA580C", "#F97316", "#FBBF24"]}
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
    backgroundColor: "#0a0a0f",
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
    marginBottom: 36,
  },
  pinContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  pinOuter: {
    width: 100,
    height: 120,
    alignItems: "center",
  },
  pinInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249, 115, 22, 0.06)",
  },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#F97316",
    marginTop: -2,
  },
  pinRing: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FBBF24",
  },
  pinDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: "hidden",
  },
  dotGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  pinShadow: {
    width: 32,
    height: 8,
    borderRadius: 16,
    backgroundColor: "rgba(249, 115, 22, 0.2)",
    marginTop: 8,
  },
  wavesContainer: {
    width: width * 0.55,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  wave: {
    position: "absolute",
    width: "100%",
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  waveGradient: {
    flex: 1,
    borderRadius: 2,
  },
  textContainer: {
    alignItems: "center",
  },
  brandText: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1,
  },
  brandLocate: {
    color: "#ffffff",
  },
  brandFlow: {
    color: "#FBBF24",
  },
  tagline: {
    color: "rgba(255, 255, 255, 0.25)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  loadingBarContainer: {
    position: "absolute",
    bottom: 80,
    width: 120,
  },
  loadingTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  loadingFill: {
    height: "100%",
    borderRadius: 2,
    overflow: "hidden",
  },
});
