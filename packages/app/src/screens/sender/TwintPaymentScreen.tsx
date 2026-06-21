import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import { useTwintPay } from '../../queries/payment';
import { colors, spacing, typography, borderRadius } from '../../theme';

// TWINT brand: near-black surface with the signature magenta accent.
const TWINT_BG = '#0B0B0F';
const TWINT_SURFACE = '#16161C';
const TWINT_MAGENTA = '#EC0F69';
const TWINT_BORDER = 'rgba(255,255,255,0.12)';

/** Deterministic faux-QR so the simulated payment looks tangible. */
function FauxQR({ seed, size = 132 }: { seed: string; size?: number }) {
  const cells = 13;
  const cell = size / cells;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const finder =
        (x < 4 && y < 4) || (x >= cells - 4 && y < 4) || (x < 4 && y >= cells - 4);
      if (finder ? (x % 3 !== 1 || y % 3 !== 1) : rng() > 0.5) {
        rects.push(
          <Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill="#0B0B0F" />,
        );
      }
    }
  }
  return (
    <View style={styles.qrFrame}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {rects}
      </Svg>
    </View>
  );
}

export function TwintPaymentScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const { deliveryId, amountCHF = 0, summary = 'Delivery' } = route?.params ?? {};
  const pay = useTwintPay();
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);

  const handlePay = async () => {
    try {
      await pay.mutateAsync({ deliveryRequestId: deliveryId, phone: phone.trim() || undefined });
      setDone(true);
    } catch (err: any) {
      Alert.alert('Payment failed', err?.response?.data?.error || err?.message || 'Please try again.');
    }
  };

  const finish = () => {
    navigation.navigate('MyShipments');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            TW<Text style={{ color: TWINT_MAGENTA }}>I</Text>NT
          </Text>
          {!done && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}
        </View>

        {done ? (
          <View style={styles.successBlock}>
            <View style={styles.successRing}>
              <Feather name="check" size={42} color="#FFFFFF" />
            </View>
            <Text style={styles.successTitle}>Payment confirmed</Text>
            <Text style={styles.successAmount}>CHF {Number(amountCHF).toFixed(2)}</Text>
            <Text style={styles.successSub}>
              Held securely until your parcel is delivered, then released to your driver.
            </Text>
            <TouchableOpacity style={styles.payButton} onPress={finish} activeOpacity={0.85}>
              <Text style={styles.payButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.amountLabel}>AMOUNT TO PAY</Text>
            <Text style={styles.amount}>CHF {Number(amountCHF).toFixed(2)}</Text>
            <Text style={styles.summary}>{summary}</Text>

            <View style={styles.card}>
              <FauxQR seed={deliveryId ?? summary} />
              <Text style={styles.qrHint}>Scan with the TWINT app, or confirm with your number below.</Text>
            </View>

            <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+41 79 123 45 67"
              placeholderTextColor="rgba(255,255,255,0.35)"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.payButton, pay.isPending && styles.payButtonDisabled]}
              onPress={handlePay}
              disabled={pay.isPending}
              activeOpacity={0.85}
            >
              {pay.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.payButtonText}>Confirm in TWINT</Text>
              )}
            </TouchableOpacity>

            <View style={styles.secureRow}>
              <Feather name="lock" size={12} color="rgba(255,255,255,0.45)" />
              <Text style={styles.secureText}>Simulated payment · no real charge</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TWINT_BG },
  content: { padding: spacing.lg, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  wordmark: {
    fontFamily: typography.display.fontFamily,
    fontSize: 26,
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  amountLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  amount: {
    ...typography.figureLg,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  summary: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: TWINT_SURFACE,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: TWINT_BORDER,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  qrFrame: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.md,
  },
  qrHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  fieldLabel: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: 6,
  },
  input: {
    ...typography.body,
    color: '#FFFFFF',
    backgroundColor: TWINT_SURFACE,
    borderWidth: 1,
    borderColor: TWINT_BORDER,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: typography.figure.fontFamily,
  },
  payButton: {
    backgroundColor: TWINT_MAGENTA,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: spacing.lg,
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    ...typography.button,
    color: '#FFFFFF',
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  secureText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.45)',
  },
  // success
  successBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  successRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: TWINT_MAGENTA,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontFamily: typography.display.fontFamily,
    fontSize: 24,
    color: '#FFFFFF',
  },
  successAmount: {
    ...typography.figureLg,
    fontSize: 30,
    color: '#FFFFFF',
  },
  successSub: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
