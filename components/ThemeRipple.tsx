import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';

type ThemeRippleProps = {
  color: string;
  gradient?: readonly [string, string, ...string[]];
  expanding: boolean;
  origin?: { x: number; y: number };
  onComplete?: () => void;
};

export const ThemeRipple = ({ color, gradient, expanding, origin, onComplete }: ThemeRippleProps) => {
  const { width, height } = Dimensions.get('window');
  const maxDim = Math.max(width, height) * 2.5; // Multiply by 2.5 to ensure full coverage from any origin

  const originX = origin?.x ?? width - 40;
  const originY = origin?.y ?? 50;

  const scale = useSharedValue(expanding ? 0 : 3.5);

  useEffect(() => {
    scale.value = withTiming(
      expanding ? 3.5 : 0, 
      {
        duration: 750,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished && onComplete) {
          runOnJS(onComplete)();
        }
      }
    );
  }, [expanding, scale, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: originX - maxDim / 2,
          top: originY - maxDim / 2,
          width: maxDim,
          height: maxDim,
          borderRadius: maxDim / 2,
          backgroundColor: color,
          zIndex: 99999,
          overflow: 'hidden',
        },
        animatedStyle,
      ]}
    >
      {gradient && (
        <LinearGradient
          colors={gradient}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
    </Animated.View>
  );
};
