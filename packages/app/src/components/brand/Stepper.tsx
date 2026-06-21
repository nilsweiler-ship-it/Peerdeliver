import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme';

interface StepperProps {
  steps: string[];
  /** 1-based current step. */
  current: number;
}

/** Wizard stepper: numbered nodes connected by 2px lines, active spruce-filled. */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === current;
        const done = idx < current;
        const filled = active || done;
        return (
          <React.Fragment key={label}>
            <View style={styles.step}>
              <View style={[styles.node, filled ? styles.nodeFilled : styles.nodeHollow]}>
                <Text style={[styles.nodeText, filled ? styles.nodeTextFilled : styles.nodeTextHollow]}>
                  {idx}
                </Text>
              </View>
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </View>
            {idx < steps.length && <View style={[styles.line, done && styles.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const NODE = 30;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  step: {
    alignItems: 'center',
    width: NODE + 24,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeFilled: {
    backgroundColor: colors.primary,
  },
  nodeHollow: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  nodeText: {
    ...typography.figure,
    fontSize: 14,
  },
  nodeTextFilled: {
    color: colors.textInverse,
  },
  nodeTextHollow: {
    color: colors.textLight,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
  },
  labelActive: {
    color: colors.text,
    fontFamily: typography.bodyStrong.fontFamily,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginTop: NODE / 2 - 1,
  },
  lineDone: {
    backgroundColor: colors.primary,
  },
});
