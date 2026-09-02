import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ConfirmationResult } from '@/services/firebase/firebase';
import { router } from 'expo-router';

import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { OnboardingProgressHeader } from '@/features/onboarding/components/OnboardingProgressHeader';
import { OnboardingTextField } from '@/features/onboarding/components/application-field';
import { onboardingFieldGuidance } from '@/features/onboarding/field-guidance';
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
    return `${digits.slice(0, 6)} ••• ${digits.slice(-4)}`;
  }
  return digits;
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
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

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
      setMessage(
        error instanceof Error
          ? error.message
          : 'We couldn’t start mobile verification. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp() {
    if (!confirmation || busy) return;
    setBusy(true);
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
        if (__DEV__) {
          console.error(`[Driver Onboarding] OTP confirmation failed: ${firebaseErrorCode(error)}`);
        }
        setMessage('We couldn’t verify that code. Check the code and try again.');
      }
    } finally {
      setSigningIn(false);
      setBusy(false);
    }
  }

  const handleEditNumber = () => {
    if (busy) return;
    setConfirmation(null);
    setCode('');
    setMessage(null);
  };

  return (
    <View style={styles.screen}>
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
            <View style={styles.header}>
              <Text style={styles.title}>Create your Driver account</Text>
              <Text style={styles.subtitle}>
                We’ll verify your mobile number before continuing.
              </Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Your legal name</Text>
              <OnboardingTextField
                label="First name"
                required
                value={firstName}
                onChangeText={(value) => setFirstName(value)}
                placeholder="Juan"
                autoCapitalize="words"
                autoComplete="name-given"
                editable={!busy}
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
              />
              <OnboardingTextField
                label="Suffix"
                optional
                value={suffix}
                onChangeText={(value) => setSuffix(value)}
                placeholder="Jr."
                autoCapitalize="words"
                editable={!busy}
              />

              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>Mobile number</Text>
              <OnboardingTextField
                label={onboardingFieldGuidance.mobile.label}
                required
                help={onboardingFieldGuidance.mobile.help}
                value={mobile}
                onChangeText={(value) => setMobile(sanitizeMobileInput(value))}
                placeholder={onboardingFieldGuidance.mobile.placeholder}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!busy}
              />

              <View style={styles.divider} />

              <Pressable
                onPress={() => setTerms((value) => !value)}
                style={styles.check}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: terms }}
                disabled={busy}
              >
                <Text style={styles.checkLabel}>
                  {terms ? '☑' : '☐'} I accept the Terms of Service <Text style={styles.required}>*</Text>
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPrivacy((value) => !value)}
                style={styles.check}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: privacy }}
                disabled={busy}
              >
                <Text style={styles.checkLabel}>
                  {privacy ? '☑' : '☐'} I accept the Privacy Policy <Text style={styles.required}>*</Text>
                </Text>
              </Pressable>
            </View>

            {message ? (
              <View style={styles.errorBox}>
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
              testID="driver-verify-mobile-btn"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify mobile</Text>
              )}
            </Pressable>

            <Text style={styles.note}>
              Fields marked <Text style={styles.required}>*</Text> are required. Your mobile number will be verified with a one-time SMS code.
            </Text>
          </>
        ) : (
          /* OTP Screen */
          <View style={styles.otpSection}>
            <View style={styles.header}>
              <Text style={styles.title}>Verify your mobile</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit verification code to{' '}
                <Text style={styles.maskedNumber}>{maskMobile(mobile)}</Text>
              </Text>
            </View>

            <View style={styles.formCard}>
              <OnboardingTextField
                label="SMS verification code"
                required
                placeholder="123456"
                value={code}
                onChangeText={(value) => setCode(sanitizeOtpCode(value))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!busy}
                autoFocus
              />

              <View style={styles.resendRow}>
                <Text style={styles.resendPrompt}>{"Didn’t receive the code?"}</Text>
                {cooldown > 0 ? (
                  <Text style={styles.cooldownText}>Resend in {cooldown}s</Text>
                ) : (
                  <Pressable onPress={handleSendCode} disabled={busy} hitSlop={8}>
                    <Text style={styles.resendBtnText}>Resend</Text>
                  </Pressable>
                )}
              </View>

              <Pressable onPress={handleEditNumber} disabled={busy} style={styles.editNumberBtn}>
                <Text style={styles.editNumberText}>Change mobile number</Text>
              </Pressable>
            </View>

            {message ? (
              <View style={styles.errorBox}>
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
              testID="driver-confirm-otp-btn"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify</Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  container: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    gap: spacing[1],
  },
  title: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: 14,
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
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  nameField: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
  },
  check: {
    minHeight: 38,
    justifyContent: 'center',
  },
  checkLabel: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
    lineHeight: 18,
  },
  required: {
    color: '#B42318',
    fontFamily: typography.family.bold,
  },
  primaryButton: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
  buttonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  errorBox: {
    backgroundColor: '#FEE4E2',
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
    fontFamily: typography.family.medium,
    lineHeight: 18,
  },
  note: {
    color: colors.ink[500],
    fontSize: 12,
    fontFamily: typography.family.regular,
    textAlign: 'center',
    lineHeight: 17,
  },
  otpSection: {
    gap: spacing[4],
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing[1],
  },
  resendPrompt: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  resendBtnText: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  cooldownText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[400],
  },
  editNumberBtn: {
    alignSelf: 'center',
    paddingVertical: spacing[1],
  },
  editNumberText: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
    textDecorationLine: 'underline',
  },
});
