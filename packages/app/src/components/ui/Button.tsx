import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, spacing, typography, borderRadius, controlHeight } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'light';
  /**
   * Two sizes only. Screens were previously overriding padding and minHeight
   * inline to get a smaller button, which is how six slightly different
   * button heights ended up in the app.
   */
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const buttonStyles: ViewStyle[] = [styles.base, styles[size], styles[variant]];
  const textStyles: TextStyle[] = [
    styles.text,
    size === 'sm' ? styles.textSm : null,
    styles[`${variant}Text` as keyof typeof styles] as TextStyle,
  ].filter(Boolean) as TextStyle[];

  if (disabled || loading) {
    buttonStyles.push(styles.disabled);
  }

  return (
    <TouchableOpacity
      style={[...buttonStyles, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.textInverse} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: controlHeight.md,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: controlHeight.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.signal,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  light: {
    backgroundColor: colors.surfaceAlt,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.button,
    color: colors.textInverse,
  },
  textSm: {
    fontSize: 14,
    lineHeight: 18,
  },
  primaryText: {
    color: colors.textInverse,
  },
  secondaryText: {
    // Ink, not forest: on amber, forest is 4.10 and ink is 8.16.
    color: colors.text,
  },
  outlineText: {
    // Was textSecondary, which made a real action look disabled.
    color: colors.text,
  },
  lightText: {
    color: colors.primary,
  },
});
