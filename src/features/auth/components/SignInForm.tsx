/**
 * SignInForm.tsx
 *
 * Passenger sign-in — Mobile number + SMS OTP verification.
 * Resolves existing account from users/{uid}.
 * Does not create a new profile from this screen.
 */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  normalizePhilippineMobile,
  startPassengerPhoneVerification,
  verifyAndResolvePassengerSignIn,
} from '@/features/auth/services/phone-registration.service';
import { storePassengerSessionResolution } from '@/features/auth/services/passenger-session.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import type { ConfirmationResult } from '@/services/firebase/firebase';

function maskMobile(mobile: string): string {
  const clean = mobile.replace(/[^0-9+]/g, '');
  if (clean.length >= 10) {
    return `${clean.slice(0, 4)} *** ${clean.slice(-4)}`;
  }
  return clean;
}

export function SignInForm() {
  const router = useRouter();

  // Form State
  const [mobile, setMobile] = useState('');

  // OTP State
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const sendCode = async () => {
    if (busy) return;
    setErrorMessage(null);
    setAccountNotFound(false);

    const normalized = normalizePhilippineMobile(mobile);
    if (!normalized) {
      setErrorMessage('Please enter a valid Philippine mobile number (e.g., 09171234567).');
      return;
    }

    setBusy(true);
    setLoadingText('Sending code');

    try {
      const confirmResult = await startPassengerPhoneVerification(mobile);
      setConfirmation(confirmResult);
      setCooldown(60);
      setLoadingText(null);
    } catch (err) {
      setLoadingText(null);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('network') || msg.includes('offline')) {
        setErrorMessage('Network error. Check your connection and try again.');
      } else if (msg.includes('too-many') || msg.includes('quota')) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(msg || 'We could not send a verification code. Please check the number and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || busy) return;
    await sendCode();
  };

  const verifyAndSignIn = async () => {
    if (!confirmation || busy) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    setLoadingText('Signing in');
    setErrorMessage(null);
    setAccountNotFound(false);

    try {
      useSessionStore.setState({ signingIn: true });
      const resolution = await verifyAndResolvePassengerSignIn(confirmation, trimmedCode);

      if (resolution.status === 'active') {
        storePassengerSessionResolution(resolution);
        router.replace('/(passenger)');
      } else if (resolution.status === 'suspended' || resolution.status === 'blocked') {
        storePassengerSessionResolution(resolution);
        router.replace('/passenger-account-state');
      } else if (resolution.status === 'needs_recovery') {
        setAccountNotFound(true);
        setErrorMessage('No Pakyaw passenger account was found for this number.');
      } else if (resolution.status === 'invalid_role') {
        setErrorMessage('This account is registered with a different role. Please use the driver sign-in screen.');
      } else {
        setErrorMessage('Unable to sign in. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('invalid-verification-code') || msg.includes('invalid-code')) {
        setErrorMessage('Invalid code. Please check the SMS and try again.');
      } else if (msg.includes('session-expired') || msg.includes('code-expired')) {
        setErrorMessage('Code expired. Please request a new code.');
      } else if (msg.includes('network') || msg.includes('offline')) {
        setErrorMessage('Network error. Check your connection and try again.');
      } else if (msg.includes('too-many')) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(msg || 'Verification failed. Please try again.');
      }
    } finally {
      useSessionStore.setState({ signingIn: false });
      setBusy(false);
      setLoadingText(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {confirmation ? 'Enter verification code' : 'Welcome back'}
          </Text>
          <Text style={styles.subtitle}>
            {confirmation
              ? `We sent a 6-digit code to\n${maskMobile(mobile)}`
              : 'Sign in to your Pakyaw account.'}
          </Text>
        </View>

        {!confirmation ? (
          <View style={styles.formGroup}>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={styles.input}
              value={mobile}
              onChangeText={setMobile}
              placeholder="09XX XXX XXXX"
              placeholderTextColor={colors.ink[400]}
              keyboardType="phone-pad"
              autoComplete="tel"
              editable={!busy}
              testID="signin-mobile-input"
            />

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={busy || mobile.trim().length < 10}
              style={[
                styles.btnPrimary,
                (busy || mobile.trim().length < 10) && styles.btnDisabled,
              ]}
              onPress={sendCode}
              accessibilityRole="button"
              testID="signin-continue-btn"
            >
              {busy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.btnPrimaryText}>{loadingText ?? 'Sending code'}</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>Continue</Text>
              )}
            </Pressable>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{"Don't have an account? "}</Text>
              <Link href="/sign-up" style={styles.link} testID="signin-signup-link">
                Sign up
              </Link>
            </View>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={code}
              onChangeText={setCode}
              placeholder="_ _ _ _ _ _"
              placeholderTextColor={colors.ink[400]}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
              autoFocus
              testID="signin-otp-input"
            />

            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <Text style={styles.cooldownText}>Resend code in {cooldown}s</Text>
              ) : (
                <Pressable onPress={handleResend} disabled={busy} testID="signin-resend-btn">
                  <Text style={styles.resendLink}>Resend code</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  setConfirmation(null);
                  setCode('');
                  setErrorMessage(null);
                  setAccountNotFound(false);
                }}
                disabled={busy}
                testID="signin-change-number-btn"
              >
                <Text style={styles.changeNumberLink}>Change number</Text>
              </Pressable>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text style={styles.errorText}>{errorMessage}</Text>
                {accountNotFound ? (
                  <Link href="/sign-up" style={styles.createAccountLink} testID="not-found-signup-link">
                    Create an account
                  </Link>
                ) : null}
              </View>
            ) : null}

            <Pressable
              disabled={busy || code.trim().length < 6}
              style={[styles.btnPrimary, (busy || code.trim().length < 6) && styles.btnDisabled]}
              onPress={verifyAndSignIn}
              accessibilityRole="button"
              testID="signin-submit-btn"
            >
              {busy ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.btnPrimaryText}>{loadingText ?? 'Signing in'}</Text>
                </View>
              ) : (
                <Text style={styles.btnPrimaryText}>Verify and sign in</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: 60,
    paddingBottom: spacing[10],
    backgroundColor: colors.surface.bgPassenger,
  },
  header: {
    marginBottom: spacing[6],
  },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.body,
  },
  formGroup: {
    gap: spacing[3],
  },
  label: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.label,
    marginTop: spacing[2],
  },
  input: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    fontSize: typography.size.bodyMd,
    color: colors.ink[900],
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: typography.weight.bold,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  cooldownText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[400],
  },
  resendLink: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  changeNumberLink: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  errorBox: {
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#FADBD8',
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.bodySmall,
    lineHeight: 18,
  },
  createAccountLink: {
    marginTop: spacing[2],
    color: colors.blue.primary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
    textDecorationLine: 'underline',
  },
  btnPrimary: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[4],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[4],
  },
  linkText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  link: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
});
