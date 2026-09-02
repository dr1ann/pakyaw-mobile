import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { auth, signOut } from '@/services/firebase/firebase';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';

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

        <Text style={styles.title}>
          {isBlocked ? 'Account Blocked' : 'Account Suspended'}
        </Text>

        <Text style={styles.message}>
          {isBlocked
            ? 'Your Pakyaw account has been permanently blocked due to violations of our community guidelines. You cannot create new bookings.'
            : 'Your Pakyaw account is temporarily suspended. Please contact customer support to resolve this issue and restore your account.'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.btnPrimary}
          onPress={handleSignOut}
          accessibilityRole="button"
          testID="account-state-sign-out-btn"
        >
          <Text style={styles.btnPrimaryText}>Sign out</Text>
        </Pressable>
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
    borderRadius: 45,
    backgroundColor: colors.amber.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  badgeBlocked: {
    backgroundColor: '#FADBD8',
  },
  emoji: {
    fontSize: 44,
  },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  message: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    maxWidth: 300,
  },
  footer: {
    gap: spacing[3],
  },
  btnPrimary: {
    backgroundColor: colors.ink[900],
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
});
