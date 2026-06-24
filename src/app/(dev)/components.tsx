import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { IconChip, iconChipForegroundColor } from '@/components/ui/IconChip';
import { RouteConnector } from '@/components/ui/RouteConnector';
import { Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { StatusPill } from '@/components/ui/StatusPill';
import { StepProgress } from '@/components/ui/StepProgress';
import { Stepper } from '@/components/ui/Stepper';
import { colors, radius, spacing, typography } from '@/constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={sectionStyles.row}>{children}</View>;
}

function Caption({ text }: { text: string }) {
  return <Text style={sectionStyles.caption}>{text}</Text>;
}

function IconGlyph({
  color,
  small,
  large,
}: {
  color: string;
  small?: boolean;
  large?: boolean;
}) {
  const size = small ? 10 : large ? 22 : 14;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

function BackgroundSwatch({ label, color }: { label: string; color: string }) {
  return (
    <View style={sectionStyles.swatchCol}>
      <View style={[sectionStyles.swatchBox, { backgroundColor: color }]} />
      <Text style={sectionStyles.swatchLabel}>{label}</Text>
    </View>
  );
}

export default function ComponentsScreen() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetNoHandle, setSheetNoHandle] = useState(false);

  return (
    <Screen scroll background="light">
      <Text style={sectionStyles.heading}>Component Library</Text>

      {/* Buttons */}
      <Section title="Button">
        <Caption text="variant: primary" />
        <Button label="Primary action" />
        <Caption text="variant: secondary" />
        <Button label="Secondary action" variant="secondary" />
        <Caption text="disabled" />
        <Button label="Disabled" disabled />
        <Caption text="loading" />
        <Button label="Loading" loading />
        <Caption text="fullWidth: false" />
        <Button label="Auto width" fullWidth={false} />
      </Section>

      {/* Cards */}
      <Section title="Card">
        <Caption text="elevation: card (default), rounded: md" />
        <Card>
          <Text style={sectionStyles.bodyText}>Default card with shadow.</Text>
        </Card>
        <Caption text="elevation: float, rounded: lg" />
        <Card elevation="float" rounded="lg">
          <Text style={sectionStyles.bodyText}>Floating card, large radius.</Text>
        </Card>
        <Caption text="elevation: none (bordered)" />
        <Card elevation="none" style={sectionStyles.bordered}>
          <Text style={sectionStyles.bodyText}>Flat card, no shadow.</Text>
        </Card>
        <Caption text="padded: false" />
        <Card padded={false}>
          <View style={sectionStyles.unpaddedInner}>
            <Text style={sectionStyles.bodyText}>Unpadded card.</Text>
          </View>
        </Card>
      </Section>

      {/* Field */}
      <Section title="Field">
        <Field label="Email">
          <TextInput
            placeholder="you@example.com"
            placeholderTextColor={colors.ink[400]}
            style={sectionStyles.input}
          />
        </Field>
        <Field label="Phone" hint="We'll send a code via SMS.">
          <TextInput
            placeholder="+63 ..."
            placeholderTextColor={colors.ink[400]}
            style={sectionStyles.input}
          />
        </Field>
        <Field label="Password" error="Must be at least 8 characters">
          <TextInput
            placeholder="Enter password"
            placeholderTextColor={colors.ink[400]}
            secureTextEntry
            style={sectionStyles.input}
          />
        </Field>
      </Section>

      {/* StatusPill */}
      <Section title="StatusPill">
        <Caption text="tones" />
        <Row>
          <StatusPill label="Info" tone="info" />
          <StatusPill label="Success" tone="success" />
          <StatusPill label="Warning" tone="warning" />
          <StatusPill label="Danger" tone="danger" />
        </Row>
        <Row>
          <StatusPill label="Neutral" tone="neutral" />
          <StatusPill label="Amber" tone="amber" />
          <StatusPill label="Violet" tone="violet" />
        </Row>
        <Caption text="with dot" />
        <Row>
          <StatusPill label="Live" tone="success" dot />
          <StatusPill label="Paused" tone="warning" dot />
        </Row>
        <Caption text="uppercase: false" />
        <Row>
          <StatusPill label="In progress" tone="info" uppercase={false} />
        </Row>
      </Section>

      {/* IconChip */}
      <Section title="IconChip">
        <Caption text="tones (size md, rounded sm)" />
        <Row>
          <IconChip tone="blue">
            <IconGlyph color={iconChipForegroundColor.blue} />
          </IconChip>
          <IconChip tone="green">
            <IconGlyph color={iconChipForegroundColor.green} />
          </IconChip>
          <IconChip tone="amber">
            <IconGlyph color={iconChipForegroundColor.amber} />
          </IconChip>
          <IconChip tone="violet">
            <IconGlyph color={iconChipForegroundColor.violet} />
          </IconChip>
          <IconChip tone="neutral">
            <IconGlyph color={iconChipForegroundColor.neutral} />
          </IconChip>
          <IconChip tone="danger">
            <IconGlyph color={iconChipForegroundColor.danger} />
          </IconChip>
        </Row>
        <Caption text="sizes" />
        <Row>
          <IconChip tone="blue" size="sm">
            <IconGlyph color={iconChipForegroundColor.blue} small />
          </IconChip>
          <IconChip tone="blue" size="md">
            <IconGlyph color={iconChipForegroundColor.blue} />
          </IconChip>
          <IconChip tone="blue" size="lg">
            <IconGlyph color={iconChipForegroundColor.blue} />
          </IconChip>
        </Row>
        <Caption text="rounded variants" />
        <Row>
          <IconChip tone="violet" rounded="sm">
            <IconGlyph color={iconChipForegroundColor.violet} />
          </IconChip>
          <IconChip tone="violet" rounded="md">
            <IconGlyph color={iconChipForegroundColor.violet} />
          </IconChip>
          <IconChip tone="violet" rounded="pill">
            <IconGlyph color={iconChipForegroundColor.violet} />
          </IconChip>
        </Row>
      </Section>

      {/* Avatar */}
      <Section title="Avatar">
        <Caption text="sizes" />
        <Row>
          <Avatar name="Juan Dela Cruz" size="sm" />
          <Avatar name="Juan Dela Cruz" size="md" />
          <Avatar name="Juan Dela Cruz" size="lg" />
          <Avatar name="Juan Dela Cruz" size="xl" />
        </Row>
        <Caption text="tones" />
        <Row>
          <Avatar name="Ana Reyes" tone="blue" />
          <Avatar name="Ben Cruz" tone="green" />
          <Avatar name="Carla Diaz" tone="amber" />
          <Avatar name="Dino Estrada" tone="violet" />
          <Avatar name="Eli Fernandez" tone="neutral" />
        </Row>
        <Caption text="explicit initials" />
        <Row>
          <Avatar initials="JD" tone="blue" />
          <Avatar initials="X" tone="violet" />
        </Row>
      </Section>

      {/* StepProgress */}
      <Section title="StepProgress">
        <Caption text="labelPosition: above (default)" />
        <StepProgress current={2} total={5} />
        <Caption text="labelPosition: right" />
        <StepProgress current={3} total={5} labelPosition="right" />
        <Caption text="showLabel: false" />
        <StepProgress current={4} total={5} showLabel={false} />
        <Caption text="tones" />
        <StepProgress current={2} total={5} tone="blue" />
        <StepProgress current={2} total={5} tone="green" />
        <StepProgress current={2} total={5} tone="violet" />
        <StepProgress current={2} total={5} tone="amber" />
      </Section>

      {/* Stepper */}
      <Section title="Stepper">
        <Caption text="horizontal - blue" />
        <Stepper
          tone="blue"
          items={[
            { label: 'Account', state: 'completed' },
            { label: 'Profile', state: 'active' },
            { label: 'Review', state: 'pending' },
          ]}
        />
        <Caption text="horizontal - green" />
        <Stepper
          tone="green"
          items={[
            { label: 'Pickup', state: 'completed' },
            { label: 'En route', state: 'completed' },
            { label: 'Drop-off', state: 'active' },
          ]}
        />
        <Caption text="horizontal - violet" />
        <Stepper
          tone="violet"
          items={[
            { label: 'Submit', state: 'completed' },
            { label: 'Verify', state: 'active' },
            { label: 'Approve', state: 'pending' },
            { label: 'Onboard', state: 'pending' },
          ]}
        />
        <Caption text="vertical - blue" />
        <Stepper
          orientation="vertical"
          tone="blue"
          items={[
            { label: 'Confirm pickup', state: 'completed' },
            { label: 'On the way', state: 'active' },
            { label: 'Arrived', state: 'pending' },
          ]}
        />
      </Section>

      {/* RouteConnector */}
      <Section title="RouteConnector">
        <Caption text="defaults" />
        <View style={sectionStyles.routeRow}>
          <RouteConnector />
          <View style={sectionStyles.routeText}>
            <Text style={sectionStyles.bodyText}>Origin point</Text>
            <Text style={sectionStyles.bodyText}>Destination point</Text>
          </View>
        </View>
        <Caption text="custom colors, taller, larger dots" />
        <View style={sectionStyles.routeRow}>
          <RouteConnector
            originColor={colors.green.primary}
            destinationColor={colors.violet.primary}
            lineColor={colors.green.tint}
            dotSize={14}
            height={80}
          />
          <View style={sectionStyles.routeText}>
            <Text style={sectionStyles.bodyText}>Driver location</Text>
            <Text style={sectionStyles.bodyText}>Fleet hub</Text>
          </View>
        </View>
      </Section>

      {/* EmptyState */}
      <Section title="EmptyState">
        <Caption text="title only" />
        <Card>
          <EmptyState title="No trips yet" />
        </Card>
        <Caption text="with description" />
        <Card>
          <EmptyState
            title="No activity"
            description="Your completed and ongoing trips will appear here."
          />
        </Card>
        <Caption text="with icon and action" />
        <Card>
          <EmptyState
            icon={<IconGlyph color={colors.blue.primary} large />}
            title="Nothing here"
            description="Try inviting a friend to get started."
            action={<Button label="Invite friend" />}
          />
        </Card>
      </Section>

      {/* Sheet */}
      <Section title="Sheet">
        <Button label="Open default sheet" onPress={() => setSheetVisible(true)} />
        <Button
          label="Open sheet (no handle, md radius)"
          variant="secondary"
          onPress={() => setSheetNoHandle(true)}
        />
      </Section>

      {/* Screen */}
      <Section title="Screen">
        <Text style={sectionStyles.bodyText}>
          This page is rendered inside a Screen with background=&quot;light&quot; and scroll enabled.
          Available backgrounds:
        </Text>
        <View style={sectionStyles.swatchRow}>
          <BackgroundSwatch label="card" color={colors.surface.card} />
          <BackgroundSwatch label="muted" color={colors.surface.muted} />
          <BackgroundSwatch label="passenger" color={colors.surface.bgPassenger} />
          <BackgroundSwatch label="light" color={colors.surface.bgLight} />
        </View>
      </Section>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
        <Text style={sectionStyles.sheetTitle}>Default sheet</Text>
        <Text style={sectionStyles.bodyText}>
          Large radius, drag handle, tap backdrop to dismiss.
        </Text>
        <View style={sectionStyles.sheetActions}>
          <Button label="Close" onPress={() => setSheetVisible(false)} />
        </View>
      </Sheet>

      <Sheet
        visible={sheetNoHandle}
        onClose={() => setSheetNoHandle(false)}
        showHandle={false}
        rounded="md"
      >
        <Text style={sectionStyles.sheetTitle}>No handle, md radius</Text>
        <Text style={sectionStyles.bodyText}>
          Sheet without a drag handle and with the smaller md corner radius.
        </Text>
        <View style={sectionStyles.sheetActions}>
          <Button label="Close" onPress={() => setSheetNoHandle(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

const sectionStyles = StyleSheet.create({
  heading: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
    marginBottom: spacing[5],
  },
  wrap: {
    marginBottom: spacing[8],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[3],
  },
  body: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[3],
  },
  caption: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.label,
    color: colors.ink[500],
    textTransform: 'uppercase',
    marginTop: spacing[2],
  },
  bodyText: {
    fontSize: typography.size.body,
    color: colors.ink[700],
    lineHeight: typography.lineHeight.body,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.size.body,
    color: colors.ink[900],
    backgroundColor: colors.surface.card,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  unpaddedInner: {
    padding: spacing[5],
    backgroundColor: colors.blue.tint,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing[3],
  },
  routeText: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  sheetTitle: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  sheetActions: {
    marginTop: spacing[4],
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  swatchCol: {
    alignItems: 'center',
    gap: spacing[1],
  },
  swatchBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  swatchLabel: {
    fontSize: typography.size.label,
    color: colors.ink[500],
    fontWeight: typography.weight.medium,
  },
});
