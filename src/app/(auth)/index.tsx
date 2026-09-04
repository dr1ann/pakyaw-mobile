/**
 * (auth)/index.tsx
 *
 * Welcome screen — Entry choice for Pakyaw passengers.
 * Clear hierarchy: Create account (primary) vs Sign in (secondary).
 */

import { StyleSheet, View } from 'react-native';
import { Link, Redirect } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Text } from '@pakyaw/shared/components/ui/Text';

export default function WelcomeScreen() {
  const onboardingSeen = useSessionStore((s) => s.onboardingSeen);

  if (!onboardingSeen) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      {/* Brand Hero */}
      <View style={styles.hero}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoIcon}>🛺</Text>
        </View>

        <Text variant="hero" align="center" style={styles.appName}>
          Pakyaw
        </Text>

        <Text variant="h3" align="center" color={colors.ink[700]} style={styles.tagline}>
          Your ride around Ormoc
        </Text>

        <Text variant="body" align="center" color={colors.ink[500]} style={styles.description}>
          Your mobile number is all you need to get started.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Link href="/sign-up" asChild>
          <Button
            label="Create account"
            variant="primary"
            size="lg"
            testID="welcome-sign-up"
          />
        </Link>

        <Link href="/sign-in" asChild>
          <Button
            label="Sign in"
            variant="secondary"
            size="lg"
            testID="welcome-sign-in"
          />
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
    marginTop: spacing[8],
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[5],
  },
  logoIcon: {
    fontSize: 48,
  },
  appName: {
    color: colors.blue.primary,
    marginBottom: spacing[2],
  },
  tagline: {
    marginBottom: spacing[3],
  },
  description: {
    maxWidth: 280,
    lineHeight: typography.lineHeight.body,
  },
  actions: {
    gap: spacing[3],
  },
});
