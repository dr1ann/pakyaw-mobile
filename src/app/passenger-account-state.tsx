/**
 * passenger-account-state.tsx
 *
 * Screen displayed when a passenger's account is suspended or blocked.
 * Prevents entry into the main booking experience while providing clear guidance.
 */

import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { auth, signOut } from '@/services/firebase/firebase';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Text } from '@pakyaw/shared/components/ui/Text';

export default function PassengerAccountStateScreen() {
  const router = useRouter();
  const status = usePassengerSessionStore((s) => s.status);
  const isBlocked = status === 'blocked';

  const handleSignOut = async () => {
    await signOut(auth).catch(() => undefined);
    usePassengerSessionStore.getState().clear();
    router.replace('/(auth)');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.badge, isBlocked && styles.badgeBlocked]}>
          <Text style={styles.emoji}>{isBlocked ? '🚫' : '⏸️'}</Text>
        </View>

        <Text variant="h1" align="center" style={styles.title}>
          {isBlocked ? 'Account Blocked' : 'Account Suspended'}
        </Text>

        <Text variant="body" align="center" color={colors.ink[500]} style={styles.message}>
          {isBlocked
            ? 'Your Pakyaw account has been permanently blocked due to violations of our community guidelines. You cannot create new bookings.'
            : 'Your Pakyaw account is temporarily suspended. Please contact customer support to resolve this issue and restore your account.'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label="Sign out"
          variant="primary"
          tone={isBlocked ? 'destructive' : 'default'}
          size="lg"
          onPress={handleSignOut}
          testID="account-state-sign-out-btn"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.bgPassenger,
    paddingHorizontal: spacing[6],
    paddingTop: 80,
    paddingBottom: spacing[10],
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  badge: {
    width: 90,
    height: 90,
    borderRadius: radius.pill,
    backgroundColor: colors.amber.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  badgeBlocked: {
    backgroundColor: colors.dangerSubtle,
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    color: colors.ink[900],
    marginBottom: spacing[3],
  },
  message: {
    maxWidth: 300,
    lineHeight: typography.lineHeight.body,
  },
  footer: {
    gap: spacing[3],
  },
});
