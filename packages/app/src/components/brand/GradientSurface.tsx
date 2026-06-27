import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Signature spruce gradient #235440 → #1A3E2F → #0F291E */
  variant?: 'spruce' | 'spruceSoft';
  /** Fill the parent (flex:1). Set false to size to content (e.g. inside a sheet). */
  fill?: boolean;
}

const stops: Record<string, [string, string, string]> = {
  spruce: ['#235440', '#1A3E2F', '#0F291E'],
  spruceSoft: ['#2A5E48', '#1F4D3B', '#163528'],
};

export function GradientSurface({ children, style, variant = 'spruce', fill = true }: GradientSurfaceProps) {
  return (
    <LinearGradient
      colors={stops[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[fill && styles.base, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
