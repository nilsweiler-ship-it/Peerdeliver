import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { colors, typography, spacing } from '../../theme';

type Endpoint = string | { label: string; sub?: string };

interface RouteLineProps {
  from: Endpoint;
  to: Endpoint;
  /** vertical = stacked addresses (cards); horizontal = compact inline row. */
  variant?: 'vertical' | 'horizontal';
  /** Render light-on-dark for spruce surfaces. */
  onDark?: boolean;
  style?: ViewStyle;
  /** Pixel height of the vertical dashed connector. */
  gap?: number;
}

const ORIGIN = colors.primaryLight; // moss filled dot
const DEST = colors.destination; // terracotta hollow ring

function label(e: Endpoint): string {
  return typeof e === 'string' ? e : e.label;
}
function sub(e: Endpoint): string | undefined {
  return typeof e === 'string' ? undefined : e.sub;
}

/** The signature route motif: moss origin dot → dashed line → terracotta destination ring. */
export function RouteLine({
  from,
  to,
  variant = 'vertical',
  onDark = false,
  style,
  gap = 22,
}: RouteLineProps) {
  const dash = onDark ? 'rgba(255,255,255,0.35)' : colors.routeDash;
  const textColor = onDark ? colors.textInverse : colors.text;
  const subColor = onDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary;

  if (variant === 'horizontal') {
    return (
      <View style={[styles.hRow, style]}>
        <View style={[styles.dotFill, { backgroundColor: ORIGIN }]} />
        <View style={styles.hText}>
          <Text style={[styles.hLabel, { color: textColor }]} numberOfLines={1}>
            {label(from)}
          </Text>
        </View>
        <Svg width={28} height={8} style={styles.hDash}>
          <Line x1={0} y1={4} x2={28} y2={4} stroke={dash} strokeWidth={2} strokeDasharray="3 3" strokeLinecap="round" />
        </Svg>
        <View style={styles.hText}>
          <Text style={[styles.hLabel, { color: textColor, textAlign: 'right' }]} numberOfLines={1}>
            {label(to)}
          </Text>
        </View>
        <View style={[styles.dotRing, { borderColor: DEST }]} />
      </View>
    );
  }

  return (
    <View style={[styles.vWrap, style]}>
      <View style={styles.vRail}>
        <View style={[styles.dotFill, { backgroundColor: ORIGIN }]} />
        <Svg width={2} height={gap} style={styles.vDash}>
          <Line x1={1} y1={0} x2={1} y2={gap} stroke={dash} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />
        </Svg>
        <View style={[styles.dotRing, { borderColor: DEST }]} />
      </View>
      <View style={styles.vText}>
        <View style={{ height: gap + 12, justifyContent: 'flex-start' }}>
          <Text style={[styles.vLabel, { color: textColor }]} numberOfLines={1}>
            {label(from)}
          </Text>
          {!!sub(from) && <Text style={[styles.vSub, { color: subColor }]} numberOfLines={1}>{sub(from)}</Text>}
        </View>
        <View>
          <Text style={[styles.vLabel, { color: textColor }]} numberOfLines={1}>
            {label(to)}
          </Text>
          {!!sub(to) && <Text style={[styles.vSub, { color: subColor }]} numberOfLines={1}>{sub(to)}</Text>}
        </View>
      </View>
    </View>
  );
}

const dotSize = 11;

const styles = StyleSheet.create({
  dotFill: {
    width: dotSize,
    height: dotSize,
    borderRadius: dotSize / 2,
  },
  dotRing: {
    width: dotSize,
    height: dotSize,
    borderRadius: dotSize / 2,
    borderWidth: 2.5,
    backgroundColor: 'transparent',
  },
  // vertical
  vWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vRail: {
    alignItems: 'center',
    paddingTop: 4,
  },
  vDash: {
    marginVertical: 2,
  },
  vText: {
    flex: 1,
  },
  vLabel: {
    ...typography.bodyStrong,
  } as TextStyle,
  vSub: {
    ...typography.caption,
    marginTop: 1,
  } as TextStyle,
  // horizontal
  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hText: {
    flexShrink: 1,
  },
  hLabel: {
    ...typography.bodySmall,
  } as TextStyle,
  hDash: {
    marginHorizontal: spacing.sm,
  },
});
