import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal as RNModal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Bottom sheet.
 *
 * The content scrolls. It previously did not: the sheet was capped at 80% of
 * the screen and rendered its children directly, so anything taller was clipped
 * with no way to reach it. On the recipient's screen that hid the delivery code
 * — the one thing the sheet exists to show — and the same trap applied to every
 * other modal in the app.
 *
 * Handle and title stay pinned; only the body scrolls, so the sheet still reads
 * as a sheet rather than a page.
 */
export function Modal({ visible, onClose, title, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheet}
            >
              <View style={styles.handle} />
              {title && <Text style={styles.title}>{title}</Text>}
              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator
                // Sheets are short by design; bounce makes it obvious there is
                // more below rather than leaving the content looking cut off.
                alwaysBounceVertical={false}
              >
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    // 88% rather than 80%: the recipient sheet carries a hero, the code and a
    // hint, and the extra room means the code is usually visible without
    // scrolling at all.
    maxHeight: '88%',
  },
  body: {
    // Bounded so ScrollView actually scrolls instead of growing to fit.
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
