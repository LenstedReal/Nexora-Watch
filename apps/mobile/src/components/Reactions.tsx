import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import type { FlyingReaction } from "../core/useRoom";

function Fly({ r }: { r: FlyingReaction }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.Text
      style={{
        position: "absolute",
        bottom: 10,
        left: `${r.left}%`,
        fontSize: 30,
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -180] }) },
          { scale: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.4, 1.2, 1] }) },
        ],
      }}
    >
      {r.emoji}
    </Animated.Text>
  );
}

export function Reactions({ items }: { items: FlyingReaction[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((r) => (
        <Fly key={r.id} r={r} />
      ))}
    </View>
  );
}
