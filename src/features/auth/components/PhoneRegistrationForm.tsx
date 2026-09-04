/**
 * PhoneRegistrationForm.tsx
 *
 * Passenger Account Creation Flow:
 * 1. Name + Mobile Number Entry
 * 2. 6-digit SMS OTP Verification
 * 3. Ready to Ride Transition
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
  createVerifiedPassengerProfile,
  normalizePhilippineMobile,
  startPassengerPhoneVerification,
} from '@/features/auth/services/phone-registration.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { resolvePassengerSession, storePassengerSessionResolution } from '@/features/auth/services/passenger-session.service';
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

export function PhoneRegistrationForm() {
  const router = useRouter();

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // OTP State
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Success State
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);

  // Refs for keyboard progression
  const lastNameRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);
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

    const trimmedFirstName = firstName.trim();
    if (trimmedFirstName.length === 0) {
      setErrorMessage('Please enter your first name.');
      return;
    }

    const trimmedLastName = lastName.trim();
    if (trimmedLastName.length === 0) {
      setErrorMessage('Please enter your last name.');
      return;
    }

    const normalized = normalizePhilippineMobile(mobile);
    if (!normalized) {
      setErrorMessage('Please enter a valid Philippine mobile number (e.g., 0917 123 4567).');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
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

  const verifyAndCreate = async () => {
    if (!confirmation || busy) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    setLoadingText('Verifying mobile...');
    setErrorMessage(null);

    try {
      useSessionStore.setState({ signingIn: true });
      const credential = await confirmation.confirm(trimmedCode);
      const uid = credential.user.uid;

      await createVerifiedPassengerProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobile,
        termsAccepted,
        privacyAccepted,
      });

      const resolution = await resolvePassengerSession(uid);
      storePassengerSessionResolution(resolution);

      setOnboardingSuccess(true);
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
        setErrorMessage(msg || 'Verification could not be completed. Please try again.');
      }
    } finally {
      useSessionStore.setState({ signingIn: false });
      setBusy(false);
      setLoadingText(null);
    }
  };

  const handleStartBooking = () => {
    router.replace('/(passenger)');
  };

  // Success Screen
  if (onboardingSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successContent}>
          <View style={styles.successBadge}>
            <Text style={styles.successEmoji}>🎉</Text>
          </View>
          <Text variant="h1" align="center" style={styles.successTitle}>
            You’re ready to ride
          </Text>
          <Text variant="bodyMd" align="center" color={colors.ink[500]} style={styles.successSubtitle}>
            Your Pakyaw account is ready.
          </Text>
        </View>

        <Button
          label="Start booking"
          variant="primary"
          size="lg"
          onPress={handleStartBooking}
          testID="start-booking-btn"
        />
      </View>
    );
  }

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    mobile.trim().length >= 10 &&
    termsAccepted &&
    privacyAccepted;

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
            {confirmation ? 'Verify your mobile number' : 'Create your account'}
          </Text>
          <Text variant="body" color={colors.ink[500]} style={styles.subtitle}>
            {confirmation
              ? `We sent a 6-digit code to ${maskMobile(mobile)}`
              : 'Your mobile number is all you need to get started.'}
          </Text>
        </View>

        {!confirmation ? (
          <View style={styles.formGroup}>
            {/* First Name */}
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.label}>First name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="e.g. Juan"
                placeholderTextColor={colors.ink[400]}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="given-name"
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                editable={!busy}
                testID="registration-firstname-input"
              />
            </View>

            {/* Last Name */}
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.label}>Last name</Text>
              <TextInput
                ref={lastNameRef}
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="e.g. Dela Cruz"
                placeholderTextColor={colors.ink[400]}
                autoCapitalize="words"
                autoCorrect={false}
                autoComplete="family-name"
                returnKeyType="next"
                onSubmitEditing={() => mobileRef.current?.focus()}
                editable={!busy}
                testID="registration-lastname-input"
              />
            </View>

            {/* Mobile Number */}
            <View style={styles.fieldContainer}>
              <Text variant="label" style={styles.label}>Mobile number</Text>
              <TextInput
                ref={mobileRef}
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                placeholder="09XX XXX XXXX"
                placeholderTextColor={colors.ink[400]}
                keyboardType="phone-pad"
                autoComplete="tel"
                returnKeyType="done"
                editable={!busy}
                testID="passenger-mobile-input"
              />
            </View>

            {/* Terms & Privacy */}
            <View style={styles.checkboxContainer}>
              <Pressable
                onPress={() => setTermsAccepted((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted }}
                testID="terms-checkbox"
              >
                <View style={[styles.checkboxBox, termsAccepted && styles.checkboxBoxChecked]}>
                  {termsAccepted ? <Text style={styles.checkboxCheckmark}>✓</Text> : null}
                </View>
                <Text variant="bodySmall" color={colors.ink[700]} style={styles.checkboxLabel}>
                  I accept the Terms of Service
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setPrivacyAccepted((v) => !v)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacyAccepted }}
                testID="privacy-checkbox"
              >
                <View style={[styles.checkboxBox, privacyAccepted && styles.checkboxBoxChecked]}>
                  {privacyAccepted ? <Text style={styles.checkboxCheckmark}>✓</Text> : null}
                </View>
                <Text variant="bodySmall" color={colors.ink[700]} style={styles.checkboxLabel}>
                  I accept the Privacy Policy
                </Text>
              </Pressable>
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
              disabled={busy || !isFormValid}
              loading={busy}
              onPress={sendCode}
              testID="send-code-btn"
            />

            <View style={styles.linkRow}>
              <Text variant="bodySmall" color={colors.ink[500]}>
                {'Already have an account? '}
              </Text>
              <Link href="/sign-in" style={styles.link} testID="registration-signin-link">
                Sign in
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
                testID="otp-input"
              />
            </View>

            <View style={styles.resendRow}>
              {cooldown > 0 ? (
                <Text variant="bodySmall" color={colors.ink[400]}>
                  Resend code in {cooldown}s
                </Text>
              ) : (
                <Pressable onPress={handleResend} disabled={busy} testID="resend-btn" hitSlop={8}>
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
                }}
                disabled={busy}
                hitSlop={8}
                testID="change-number-btn"
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
              </View>
            ) : null}

            <Button
              label={busy ? (loadingText ?? 'Verifying...') : 'Verify and continue'}
              variant="primary"
              size="lg"
              disabled={busy || code.trim().length < 6}
              loading={busy}
              onPress={verifyAndCreate}
              testID="verify-otp-btn"
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
  checkboxContainer: {
    marginTop: spacing[1],
    gap: spacing[2],
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: spacing[3],
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.blue.primary,
    borderColor: colors.blue.primary,
  },
  checkboxCheckmark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
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
  successContainer: {
    flex: 1,
    backgroundColor: colors.surface.bgPassenger,
    paddingHorizontal: spacing[6],
    paddingTop: 80,
    paddingBottom: spacing[10],
    justifyContent: 'space-between',
  },
  successContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  successBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  successEmoji: {
    fontSize: 48,
  },
  successTitle: {
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  successSubtitle: {
    maxWidth: 260,
  },
});
