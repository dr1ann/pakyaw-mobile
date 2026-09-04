/**
 * DriverSignInForm.tsx
 *
 * Driver Sign In — Phone Number + SMS OTP Verification.
 * Authenticates existing Driver accounts via native phone auth.
 * Resolves driver session state without creating duplicate profiles.
 */

import { useEffect, useRef, useState } from 'react';
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
import { Link, router } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { sanitizeMobileInput, sanitizeOtpCode } from '@/features/onboarding/input-validation';
import {
  normalizePhilippineMobile,
  startDriverPhoneVerification,
} from '@/features/onboarding/services/driver-registration.service';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { ConfirmationResult } from '@/services/firebase/firebase';

function maskMobile(mobile: string): string {
  const normalized = normalizePhilippineMobile(mobile) || mobile;
  const digits = normalized.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+63') && digits.length >= 12) {
    return `+63 •••• ${digits.slice(-4)}`;
  }
  if (digits.length >= 10) {
    return `${digits.slice(0, 4)} ••• ${digits.slice(-4)}`;
  }
  return digits;
}

function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const RESEND_COOLDOWN_SECONDS = 60;

function firebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'unknown';
}

export function DriverSignInForm() {
  const setSigningIn = useSessionStore((state) => state.setSigningIn);

  // Form State
  const [mobile, setMobile] = useState('');

  // OTP State
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef<TextInput>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const canSendCode = normalizePhilippineMobile(mobile) !== null;

  async function handleSendCode() {
    if (busy) return;
    setErrorMessage(null);

    const normalized = normalizePhilippineMobile(mobile);
    if (!normalized) {
      setErrorMessage('Please enter a valid Philippine mobile number (e.g. 0917 123 4567).');
      return;
    }

    setBusy(true);
    setLoadingText('Sending code…');

    try {
      const result = await startDriverPhoneVerification(mobile);
      setConfirmation(result);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (__DEV__) {
        console.error('[Driver Phone Auth] Verification error:', error);
      }
      const errStr = error instanceof Error ? error.message : '';
      if (errStr.includes('network') || errStr.includes('offline')) {
        setErrorMessage('Network error. Check your connection and try again.');
      } else if (errStr.includes('too-many') || errStr.includes('quota')) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'We couldn’t send a verification code. Check the number and try again.',
        );
      }
    } finally {
      setBusy(false);
      setLoadingText(null);
    }
  }

  async function handleVerifyOtp() {
    if (!confirmation || busy) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    setLoadingText('Signing in…');
    setErrorMessage(null);

    try {
      setSigningIn(true);
      const credential = await confirmation.confirm(trimmedCode);
      const uid = credential.user.uid;

      if (__DEV__) {
        console.log('[Driver Sign-In] OTP confirmed for uid:', uid);
      }

      const resolution = await resolveAndStoreDriverSession(uid);

      if (resolution.status === 'driver_application_approved') {
        router.replace('/(driver)');
      } else if (
        resolution.status === 'driver_application_submitted' ||
        resolution.status === 'driver_application_needs_correction' ||
        resolution.status === 'driver_application_rejected' ||
        resolution.status === 'driver_application_draft' ||
        resolution.status === 'authenticated_driver_application_missing'
      ) {
        router.replace('/(driver)/application');
      } else if (
        resolution.status === 'account_suspended' ||
        resolution.status === 'account_blocked' ||
        resolution.status === 'authenticated_role_mismatch'
      ) {
        router.replace('/driver-account-state');
      } else if (resolution.status === 'authenticated_account_missing') {
        setErrorMessage('No Pakyaw Driver account was found for this number. Please apply to drive.');
      } else {
        setErrorMessage('Unable to sign in. Please try again.');
      }
    } catch (error) {
      const codeErr = firebaseErrorCode(error);
      if (__DEV__) {
        console.error(`[Driver Sign-In] OTP confirmation failed: ${codeErr}`, error);
      }
      const msg = error instanceof Error ? error.message : '';
      if (
        msg.includes('invalid-verification-code') ||
        msg.includes('invalid-code') ||
        codeErr.includes('invalid-verification-code')
      ) {
        setErrorMessage('That code isn’t valid. Check the 6 digits and try again.');
      } else if (
        msg.includes('session-expired') ||
        msg.includes('code-expired') ||
        codeErr.includes('session-expired')
      ) {
        setErrorMessage('This code has expired. Request a new one.');
      } else if (msg.includes('network') || msg.includes('offline')) {
        setErrorMessage('Network error. Check your connection and try again.');
      } else if (msg.includes('too-many')) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setErrorMessage(msg || 'Sign in could not be completed. Please try again.');
      }
    } finally {
      setSigningIn(false);
      setBusy(false);
      setLoadingText(null);
    }
  }

  const handleEditNumber = () => {
    if (busy) return;
    setConfirmation(null);
    setCode('');
    setErrorMessage(null);
  };

  const handleGoBack = () => {
    if (confirmation) {
      handleEditNumber();
    } else if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Bar / Back Navigation */}
      <View style={styles.topBar}>
        <Pressable
          onPress={handleGoBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          testID="driver-signin-back-btn"
        >
          <SymbolIcon name="arrow.left" size={20} tintColor={colors.ink[700]} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!confirmation ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.brandBadgeRow}>
                <Text style={styles.brandTitle}>Pakyaw</Text>
                <View style={styles.driverTag}>
                  <Text style={styles.driverTagText}>DRIVER</Text>
                </View>
              </View>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in with your mobile number to access your driver workspace.
              </Text>
            </View>

            {/* Mobile Phone Card */}
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>MOBILE NUMBER</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.flagEmoji}>🇵🇭</Text>
                  <Text style={styles.countryCodeText}>+63</Text>
                  <View style={styles.verticalDivider} />
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={mobile}
                  onChangeText={(value) => setMobile(sanitizeMobileInput(value))}
                  placeholder="9XX XXX XXXX"
                  placeholderTextColor={colors.ink[400]}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  editable={!busy}
                  maxLength={13}
                  autoFocus
                  testID="driver-signin-mobile-input"
                />
              </View>
              <Text style={styles.fieldHelpText}>
                We’ll send a 6-digit verification code via SMS.
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert" testID="signin-error-box">
                <Text style={styles.errorText} selectable>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, (busy || !canSendCode) && styles.buttonDisabled]}
              disabled={busy || !canSendCode}
              onPress={handleSendCode}
              accessibilityRole="button"
              accessibilityLabel="Continue and send verification code"
              testID="driver-signin-send-btn"
            >
              {busy ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.primaryButtonText}>{loadingText ?? 'Sending code…'}</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </Pressable>

            {/* Register Link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkPrompt}>Don’t have a Driver account yet? </Text>
              <Link href="./driver-register" asChild>
                <Pressable hitSlop={8} testID="signin-register-link">
                  <Text style={styles.linkAction}>Apply to drive</Text>
                </Pressable>
              </Link>
            </View>
          </>
        ) : (
          /* ── OTP Verification Step ── */
          <View style={styles.otpSection}>
            <View style={styles.header}>
              <View style={styles.brandBadgeRow}>
                <Text style={styles.brandTitle}>Pakyaw</Text>
                <View style={styles.driverTag}>
                  <Text style={styles.driverTagText}>DRIVER</Text>
                </View>
              </View>
              <Text style={styles.title}>Verify your number</Text>
              <Text style={styles.subtitle}>
                Code sent to <Text style={styles.maskedNumber}>{maskMobile(mobile)}</Text>
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>6-DIGIT CODE</Text>

              {/* Visual 6-Digit OTP Cells */}
              <Pressable
                onPress={() => otpInputRef.current?.focus()}
                style={styles.otpCellsContainer}
                accessible
                accessibilityLabel={`Verification code entered: ${code}`}
              >
                {[0, 1, 2, 3, 4, 5].map((idx) => {
                  const digit = code[idx] || '';
                  const isCurrent = code.length === idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.otpCell,
                        digit ? styles.otpCellFilled : null,
                        isCurrent ? styles.otpCellActive : null,
                      ]}
                    >
                      <Text style={styles.otpDigitText}>{digit}</Text>
                    </View>
                  );
                })}
              </Pressable>

              {/* Hidden Real Input for Native Keyboard & Autofill */}
              <TextInput
                ref={otpInputRef}
                style={styles.hiddenOtpInput}
                value={code}
                onChangeText={(value) => setCode(sanitizeOtpCode(value))}
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                maxLength={6}
                editable={!busy}
                autoFocus
                testID="driver-signin-otp-input"
              />

              <View style={styles.resendRow}>
                <Text style={styles.resendPrompt}>Didn’t receive it?</Text>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>
                    Resend code in {formatCooldown(cooldown)}
                  </Text>
                ) : (
                  <Pressable
                    onPress={handleSendCode}
                    disabled={busy}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Resend verification code"
                    testID="driver-signin-resend-btn"
                  >
                    <Text style={styles.resendBtnText}>Resend code</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                onPress={handleEditNumber}
                disabled={busy}
                style={styles.editNumberBtn}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Change mobile number"
                testID="driver-signin-change-number-btn"
              >
                <Text style={styles.editNumberText}>
                  Wrong number? <Text style={styles.editNumberTextHighlight}>Change</Text>
                </Text>
              </Pressable>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox} accessibilityRole="alert" testID="otp-error-box">
                <Text style={styles.errorText} selectable>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, (busy || code.length !== 6) && styles.buttonDisabled]}
              disabled={busy || code.length !== 6}
              onPress={handleVerifyOtp}
              accessibilityRole="button"
              accessibilityLabel="Sign in and verify"
              testID="driver-signin-verify-btn"
            >
              {busy ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.primaryButtonText}>{loadingText ?? 'Signing in…'}</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  topBar: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  container: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  header: {
    gap: spacing[1],
  },
  brandBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  brandTitle: {
    fontSize: typography.size.h3,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    letterSpacing: -0.3,
  },
  driverTag: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  driverTagText: {
    fontSize: 10,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: 20,
  },
  maskedNumber: {
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  formCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[3],
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.ink[400],
    letterSpacing: 0.8,
    marginTop: spacing[1],
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.bgLight,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    minHeight: 48,
    paddingHorizontal: spacing[3],
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingRight: spacing[2],
  },
  flagEmoji: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: typography.size.body,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border.subtle,
    marginLeft: spacing[2],
  },
  phoneInput: {
    flex: 1,
    fontSize: typography.size.body,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    paddingVertical: spacing[2],
    paddingLeft: spacing[2],
  },
  fieldHelpText: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.regular,
    color: colors.ink[400],
  },
  primaryButton: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  primaryButtonText: {
    fontSize: typography.size.body,
    fontFamily: typography.family.bold,
    color: colors.white,
    letterSpacing: 0.2,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  buttonDisabled: {
    backgroundColor: colors.ink[400],
    opacity: 0.6,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[2],
  },
  linkPrompt: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  linkAction: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  otpSection: {
    gap: spacing[4],
  },
  otpCellsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
    marginVertical: spacing[2],
  },
  otpCell: {
    flex: 1,
    aspectRatio: 0.95,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpCellFilled: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.surface.card,
  },
  otpCellActive: {
    borderColor: colors.blue.primary,
    borderWidth: 2,
    backgroundColor: colors.blue.tint,
  },
  otpDigitText: {
    fontSize: 22,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1],
  },
  resendPrompt: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  cooldownText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
  },
  resendBtnText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  editNumberBtn: {
    alignSelf: 'center',
    paddingVertical: spacing[2],
    marginTop: spacing[1],
  },
  editNumberText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  editNumberTextHighlight: {
    color: colors.blue.primary,
    fontFamily: typography.family.bold,
  },
  errorBox: {
    backgroundColor: colors.surface.muted,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing[3],
  },
  errorText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.danger,
    lineHeight: 18,
  },
});
