import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useDriverSession, useDriverSessionStore } from '@/features/auth/stores/driver-session.store';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';
import { auth } from '@/services/firebase/firebase';
import { signOutUser } from '@pakyaw/shared/features/auth/services/auth.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

const COPY = {
  authenticated_role_mismatch: {
    title: 'This account can’t use Driver mode',
    body: 'This Pakyaw account isn’t registered as a Driver account.',
  },
  account_suspended: {
    title: 'Account suspended',
    body: 'Your Driver account is temporarily suspended. Contact Pakyaw Operations for help.',
  },
  account_blocked: {
    title: 'Account blocked',
    body: 'This Driver account can’t access Pakyaw services. Contact Pakyaw Operations for help.',
  },
  driver_session_error: {
    title: 'We couldn’t verify your account',
    body: 'Pakyaw couldn’t load your account information. Try again.',
  },
} as const;

export default function DriverAccountStateScreen() {
  const { status } = useDriverSession();
  const [busy, setBusy] = useState(false);
  const copy = COPY[status as keyof typeof COPY] ?? COPY.driver_session_error;
  const canRetry = status === 'driver_session_error';

  async function retry() {
    const user = auth.currentUser;
    if (!user) return;
    setBusy(true);
    useDriverSessionStore.getState().beginResolving(user.uid);
    try {
      await resolveAndStoreDriverSession(user.uid);
    } catch {
      useDriverSessionStore.getState().setResolutionError(user.uid);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await signOutUser();
    } finally {
      useDriverSessionStore.getState().clear();
      useSessionStore.getState().clear();
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{status === 'driver_session_error' ? '!' : '•'}</Text>
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>

      <View style={styles.actions}>
        {canRetry ? (
          <Pressable
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={retry}
            disabled={busy}
            accessibilityRole="button"
            testID="driver-session-retry"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Try again</Text>}
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.secondaryButton, busy && styles.disabled]}
          onPress={signOut}
          disabled={busy}
          accessibilityRole="button"
          testID="driver-session-sign-out"
        >
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
    padding: spacing[6],
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    paddingTop: spacing[12],
    gap: spacing[3],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE4E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  icon: {
    fontSize: 36,
    color: colors.danger,
    fontFamily: typography.family.bold,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  body: {
    maxWidth: 320,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
  },
  actions: {
    gap: spacing[3],
    paddingBottom: spacing[4],
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: typography.family.bold,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.ink[700],
    fontSize: 15,
    fontFamily: typography.family.bold,
  },
  disabled: { opacity: 0.5 },
});
