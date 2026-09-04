/**
 * SignInForm.tsx
 *
 * Passenger sign-in — Mobile number + SMS OTP verification.
 * Resolves existing account from users/{uid}.
 * Does not create a new profile from this screen.
 */

import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Text } from '@pakyaw/shared/components/ui/Text';
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

  const otpInputRef = useRef<TextInput>(null);

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
      setErrorMessage('Please enter a valid Philippine mobile number (e.g., 0917 123 4567).');
      return;
    }

    setBusy(true);
    setLoadingText('Sending code...');

    try {
      const confirmResult = await startPassengerPhoneVerification(mobile);
      setConfirmation(confirmResult);
      setCooldown(60);
      setLoadingText(null);
    } catch (err) {
      setLoadingText(null);
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('network') || msg.includes('offline')) {
        setErrorMessage('Network error. Check your internet connection and try again.');
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
    setLoadingText('Signing in...');
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
        setErrorMessage('This account is registered as a driver. Please use the driver app to sign in.');
      } else {
        setErrorMessage('Unable to sign in. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('invalid-verification-code') || msg.includes('invalid-code')) {
        setErrorMessage('That code didn’t work. Check the SMS and try again.');
      } else if (msg.includes('session-expired') || msg.includes('code-expired')) {
        setErrorMessage('This code has expired. Please request a new one.');
      } else if (msg.includes('network') || msg.includes('offline')) {
        setErrorMessage('Network error. Check your connection and try again.');
      } else if (msg.includes('too-many')) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(msg || 'Sign in could not be completed. Please try again.');
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
          <Text variant="h1" style={styles.title}>
            {confirmation ? 'Verify your number' : 'Welcome back'}
          </Text>
          <Text variant="body" color={colors.ink[500]} style={styles.subtitle}>
            {confirmation
              ? `We sent a 6-digit code to ${maskMobile(mobile)}`
              : 'Sign in with your registered mobile number.'}
          </Text>
        </View>

        {!confirmation ? (
          <View style={styles.formGroup}>
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.label}>Mobile number</Text>
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
            </View>

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text variant="bodySmall" color={colors.danger} style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Button
              label={busy ? (loadingText ?? 'Sending code...') : 'Continue'}
              variant="primary"
              size="lg"
              disabled={busy || mobile.trim().length < 10}
              loading={busy}
              onPress={sendCode}
              testID="signin-continue-btn"
            />

            <View style={styles.linkRow}>
              <Text variant="bodySmall" color={colors.ink[500]}>
                {"Don't have an account? "}
              </Text>
              <Link href="/sign-up" style={styles.link} testID="signin-signup-link">
                Create an account
              </Link>
            </View>
          </View>
        ) : (
          <View style={styles.formGroup}>
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.label}>6-digit code</Text>
              <TextInput
                ref={otpInputRef}
                style={[styles.input, styles.otpInput]}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.ink[400]}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                editable={!busy}
                autoFocus
                testID="signin-otp-input"
              />
            </View>

            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <Text variant="bodySmall" color={colors.ink[400]}>
                  Resend code in {cooldown}s
                </Text>
              ) : (
                <Pressable onPress={handleResend} disabled={busy} testID="signin-resend-btn" hitSlop={8}>
                  <Text variant="bodySmall" weight="bold" color={colors.blue.primary}>
                    Resend code
                  </Text>
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
                hitSlop={8}
                testID="signin-change-number-btn"
              >
                <Text variant="bodySmall" color={colors.ink[500]}>
                  Change number
                </Text>
              </Pressable>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Text variant="bodySmall" color={colors.danger} style={styles.errorText}>
                  {errorMessage}
                </Text>
                {accountNotFound ? (
                  <Link href="/sign-up" style={styles.createAccountLink} testID="not-found-signup-link">
                    Create an account
                  </Link>
                ) : null}
              </View>
            ) : null}

            <Button
              label={busy ? (loadingText ?? 'Signing in...') : 'Verify and sign in'}
              variant="primary"
              size="lg"
              disabled={busy || code.trim().length < 6}
              loading={busy}
              onPress={verifyAndSignIn}
              testID="signin-submit-btn"
            />
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
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  subtitle: {
    lineHeight: typography.lineHeight.body,
  },
  formGroup: {
    gap: spacing[4],
  },
  fieldContainer: {
    gap: spacing[1],
  },
  label: {
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.label,
  },
  input: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3] + 2,
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    minHeight: 48,
  },
  otpInput: {
    letterSpacing: 8,
    fontSize: 24,
    textAlign: 'center',
    fontFamily: typography.family.bold,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  errorBox: {
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#FADBD8',
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[1],
  },
  errorText: {
    lineHeight: 18,
  },
  createAccountLink: {
    marginTop: spacing[2],
    color: colors.blue.primary,
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
    textDecorationLine: 'underline',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing[3],
  },
  link: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
});
