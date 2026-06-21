import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Rect, Path, Circle, G, Line } from 'react-native-svg';
import { colors } from '../../theme';

interface MapHeaderProps {
  height?: number;
  /** Overlaid content (back chip, ETA pill, etc.). */
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Stylized static map: mint bg, white road grid, dashed spruce route path,
 * moss origin dot, terracotta destination ring, marigold live position marker.
 */
export function MapHeader({ height = 212, children, style }: MapHeaderProps) {
  return (
    <View style={[styles.wrap, { height }, style]}>
      <Svg width="100%" height={height} viewBox="0 0 390 212" preserveAspectRatio="xMidYMid slice">
        <Rect x={0} y={0} width={390} height={212} fill="#D8EBDF" />
        {/* road grid */}
        <G stroke="#FFFFFF" strokeWidth={6} opacity={0.9}>
          <Line x1={-10} y1={60} x2={400} y2={92} />
          <Line x1={-10} y1={150} x2={400} y2={130} />
          <Line x1={70} y1={-10} x2={120} y2={222} />
          <Line x1={250} y1={-10} x2={210} y2={222} />
        </G>
        <G stroke="#FFFFFF" strokeWidth={3} opacity={0.6}>
          <Line x1={-10} y1={110} x2={400} y2={112} />
          <Line x1={320} y1={-10} x2={300} y2={222} />
        </G>
        {/* route path */}
        <Path
          d="M70 165 C 120 150, 130 95, 200 100 S 290 80, 320 48"
          stroke={colors.primary}
          strokeWidth={4}
          strokeDasharray="2 7"
          strokeLinecap="round"
          fill="none"
        />
        {/* origin */}
        <Circle cx={70} cy={165} r={9} fill={colors.primaryLight} stroke="#FFFFFF" strokeWidth={3} />
        {/* destination */}
        <Circle cx={320} cy={48} r={9} fill="#FFFFFF" stroke={colors.destination} strokeWidth={4} />
        {/* live position marker */}
        <Circle cx={205} cy={99} r={13} fill={colors.signal} opacity={0.25} />
        <Circle cx={205} cy={99} r={7} fill={colors.signal} stroke="#FFFFFF" strokeWidth={3} />
      </Svg>
      <View style={styles.overlay} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: '#D8EBDF',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
