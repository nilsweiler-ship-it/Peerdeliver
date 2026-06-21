import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** "glass" = translucent fill for dark/spruce surfaces (e.g. login). */
  tone?: 'default' | 'glass';
  /** Render the label as a mono uppercase micro-label. */
  monoLabel?: boolean;
}

export function Input({ label, error, style, tone = 'default', monoLabel, ...props }: InputProps) {
  const glass = tone === 'glass';
  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, monoLabel && styles.monoLabel, glass && styles.labelGlass]}>
          {monoLabel ? label.toUpperCase() : label}
        </Text>
      )}
      <TextInput
        style={[styles.input, glass && styles.inputGlass, error && styles.inputError, style]}
        placeholderTextColor={glass ? 'rgba(255,255,255,0.45)' : colors.textLight}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 6,
  },
  monoLabel: {
    ...typography.overline,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelGlass: {
    color: 'rgba(255,255,255,0.65)',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
  },
  inputGlass: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.16)',
    color: colors.textInverse,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
