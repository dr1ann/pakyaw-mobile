/**
 * (auth)/index.tsx
 *
 * Welcome screen — account type choice.
 * Passengers → sign-up or sign-in.
 * Drivers → driver-sign-in.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link, Redirect } from 'expo-router';

import { useSessionStore } from '@/stores/sessionStore';

const COLORS = {
  ink900: '#0E1726',
  ink500: '#6B7689',
  ink400: '#9AA4B2',
  bluePrimary: '#2F80ED',
  blueTint: '#E8F1FE',
  greenPrimary: '#27AE60',
  greenTint: '#E3F6EC',
  surfaceCard: '#FFFFFF',
  borderSubtle: '#E6EBF2',
  bgPassenger: '#EAF1FB',
};

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
          <Text style={{ color: COLORS.bluePrimary }}>Pakyaw</Text>
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Are you a driver?</Text>
          <View style={styles.dividerLine} />
        </View>

        <Link href="/driver-sign-in" asChild>
          <Pressable
            style={styles.btnDriver}
            accessibilityRole="button"
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
    backgroundColor: COLORS.bgPassenger,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  hero: { alignItems: 'center', gap: 16 },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  logoEmoji: { fontSize: 48 },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink900,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: COLORS.ink500,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  actions: { gap: 12 },
  btnPrimary: {
    backgroundColor: COLORS.bluePrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  btnSecondary: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.bluePrimary,
  },
  btnSecondaryLabel: { fontSize: 16, fontWeight: '600', color: COLORS.bluePrimary },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.borderSubtle },
  dividerText: { fontSize: 13, color: COLORS.ink400 },
  btnDriver: {
    backgroundColor: COLORS.greenTint,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.greenPrimary,
  },
  btnDriverLabel: { fontSize: 16, fontWeight: '600', color: COLORS.greenPrimary },
  ink900: '#0E1726',
});
