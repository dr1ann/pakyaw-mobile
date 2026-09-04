/**
 * (auth)/index.tsx
 *
 * Driver Welcome Screen — Modern Pakyaw entry point.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, Redirect } from 'expo-router';

import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function WelcomeScreen() {
  const onboardingSeen = useSessionStore((s) => s.onboardingSeen);
  if (!onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      {/* Brand Hero */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🛺</Text>
        </View>
        <Text style={styles.appName}>
          Drive with <Text style={styles.appNameHighlight}>Pakyaw</Text>
        </Text>
        <Text style={styles.tagline}>
          Serve local Ormoc passengers. Complete verification and start accepting rides.
        </Text>

        {/* Feature Highlights */}
        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Direct passenger dispatch in Ormoc City</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Standard distance-based fare calculations</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>Secure, paperless verification checklist</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Link href="./driver-register" asChild>
          <Pressable
            style={styles.btnPrimary}
            accessibilityRole="button"
            accessibilityLabel="Apply to drive with Pakyaw"
            testID="welcome-driver-apply"
          >
            <Text style={styles.btnPrimaryLabel}>Apply to drive</Text>
          </Pressable>
        </Link>
        <Link href="/driver-sign-in" asChild>
          <Pressable
            style={styles.btnDriver}
            accessibilityRole="button"
            accessibilityLabel="Driver sign-in for existing accounts"
            testID="welcome-driver-signin"
          >
            <Text style={styles.btnDriverLabel}>Driver sign-in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.bgPassenger,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[15],
    paddingBottom: spacing[10],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[3],
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  logoEmoji: {
    fontSize: 44,
  },
  appName: {
    fontSize: typography.size.h1,
    fontFamily: typography.family.extraBold,
    color: colors.ink[900],
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.tight,
  },
  appNameHighlight: {
    color: colors.blue.primary,
  },
  tagline: {
    fontSize: typography.size.body,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    maxWidth: 300,
  },
  featureList: {
    marginTop: spacing[4],
    gap: spacing[2],
    alignSelf: 'stretch',
    backgroundColor: colors.surface.card,
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blue.primary,
  },
  featureText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
    flex: 1,
  },
  actions: {
    gap: spacing[3],
  },
  btnPrimary: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryLabel: {
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.bold,
    color: colors.white,
  },
  btnDriver: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  btnDriverLabel: {
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.semibold,
    color: colors.ink[700],
  },
});
