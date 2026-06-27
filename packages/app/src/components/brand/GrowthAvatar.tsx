import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path, G, Rect } from 'react-native-svg';
import { colors } from '../../theme';

/**
 * Gamified profile avatar: a plant that grows with the user's lifetime CO₂ saved.
 * seed → sprout → leaf → shoot → plant → sapling → tree → fruit tree → forest.
 */
export interface Stage {
  index: number;
  name: string;
  min: number; // kg CO₂ to reach this stage
}

const STAGES: Stage[] = [
  { index: 0, name: 'Seedling', min: 0 },
  { index: 1, name: 'Sprout', min: 1 },
  { index: 2, name: 'Leaf', min: 6 },
  { index: 3, name: 'Shoot', min: 15 },
  { index: 4, name: 'Plant', min: 30 },
  { index: 5, name: 'Sapling', min: 55 },
  { index: 6, name: 'Tree', min: 90 },
  { index: 7, name: 'Fruit tree', min: 140 },
  { index: 8, name: 'Forest', min: 220 },
];

export function growthStage(co2: number) {
  let s = STAGES[0];
  for (const st of STAGES) if (co2 >= st.min) s = st;
  const next = STAGES[s.index + 1] ?? null;
  const progress = next ? Math.min(1, (co2 - s.min) / (next.min - s.min)) : 1;
  return { ...s, next, progress, total: STAGES.length };
}

const LEAF = colors.impact;
const LEAF_LIGHT = colors.impactLeaf;
const TRUNK = '#8B5E3C';
const SOIL = '#B08C6A';

interface Props {
  co2: number;
  size?: number;
  /** dark = on spruce surfaces (lighter bg disc). */
  onDark?: boolean;
}

function Leaf({ x, y, rot, scale = 1, color = LEAF }: { x: number; y: number; rot: number; scale?: number; color?: string }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <Path d="M0 0 C 7 -3 10 -12 0 -18 C -10 -12 -7 -3 0 0 Z" fill={color} />
      <Path d="M0 -1 L0 -15" stroke="#FFFFFF" strokeWidth={0.8} opacity={0.5} />
    </G>
  );
}

function PlantBody({ stage }: { stage: number }) {
  // soil mound shared by all stages
  const soil = <Ellipse cx={50} cy={84} rx={28} ry={7} fill={SOIL} />;

  if (stage <= 0) {
    return (
      <G>
        {soil}
        <Path d="M50 84 L50 72" stroke={LEAF} strokeWidth={3} strokeLinecap="round" />
        <Leaf x={50} y={72} rot={-35} scale={0.55} color={LEAF_LIGHT} />
        <Leaf x={50} y={72} rot={35} scale={0.55} color={LEAF} />
      </G>
    );
  }
  if (stage === 1) {
    return (
      <G>
        {soil}
        <Path d="M50 84 L50 64" stroke={LEAF} strokeWidth={3.2} strokeLinecap="round" />
        <Leaf x={50} y={66} rot={-40} scale={0.7} color={LEAF_LIGHT} />
        <Leaf x={50} y={70} rot={42} scale={0.7} color={LEAF} />
      </G>
    );
  }
  if (stage === 2) {
    return (
      <G>
        {soil}
        <Path d="M50 84 L50 56" stroke={LEAF} strokeWidth={3.4} strokeLinecap="round" />
        <Leaf x={50} y={58} rot={-45} scale={0.8} color={LEAF_LIGHT} />
        <Leaf x={50} y={64} rot={45} scale={0.8} color={LEAF} />
        <Leaf x={50} y={70} rot={-50} scale={0.7} color={LEAF} />
      </G>
    );
  }
  if (stage === 3) {
    return (
      <G>
        {soil}
        <Path d="M50 84 L50 48" stroke={LEAF} strokeWidth={3.6} strokeLinecap="round" />
        <Leaf x={50} y={50} rot={-48} scale={0.9} color={LEAF_LIGHT} />
        <Leaf x={50} y={56} rot={48} scale={0.9} color={LEAF} />
        <Leaf x={50} y={62} rot={-52} scale={0.8} color={LEAF} />
        <Leaf x={50} y={68} rot={52} scale={0.8} color={LEAF_LIGHT} />
      </G>
    );
  }
  if (stage === 4) {
    // bushy plant
    return (
      <G>
        {soil}
        <Path d="M50 84 L50 50" stroke={TRUNK} strokeWidth={3.4} strokeLinecap="round" />
        <Ellipse cx={50} cy={44} rx={20} ry={16} fill={LEAF} />
        <Ellipse cx={40} cy={50} rx={12} ry={10} fill={LEAF_LIGHT} />
        <Ellipse cx={60} cy={50} rx={12} ry={10} fill={LEAF_LIGHT} />
      </G>
    );
  }
  if (stage === 5) {
    // sapling
    return (
      <G>
        {soil}
        <Rect x={47} y={50} width={6} height={34} rx={3} fill={TRUNK} />
        <Circle cx={50} cy={42} r={18} fill={LEAF} />
        <Circle cx={40} cy={48} r={11} fill={LEAF_LIGHT} />
        <Circle cx={61} cy={47} r={10} fill={LEAF_LIGHT} />
      </G>
    );
  }
  if (stage === 6) {
    // tree
    return (
      <G>
        {soil}
        <Rect x={46} y={48} width={8} height={36} rx={4} fill={TRUNK} />
        <Circle cx={50} cy={38} r={22} fill={LEAF} />
        <Circle cx={36} cy={46} r={13} fill={LEAF_LIGHT} />
        <Circle cx={64} cy={45} r={12} fill={LEAF_LIGHT} />
      </G>
    );
  }
  if (stage === 7) {
    // fruit tree
    return (
      <G>
        {soil}
        <Rect x={46} y={48} width={8} height={36} rx={4} fill={TRUNK} />
        <Circle cx={50} cy={36} r={23} fill={LEAF} />
        <Circle cx={35} cy={44} r={13} fill={LEAF_LIGHT} />
        <Circle cx={65} cy={43} r={12} fill={LEAF_LIGHT} />
        <Circle cx={43} cy={34} r={3.4} fill={colors.signal} />
        <Circle cx={58} cy={40} r={3.4} fill={colors.destination} />
        <Circle cx={52} cy={28} r={3.4} fill={colors.signal} />
      </G>
    );
  }
  // forest
  return (
    <G>
      <Ellipse cx={50} cy={86} rx={34} ry={7} fill={SOIL} />
      <Rect x={26} y={56} width={6} height={30} rx={3} fill={TRUNK} />
      <Circle cx={29} cy={50} r={15} fill={LEAF_LIGHT} />
      <Rect x={66} y={54} width={6} height={32} rx={3} fill={TRUNK} />
      <Circle cx={69} cy={48} r={16} fill={LEAF_LIGHT} />
      <Rect x={46} y={44} width={8} height={42} rx={4} fill={TRUNK} />
      <Circle cx={50} cy={36} r={22} fill={LEAF} />
      <Circle cx={50} cy={30} r={3.2} fill={colors.signal} />
      <Circle cx={42} cy={40} r={3.2} fill={colors.destination} />
    </G>
  );
}

export function GrowthAvatar({ co2, size = 64, onDark = false }: Props) {
  const { index } = growthStage(co2);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, onDark ? styles.dark : styles.light]}>
      <Svg width={size * 0.9} height={size * 0.9} viewBox="0 0 100 100">
        <PlantBody stage={index} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  light: {
    backgroundColor: colors.impactSurface,
    borderWidth: 1,
    borderColor: colors.impactSurfaceBorder,
  },
  dark: {
    backgroundColor: 'rgba(127,199,155,0.16)',
  },
});
