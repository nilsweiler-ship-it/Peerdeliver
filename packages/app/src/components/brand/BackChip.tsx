import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';

interface BackChipProps {
  onPress: () => void;
  onDark?: boolean;
  style?: ViewStyle;
}

/** Circular back affordance used in screen headers and over maps. */
export function BackChip({ onPress, onDark, style }: BackChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.chip,
        {
          backgroundColor: onDark ? 'rgba(255,255,255,0.16)' : colors.surface,
          borderColor: onDark ? 'rgba(255,255,255,0.22)' : colors.border,
        },
        style,
      ]}
    >
      <Feather name="chevron-left" size={20} color={onDark ? colors.textInverse : colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
