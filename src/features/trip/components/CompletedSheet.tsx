/**
 * CompletedSheet — Phase 8E passenger/driver sheet.
 *
 * Shown when trip status is 'completed'. Confirms the ride finished
 * successfully.
 */

import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { colors, spacing, typography } from '@/constants/theme';

type CompletedSheetProps = {
  onDismiss: () => void;
};

export function CompletedSheet({ onDismiss }: CompletedSheetProps) {
  return (
    <View style={styles.container}>
      <StatusPill label="Completed" tone="success" dot />
      <Text style={styles.title}>Trip completed</Text>
      <Text style={styles.subtitle}>
        You&apos;ve arrived at your destination. Thank you for riding with
        Pakyaw!
      </Text>
      <Button label="Done" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[3],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.body,
  },
});
