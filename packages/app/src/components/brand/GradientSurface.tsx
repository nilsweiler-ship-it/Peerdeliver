import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';

interface GradientSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Signature spruce gradient #235440 → #1A3E2F → #0F291E */
  variant?: 'spruce' | 'spruceSoft';
  /** Fill the parent (flex:1). Set false to size to content (e.g. inside a sheet). */
  fill?: boolean;
}

// The forest ramp, recentred on the lighter brand green.
//
// These were hardcoded around the old #14532D, so when the palette moved every
// gradient panel stayed near-black while the flat surfaces beside it did not —
// the gradients would have been the one place the old green survived, and the
// mismatch is more visible than either colour alone.
//
// Written against colours.primary / primaryDark rather than repeating the hex,
// so the next palette change carries them along.
const stops: Record<string, [string, string, string]> = {
  // #217A4B rather than anything lighter: paper text on the lightest stop
  // measures 4.63, and these panels carry text.
  spruce: ['#217A4B', colors.primary, colors.primaryDark],
  spruceSoft: ['#217A4B', colors.primary, '#17603A'],
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
