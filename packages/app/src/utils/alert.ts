import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

/**
 * Alert.alert that also works on the web build.
 *
 * react-native-web ships Alert as a no-op, so on web every error, every
 * success message and the "verify first" prompt silently did nothing — a
 * driver tapped "claim" and saw no reaction at all. On iOS and Android this
 * is exactly React Native's Alert. On web it falls back to the browser's own
 * dialogs: one button → window.alert; a choice → window.confirm, where OK
 * runs the last non-cancel button and Cancel runs the cancel button.
 *
 * Use it as a drop-in: `import { Alert } from '…/utils/alert'`.
 */
function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    NativeAlert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const list = buttons ?? [];
  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b !== cancel);

  if (actions.length <= 1 && !cancel) {
    window.alert(text);
    actions[0]?.onPress?.();
    return;
  }
  // A choice. Name the action on the OK side so the browser dialog still
  // reads as a question ("… — OK: Jetzt verifizieren").
  const primary = actions[actions.length - 1];
  const prompt = primary?.text ? `${text}\n\nOK: ${primary.text}` : text;
  if (window.confirm(prompt)) primary?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
