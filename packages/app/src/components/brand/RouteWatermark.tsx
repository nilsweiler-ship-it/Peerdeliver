import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

interface RouteWatermarkProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: ViewStyle;
}

/** Large low-opacity route-line graphic used as a watermark on dark surfaces. */
export function RouteWatermark({
  size = 280,
  color = '#FFFFFF',
  opacity = 0.1,
  style,
}: RouteWatermarkProps) {
  return (
    <View pointerEvents="none" style={[styles.wrap, { opacity }, style]}>
      <Svg width={size} height={size} viewBox="0 0 280 280" fill="none">
        <Path
          d="M40 220 C 90 200, 80 120, 140 110 S 210 90, 240 40"
          stroke={color}
          strokeWidth={3}
          strokeDasharray="6 8"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={40} cy={220} r={9} fill={color} />
        <Circle cx={240} cy={40} r={9} stroke={color} strokeWidth={3.5} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
});
