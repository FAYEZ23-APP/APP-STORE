import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

/**
 * AnimatedPressable
 * Site-wide micro-interaction wrapper delivering luxury tactile scale-down and spring-back
 * using 100% native driver for 60 FPS performance.
 * Preserves 100% of underlying Pressable props, handlers, and accessibility attributes.
 */
export default function AnimatedPressable({
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  scaleTo = 0.965,
  springFriction = 7,
  springTension = 120,
  activeOpacity = 0.92,
  ...restProps
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e) => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: scaleTo,
          friction: springFriction,
          tension: springTension,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: activeOpacity,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e) => {
    if (!disabled) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: springFriction,
          tension: springTension,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
    if (onPressOut) onPressOut(e);
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...restProps}
    >
      <Animated.View
        style={[
          styles.container,
          typeof style === 'function' ? style({ pressed: false }) : style,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // Default pass-through container
  },
});
