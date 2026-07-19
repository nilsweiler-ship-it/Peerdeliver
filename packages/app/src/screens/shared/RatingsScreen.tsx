import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { GradientSurface, RouteWatermark, Confetti, SuccessMedallion, LeafMark } from '../../components/brand';
import { colors, spacing, typography, borderRadius } from '../../theme';

export function RatingsScreen({ navigation, route }: any) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const params = route?.params ?? {};
  const contents = params.contents ?? 'Your parcel';
  const city = params.city ?? 'Bern';
  const driver = params.driver ?? 'your driver';
  const co2SavedKg =
    typeof params.co2SavedKg === 'number' ? params.co2SavedKg : 1.8;

  const [rating, setRating] = useState<number>(4.5);

  const handleSubmit = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  return (
    <GradientSurface>
      <RouteWatermark size={320} opacity={0.1} style={{ right: -90, bottom: -40 }} />
      <Confetti />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <SuccessMedallion size={108} />
          <Text style={styles.title}>{t('delivered.title')}</Text>
          <Text style={styles.summary}>
            {t('delivered.summary', { contents, city })}
          </Text>
        </View>

        {/* Impact panel */}
        <View style={styles.impactCard}>
          <LeafMark size={22} color={colors.impactLeaf} />
          <Text style={styles.impactAmount}>{co2SavedKg.toFixed(1)} kg</Text>
          <Text style={styles.impactCaption}>{t('delivered.co2OnTrip')}</Text>
          <Text style={styles.impactSub}>
            {t('delivered.because', { driver })}
          </Text>
        </View>

        {/* Rating */}
        <View style={styles.ratingBlock}>
          <Text style={styles.ratingPrompt}>{t('delivered.rateDriver')}</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => {
              const filled = rating >= i;
              const half = !filled && rating >= i - 0.5;
              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  hitSlop={6}
                  onPress={() => setRating(i)}
                  style={styles.star}
                >
                  <Feather
                    name="star"
                    size={36}
                    color={filled || half ? colors.signal : 'rgba(255,255,255,0.28)'}
                    style={filled || half ? styles.starFilled : undefined}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
        </View>

        <Button
          title={t('delivered.submit')}
          onPress={handleSubmit}
          variant="light"
          style={styles.submit}
        />
      </ScrollView>
    </GradientSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: typography.display.fontFamily,
    fontSize: 34,
    letterSpacing: -0.5,
    color: colors.textInverse,
    marginTop: spacing.lg,
  },
  summary: {
    ...typography.body,
    color: 'rgba(255,255,255,0.66)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  impactCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: 'rgba(127,199,155,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(127,199,155,0.24)',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  impactAmount: {
    fontFamily: typography.figure.fontFamily,
    fontSize: 34,
    color: colors.textInverse,
    marginTop: spacing.sm,
  },
  impactCaption: {
    ...typography.bodyStrong,
    color: colors.impactOnDark,
    marginTop: 2,
  },
  impactSub: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  ratingBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  ratingPrompt: {
    ...typography.overline,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  star: {
    padding: 2,
  },
  starFilled: {
    textShadowColor: 'rgba(233,162,59,0.5)',
    textShadowRadius: 8,
  },
  ratingValue: {
    fontFamily: typography.figure.fontFamily,
    fontSize: 19,
    color: colors.signal,
    marginTop: spacing.md,
  },
  submit: {
    alignSelf: 'stretch',
  },
});
