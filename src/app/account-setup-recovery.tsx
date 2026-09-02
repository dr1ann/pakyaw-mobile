import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { createVerifiedDriverProfile } from '@/features/onboarding/services/driver-registration.service';
import { useDriverSessionStore } from '@/features/auth/stores/driver-session.store';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';
import { auth } from '@/services/firebase/firebase';
import { signOutUser } from '@pakyaw/shared/features/auth/services/auth.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

const RECOVERY_MESSAGE = 'Your mobile number was verified, but we couldn’t finish setting up your account. Try again.';

export default function AccountSetupRecoveryScreen() {
  const pendingSetup = useDriverSessionStore((state) => state.pendingSetup);
  const clearPendingSetup = useDriverSessionStore((state) => state.clearPendingSetup);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function continueSetup() {
    const user = auth.currentUser;
    if (!user?.phoneNumber || !pendingSetup) {
      setMessage('Your saved setup details are unavailable. Use another number and try again.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await createVerifiedDriverProfile({
        legalName: pendingSetup.legalName,
        mobile: user.phoneNumber,
        termsAccepted: pendingSetup.termsAccepted,
        privacyAccepted: pendingSetup.privacyAccepted,
      });
      await resolveAndStoreDriverSession(user.uid);
      clearPendingSetup();
    } catch {
      setMessage(RECOVERY_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  async function useAnotherNumber() {
    setBusy(true);
    clearPendingSetup();
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
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.eyebrow}>Mobile verified ✓</Text>
        <Text style={styles.title}>Finish setting up your account</Text>
        <Text style={styles.body}>
          Your mobile number was verified, but we couldn’t finish creating your Pakyaw account.
        </Text>
        {message ? <Text style={styles.error}>{message}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, busy && styles.disabled]}
          onPress={continueSetup}
          disabled={busy}
          accessibilityRole="button"
          testID="account-recovery-continue"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Continue setup</Text>}
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, busy && styles.disabled]}
          onPress={useAnotherNumber}
          disabled={busy}
          accessibilityRole="button"
          testID="account-recovery-use-another-number"
        >
          <Text style={styles.secondaryButtonText}>Use another number</Text>
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
    backgroundColor: colors.green.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  icon: {
    fontSize: 38,
    color: colors.green.primary,
    fontFamily: typography.family.bold,
  },
  eyebrow: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
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
  error: {
    maxWidth: 340,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.family.medium,
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
