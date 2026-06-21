/**
 * Visual smoke-check gallery for the "Shlep" redesign.
 * Renders every theme token + brand/motif component + key cards with MOCK data.
 * No backend / navigation / auth required. See ShowcaseRoot.tsx to run it.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography, borderRadius, shadow, statusColors } from '../../theme';
import { Button, Badge, Card } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import {
  RouteLine,
  LeafMark,
  Seal,
  BrandMark,
  RouteWatermark,
  StatusBadge,
  ImpactCard,
  CO2Chip,
  MapHeader,
  TicketStub,
  CodeBoxes,
  Stepper,
  SegmentedControl,
  DayPicker,
  Pill,
  BackChip,
  Confetti,
  SuccessMedallion,
  GradientSurface,
} from '../../components/brand';
import { DeliveryCard } from '../../components/delivery/DeliveryCard';
import { StatusTimeline } from '../../components/delivery/StatusTimeline';
import { RouteCard } from '../../components/route/RouteCard';
import { MessageBubble } from '../../components/chat/MessageBubble';

// ── Mock data ─────────────────────────────────────────────
const mockDelivery: any = {
  id: 'd1',
  senderId: 's1',
  status: 'in_transit',
  pickupAddress: { label: 'Langstrasse 84, Zürich', point: { lat: 47.37, lng: 8.53 } },
  deliveryAddress: { label: 'Bahnhofstr. 21, Winterthur', point: { lat: 47.5, lng: 8.72 } },
  packageSize: 'M',
  packageDescription: 'Ski boots',
  budgetCHF: 24,
  driver: { firstName: 'Marco', lastName: 'Brunner', role: 'driver', totalRatings: 212, totalDeliveries: 212, averageRating: 4.9, co2Saved: 86, verificationStatus: 'verified' },
};

const mockRoute: any = {
  id: 'r1',
  driverId: 's1',
  originAddress: 'Zürich HB',
  destinationAddress: 'Oerlikon',
  routeType: 'recurring',
  departureTime: new Date(2026, 5, 19, 7, 45).toISOString(),
  recurringDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  availableSize: 'L',
  maxDetourMinutes: 8,
  isActive: true,
};

const mockMsgIn: any = { id: 'm1', conversationId: 'c1', senderId: 'other', content: 'On my way — about 4 minutes out 👋', createdAt: new Date().toISOString() };
const mockMsgOut: any = { id: 'm2', conversationId: 'c1', senderId: 'me', content: 'Perfect, I’ll be downstairs.', createdAt: new Date().toISOString(), readAt: new Date().toISOString() };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Swatch({ name, color }: { name: string; color: string }) {
  const dark = ['surface', 'surfaceAlt', 'background', 'signalSoft', 'impactSurface', 'borderLight', 'surfaceSunken'].includes(name);
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchChip, { backgroundColor: color, borderColor: colors.border }]}>
        <Text style={[styles.swatchHex, { color: dark ? colors.text : '#fff' }]}>{color}</Text>
      </View>
      <Text style={styles.swatchName}>{name}</Text>
    </View>
  );
}

export function ShowcaseScreen() {
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState('active');
  const [days, setDays] = useState(['mon', 'wed', 'fri']);
  const [code, setCode] = useState('0428');

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl }]}>
      <BrandMark size={34} />
      <Text style={styles.kicker}>VISUAL SMOKE CHECK · DESIGN SYSTEM</Text>

      <Section title="Brand colors">
        <View style={styles.swatchGrid}>
          {(['primary', 'primaryLight', 'primaryDark', 'signal', 'signalSoft', 'destination', 'impact', 'impactLeaf', 'impactSurface', 'background', 'surfaceSunken', 'text', 'textSecondary', 'border'] as const).map((k) => (
            <Swatch key={k} name={k} color={(colors as any)[k]} />
          ))}
        </View>
      </Section>

      <Section title="Typography">
        <Text style={typography.display}>Display · Bricolage 34</Text>
        <Text style={typography.h1}>Heading 1 · 28</Text>
        <Text style={typography.h2}>Heading 2 · 22</Text>
        <Text style={typography.h3}>Heading 3 · 17</Text>
        <Text style={typography.body}>Body · Hanken Grotesk 16, the running UI text.</Text>
        <Text style={typography.bodySmall}>Body small · 14</Text>
        <Text style={[typography.figureLg, { color: colors.text }]}>CHF 142.20</Text>
        <Text style={[typography.figure, { color: colors.text }]}>★ 4.9 · 23.4 kg · #PD-042851</Text>
        <Text style={[typography.code, { color: colors.text }]}>042851</Text>
        <Text style={[typography.overline, { color: colors.textLight }]}>OVERLINE · EST. ZÜRICH · CH</Text>
      </Section>

      <Section title="Buttons">
        <View style={{ gap: spacing.sm }}>
          <Button title="Primary (spruce)" onPress={() => {}} />
          <Button title="Secondary (marigold)" variant="secondary" onPress={() => {}} />
          <Button title="Outline" variant="outline" onPress={() => {}} />
          <Button title="Light (paper)" variant="light" onPress={() => {}} />
          <Button title="Loading…" loading onPress={() => {}} />
        </View>
      </Section>

      <Section title="Badges & status">
        <View style={styles.row}>
          <Badge label="success" variant="success" />
          <Badge label="warning" variant="warning" />
          <Badge label="error" variant="error" />
          <Badge label="info" variant="info" />
          <Badge label="neutral" variant="neutral" />
        </View>
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          {Object.keys(statusColors).map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </View>
      </Section>

      <Section title="Route line motif">
        <Card>
          <RouteLine from={{ label: 'Langstrasse 84', sub: 'Zürich' }} to={{ label: 'Bahnhofstr. 21', sub: 'Winterthur' }} />
          <View style={styles.hr} />
          <RouteLine from="Zürich HB" to="Oerlikon" variant="horizontal" />
        </Card>
      </Section>

      <Section title="Pills, back chip, avatar">
        <View style={styles.row}>
          <Pill label="1 / 3" mono />
          <Pill label="Zürich · 100 km" icon="map-pin" iconColor={colors.destination} />
          <Pill label="ETA 14:25" icon="clock" mono />
          <BackChip onPress={() => {}} />
          <Avatar firstName="Lena" lastName="K" size={46} />
        </View>
      </Section>

      <Section title="Impact (carbon story)">
        <ImpactCard amount="23.4 kg" caption="CO₂ saved this year" sub="≈ 14 car trips never made" onPress={() => {}} style={{ marginBottom: spacing.sm }} />
        <ImpactCard amount="86.2 kg" caption="Lifetime impact" sub="≈ 52 car trips never made" variant="dark" amountSize={30} style={{ marginBottom: spacing.sm }} />
        <View style={styles.row}>
          <CO2Chip label="23.4 kg CO₂ saved" />
          <LeafMark size={22} />
        </View>
      </Section>

      <Section title="Stepper / Segmented / Days">
        <Stepper steps={['Package', 'Address', 'Budget']} current={1} />
        <View style={{ height: spacing.md }} />
        <SegmentedControl
          value={seg}
          onChange={setSeg}
          segments={[{ key: 'active', label: 'Active', count: 2 }, { key: 'delivered', label: 'Delivered', count: 14 }]}
        />
        <View style={{ height: spacing.md }} />
        <DayPicker value={days} onChange={setDays} />
      </Section>

      <Section title="Delivery code (ticket stub)">
        <TicketStub title="Delivery code" locked footer={<Button title="Confirm delivery" onPress={() => {}} />}>
          <CodeBoxes value={code} showActive />
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            style={styles.codeField}
            placeholder="tap to type code"
            placeholderTextColor={colors.textLight}
          />
        </TicketStub>
      </Section>

      <Section title="Status timeline (vertical)">
        <Card>
          <StatusTimeline currentStatus="in_transit" orientation="vertical" />
        </Card>
      </Section>

      <Section title="Stylized map header">
        <View style={{ borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          <MapHeader height={180}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md }}>
              <BackChip onDark onPress={() => {}} />
              <Pill label="ETA 14:25" mono onDark />
            </View>
          </MapHeader>
        </View>
      </Section>

      <Section title="Cards (with mock data)">
        <DeliveryCard delivery={mockDelivery} onPress={() => {}} />
        <RouteCard route={mockRoute} onPress={() => {}} />
      </Section>

      <Section title="Chat bubbles">
        <MessageBubble message={mockMsgIn} isOwn={false} />
        <MessageBubble message={mockMsgOut} isOwn />
      </Section>

      <Section title="Brand marks">
        <View style={[styles.row, { alignItems: 'center' }]}>
          <Seal size={48} />
          <Seal size={40} color={colors.primary} />
          <BrandMark size={26} showWordmark={false} />
          <SuccessMedallion size={72} />
        </View>
      </Section>

      <Section title="Dark moments (gradient + watermark + confetti)">
        <View style={styles.darkPanel}>
          <GradientSurface style={StyleSheet.absoluteFill} />
          <RouteWatermark size={200} opacity={0.1} style={{ right: -50, top: -30 }} />
          <Confetti />
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <SuccessMedallion size={88} />
            <Text style={styles.darkTitle}>Delivered!</Text>
            <Text style={styles.darkSub}>Ski boots delivered to Winterthur</Text>
            <CO2Chip label="1.8 kg CO₂ saved" onDark />
          </View>
        </View>
      </Section>

      <Section title="Inputs">
        <Input label="Email" placeholder="you@example.ch" />
        <View style={styles.darkInputPanel}>
          <GradientSurface style={StyleSheet.absoluteFill} />
          <Input label="Email" monoLabel tone="glass" placeholder="glass input on dark" />
        </View>
      </Section>

      <Text style={styles.footer}>End of gallery — if all of the above rendered, fonts + SVG + gradients are working.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  kicker: { ...typography.overline, color: colors.textLight, letterSpacing: 1.4, marginTop: 4, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl, gap: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  hr: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 96, gap: 4 },
  swatchChip: { height: 48, borderRadius: borderRadius.md, borderWidth: 1, justifyContent: 'flex-end', padding: 4 },
  swatchHex: { fontFamily: typography.overline.fontFamily, fontSize: 9 },
  swatchName: { ...typography.caption, color: colors.textSecondary },
  codeField: { marginTop: spacing.md, alignSelf: 'stretch', textAlign: 'center', ...typography.bodySmall, color: colors.textSecondary, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.md, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  darkPanel: { borderRadius: borderRadius.xl, overflow: 'hidden', padding: spacing.xl, minHeight: 240, justifyContent: 'center', ...shadow.card },
  darkTitle: { fontFamily: typography.display.fontFamily, fontSize: 30, color: colors.textInverse },
  darkSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.66)' },
  darkInputPanel: { borderRadius: borderRadius.xl, overflow: 'hidden', padding: spacing.md, marginTop: spacing.sm },
  footer: { ...typography.caption, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
});
