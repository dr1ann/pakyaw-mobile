import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

type StatusScreenProps = {
  readonly onAction?: () => void;
  readonly reason?: string;
  readonly onContactSupport?: () => void;
};

export function SubmittedStatusScreen({
  onAction,
  onContactSupport,
}: StatusScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⏳</Text>
        </View>

        <Text style={styles.title}>Application submitted</Text>
        <Text style={styles.subtitle}>
          Pakyaw Operations is reviewing your details and documents.
        </Text>

        {/* Status Timeline */}
        <View style={styles.timeline}>
          <View style={styles.timelineStep}>
            <View style={[styles.timelineNode, styles.timelineNodeDone]}>
              <Text style={styles.nodeIconText}>✓</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabelDone}>Application submitted</Text>
              <Text style={styles.timelineSubDone}>Pakyaw Operations received your files securely</Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineStep}>
            <View style={[styles.timelineNode, styles.timelineNodeActive]}>
              <Text style={styles.nodeIconText}>●</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabelActive}>Document review</Text>
              <Text style={styles.timelineSubActive}>Pakyaw Operations is verifying your documents</Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineStep}>
            <View style={styles.timelineNode}>
              <Text style={styles.nodeIconText}>○</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabelPending}>Final approval</Text>
              <Text style={styles.timelineSubPending}>Account clearance</Text>
            </View>
          </View>

          <View style={styles.timelineLine} />

          <View style={styles.timelineStep}>
            <View style={styles.timelineNode}>
              <Text style={styles.nodeIconText}>○</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabelPending}>Ready to drive</Text>
              <Text style={styles.timelineSubPending}>Accept rides around Ormoc City</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={onAction} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>View application summary</Text>
        </Pressable>
        {onContactSupport ? (
          <Pressable style={styles.textButton} onPress={onContactSupport} accessibilityRole="button">
            <Text style={styles.textButtonLabel}>Need help? Contact support</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function NeedsCorrectionStatusScreen({
  reason,
  onAction,
}: StatusScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: colors.amber.tint }]}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>

        <Text style={styles.title}>Action needed</Text>
        <Text style={styles.subtitle}>
          Pakyaw Operations reviewed your application and needs updated information.
        </Text>

        <View style={styles.reasonCard}>
          <Text style={styles.reasonHeader}>Feedback from Operations</Text>
          <Text style={styles.reasonBody}>{reason || 'Review and upload the highlighted document again.'}</Text>
        </View>

        <Text style={styles.hintText}>
          You don’t need to redo the entire form. Update only the requested documents.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={onAction} accessibilityRole="button">
          <Text style={styles.primaryButtonText}>Update requested documents</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export function ApprovedStatusScreen({
  onAction,
}: StatusScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: colors.green.tint }]}>
          <Text style={styles.iconText}>🎉</Text>
        </View>

        <Text style={styles.title}>You’re approved!</Text>
        <Text style={styles.subtitle}>
          Welcome to Pakyaw. Your Driver account is fully verified and ready.
        </Text>

        <View style={styles.successCheckRow}>
          <View style={styles.greenCheckBadge}>
            <Text style={styles.greenCheckText}>✓</Text>
          </View>
          <Text style={styles.successCheckLabel}>Account active and ready to go online</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.green.primary }]}
          onPress={onAction}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Start driving</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RejectedStatusScreen({
  reason,
  onContactSupport,
}: StatusScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={[styles.iconCircle, { backgroundColor: '#FEE4E2' }]}>
          <Text style={styles.iconText}>❌</Text>
        </View>

        <Text style={styles.title}>Application declined</Text>
        <Text style={styles.subtitle}>
          Pakyaw Operations declined your application.
        </Text>

        <View style={styles.reasonCard}>
          <Text style={styles.reasonHeader}>Reason</Text>
          <Text style={styles.reasonBody}>
            {reason || 'Your application doesn’t meet the Driver requirements for Ormoc operations.'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {onContactSupport ? (
          <Pressable style={styles.secondaryButton} onPress={onContactSupport} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Contact support</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: spacing[4],
    justifyContent: 'space-between',
    backgroundColor: colors.surface.bgLight,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  iconText: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  timeline: {
    width: '100%',
    marginTop: spacing[4],
    paddingHorizontal: spacing[2],
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timelineNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineNodeDone: {
    backgroundColor: colors.green.primary,
  },
  timelineNodeActive: {
    backgroundColor: colors.blue.primary,
  },
  nodeIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabelDone: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  timelineSubDone: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  timelineLabelActive: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  timelineSubActive: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.blue.primary,
  },
  timelineLabelPending: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
  },
  timelineSubPending: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[400],
  },
  timelineLine: {
    width: 2,
    height: 22,
    backgroundColor: colors.border.subtle,
    marginLeft: 13,
    marginVertical: 2,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: colors.amber.tint,
    borderWidth: 1,
    borderColor: '#F8D29D',
    borderRadius: radius.md,
    padding: spacing[4],
    gap: 4,
    marginTop: spacing[2],
  },
  reasonHeader: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.amber.deep,
  },
  reasonBody: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    lineHeight: 20,
  },
  hintText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 18,
  },
  successCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing[3],
    backgroundColor: colors.green.tint,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.pill,
  },
  greenCheckBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCheckText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  successCheckLabel: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
  },
  footer: {
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  primaryButton: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: typography.family.bold,
    color: colors.ink[700],
  },
  textButton: {
    paddingVertical: spacing[2],
    alignItems: 'center',
  },
  textButtonLabel: {
    fontSize: 14,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
});
