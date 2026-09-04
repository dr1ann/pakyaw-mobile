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
import { type ConfirmationResult } from '@/services/firebase/firebase';
import { router } from 'expo-router';

import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { OnboardingProgressHeader } from '@/features/onboarding/components/OnboardingProgressHeader';
import { OnboardingTextField } from '@/features/onboarding/components/application-field';
import { sanitizeMobileInput, sanitizeOtpCode } from '@/features/onboarding/input-validation';
import {
  createVerifiedDriverProfile,
  normalizePhilippineMobile,
  startDriverPhoneVerification,
} from '@/features/onboarding/services/driver-registration.service';
import { useDriverSessionStore } from '@/features/auth/stores/driver-session.store';
import { resolveAndStoreDriverSession } from '@/features/auth/services/driver-session.service';
import { colors, radius, spacing, typography } from '@/constants/theme';

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

export default function DriverRegistrationScreen() {
  const setSigningIn = useSessionStore((state) => state.setSigningIn);
  const setPendingSetup = useDriverSessionStore((state) => state.setPendingSetup);
  const clearPendingSetup = useDriverSessionStore((state) => state.clearPendingSetup);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const otpInputRef = useRef<TextInput>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const canSendCode =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    normalizePhilippineMobile(mobile) !== null &&
    terms &&
    privacy;

  async function handleSendCode() {
    if (busy) return;
    setBusy(true);
    setLoadingText('Sending code…');
    setMessage(null);
    try {
      const result = await startDriverPhoneVerification(mobile);
      setConfirmation(result);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setPendingSetup({
        legalName: {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          suffix: suffix.trim() || undefined,
        },
        termsAccepted: terms,
        privacyAccepted: privacy,
      });
    } catch (error) {
      if (__DEV__) {
        console.error('[Driver Phone Auth] Verification error:', error);
      }
      const errStr = error instanceof Error ? error.message : '';
      if (errStr.includes('network') || errStr.includes('offline')) {
        setMessage('Network error. Check your connection and try again.');
      } else if (errStr.includes('too-many') || errStr.includes('quota')) {
        setMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else {
        setMessage(
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
    setBusy(true);
    setLoadingText('Verifying…');
    setMessage(null);
    setSigningIn(true);
    let otpConfirmed = false;
    let authenticatedUid: string | null = null;
    try {
      const credential = await confirmation.confirm(code);
      otpConfirmed = true;
      authenticatedUid = credential.user.uid;
      if (__DEV__) {
        console.log('[Driver Onboarding] OTP confirmed');
      }
      const uid = await createVerifiedDriverProfile({
        legalName: {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          suffix: suffix.trim() || undefined,
        },
        mobile,
        termsAccepted: terms,
        privacyAccepted: privacy,
      });
      await resolveAndStoreDriverSession(uid || credential.user.uid);
      clearPendingSetup();
      router.replace('../(driver)/application');
    } catch (error) {
      if (otpConfirmed && authenticatedUid) {
        setMessage('Your mobile number was verified, but we couldn’t finish setting up your account. Try again.');
        try {
          await resolveAndStoreDriverSession(authenticatedUid);
        } catch {
          useDriverSessionStore.getState().setResolutionError(authenticatedUid);
        }
      } else {
        const codeErr = firebaseErrorCode(error);
        if (__DEV__) {
          console.error(`[Driver Onboarding] OTP confirmation failed: ${codeErr}`, error);
        }
        const msg = error instanceof Error ? error.message : '';
        if (msg.includes('invalid-verification-code') || msg.includes('invalid-code') || codeErr.includes('invalid-verification-code')) {
          setMessage('That code isn’t valid. Check the 6 digits and try again.');
        } else if (msg.includes('session-expired') || msg.includes('code-expired') || codeErr.includes('session-expired')) {
          setMessage('This code has expired. Request a new one.');
        } else if (msg.includes('network') || msg.includes('offline')) {
          setMessage('Network error. Check your connection and try again.');
        } else if (msg.includes('too-many')) {
          setMessage('Too many attempts. Please wait a few minutes before trying again.');
        } else {
          setMessage('That code isn’t valid. Check the 6 digits and try again.');
        }
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
    setMessage(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <OnboardingProgressHeader
        currentStep={1}
        totalSteps={5}
        stepTitle="Account"
        canGoBack={Boolean(confirmation) || (typeof router.canGoBack === 'function' && router.canGoBack())}
        onBack={() => {
          if (confirmation) {
            handleEditNumber();
          } else if (typeof router.canGoBack === 'function' && router.canGoBack()) {
            router.back();
          }
        }}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!confirmation ? (
          <>
            {/* Brand & Title Header */}
            <View style={styles.header}>
              <View style={styles.brandBadgeRow}>
                <Text style={styles.brandTitle}>Pakyaw</Text>
                <View style={styles.driverTag}>
                  <Text style={styles.driverTagText}>DRIVER</Text>
                </View>
              </View>
              <Text style={styles.title}>Create your Driver account</Text>
              <Text style={styles.subtitle}>
                Verify your mobile number to continue your application.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>YOUR LEGAL NAME</Text>
              <OnboardingTextField
                label="First name"
                required
                value={firstName}
                onChangeText={(value) => setFirstName(value)}
                placeholder="Juan"
                autoCapitalize="words"
                autoComplete="name-given"
                editable={!busy}
                testID="driver-firstname-input"
              />
              <OnboardingTextField
                label="Middle name"
                optional
                value={middleName}
                onChangeText={(value) => setMiddleName(value)}
                placeholder="Santos"
                autoCapitalize="words"
                autoComplete="name-middle"
                editable={!busy}
                testID="driver-middlename-input"
              />
              <OnboardingTextField
                label="Last name"
                required
                value={lastName}
                onChangeText={(value) => setLastName(value)}
                placeholder="Dela Cruz"
                autoCapitalize="words"
                autoComplete="name-family"
                editable={!busy}
                testID="driver-lastname-input"
              />
              <OnboardingTextField
                label="Suffix"
                optional
                value={suffix}
                onChangeText={(value) => setSuffix(value)}
                placeholder="Jr."
                autoCapitalize="words"
                editable={!busy}
                testID="driver-suffix-input"
              />

              <View style={styles.divider} />

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
                  testID="driver-mobile-input"
                />
              </View>
              <Text style={styles.fieldHelpText}>
                We’ll send a 6-digit verification code via SMS.
              </Text>

              <View style={styles.divider} />

              {/* Checkboxes */}
              <Pressable
                onPress={() => setTerms((value) => !value)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: terms }}
                accessibilityLabel="I accept the Terms of Service"
                disabled={busy}
                testID="driver-terms-checkbox"
              >
                <View style={[styles.checkboxBox, terms && styles.checkboxBoxChecked]}>
                  {terms ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  I accept the Terms of Service <Text style={styles.required}>*</Text>
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setPrivacy((value) => !value)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacy }}
                accessibilityLabel="I accept the Privacy Policy"
                disabled={busy}
                testID="driver-privacy-checkbox"
              >
                <View style={[styles.checkboxBox, privacy && styles.checkboxBoxChecked]}>
                  {privacy ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.checkboxLabel}>
                  I accept the Privacy Policy <Text style={styles.required}>*</Text>
                </Text>
              </Pressable>
            </View>

            {message ? (
              <View style={styles.errorBox} accessibilityRole="alert" testID="register-error-box">
                <Text style={styles.errorText} selectable>
                  {message}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, (busy || !canSendCode) && styles.buttonDisabled]}
              disabled={busy || !canSendCode}
              onPress={handleSendCode}
              accessibilityRole="button"
              accessibilityLabel="Continue and send verification code"
              testID="driver-verify-mobile-btn"
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

            <Text style={styles.reassuranceText}>
              Your number is used for your Pakyaw Driver account.
            </Text>
          </>
        ) : (
          /* ── OTP Verification Screen ── */
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
                testID="driver-otp-input"
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
                    testID="driver-resend-btn"
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
                testID="driver-change-number-btn"
              >
                <Text style={styles.editNumberText}>Wrong number? <Text style={styles.editNumberTextHighlight}>Change</Text></Text>
              </Pressable>
            </View>

            {message ? (
              <View style={styles.errorBox} accessibilityRole="alert" testID="otp-error-box">
                <Text style={styles.errorText} selectable>
                  {message}
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.primaryButton, (busy || code.length !== 6) && styles.buttonDisabled]}
              disabled={busy || code.length !== 6}
              onPress={handleVerifyOtp}
              accessibilityRole="button"
              accessibilityLabel="Verify code and continue"
              testID="driver-confirm-otp-btn"
            >
              {busy ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.primaryButtonText}>{loadingText ?? 'Verifying…'}</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
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
  container: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
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
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 44,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.bgLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: colors.blue.primary,
    borderColor: colors.blue.primary,
  },
  checkMark: {
    color: colors.white,
    fontSize: 13,
    fontFamily: typography.family.bold,
    lineHeight: 15,
  },
  checkboxLabel: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
    flex: 1,
  },
  required: {
    color: colors.danger,
    fontFamily: typography.family.bold,
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
  reassuranceText: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.regular,
    color: colors.ink[400],
    textAlign: 'center',
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
