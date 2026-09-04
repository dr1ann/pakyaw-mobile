/**
 * (auth)/index.tsx
 *
 * Welcome screen — account type choice.
 * Passengers → sign-up or sign-in.
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
      {/* Logo / brand mark area */}
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoEmoji}>🛺</Text>
        </View>
        <Text style={styles.appName}>
          Welcome to{' '}
          <Text style={{ color: colors.blue.primary }}>Pakyaw</Text>
        </Text>
        <Text style={styles.tagline}>
          Your reliable ride, on demand — around Ormoc City.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Link href="/sign-up" asChild>
          <Pressable
            style={styles.btnPrimary}
            accessibilityRole="button"
            testID="welcome-sign-up"
          >
            <Text style={styles.btnPrimaryLabel}>Create account</Text>
          </Pressable>
        </Link>

        <Link href="/sign-in" asChild>
          <Pressable
            style={styles.btnSecondary}
            accessibilityRole="button"
            testID="welcome-sign-in"
          >
            <Text style={styles.btnSecondaryLabel}>I already have an account</Text>
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
    paddingTop: spacing[20],
    paddingBottom: spacing[12],
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: spacing[4],
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: typography.size.h1,
    fontFamily: typography.family.extraBold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  tagline: {
    fontSize: typography.size.body,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    maxWidth: 280,
  },
  actions: {
    gap: spacing[3],
  },
  btnPrimary: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  btnPrimaryLabel: {
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.bold,
    color: colors.white,
  },
  btnSecondary: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.blue.primary,
  },
  btnSecondaryLabel: {
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
});
