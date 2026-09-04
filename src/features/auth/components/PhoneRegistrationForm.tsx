import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  createVerifiedPassengerProfile,
  normalizePhilippineMobile,
  startPassengerPhoneVerification,
} from '@/features/auth/services/phone-registration.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { resolvePassengerSession, storePassengerSessionResolution } from '@/features/auth/services/passenger-session.service';
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
    if (trimmedFirstName.length < 2) {
      setErrorMessage('Please enter your first name (at least 2 characters).');
      return;
    }

    const trimmedLastName = lastName.trim();
    if (trimmedLastName.length < 2) {
      setErrorMessage('Please enter your last name (at least 2 characters).');
      return;
    }

    const normalized = normalizePhilippineMobile(mobile);
    if (!normalized) {
      setErrorMessage('Please enter a valid Philippine mobile number (e.g., 09171234567).');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
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

  const verifyAndCreate = async () => {
    if (!confirmation || busy) return;

    const trimmedCode = code.trim();
    if (trimmedCode.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setBusy(true);
    setLoadingText('Verifying your mobile');
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
          <Text style={styles.successTitle}>You’re ready to ride</Text>
          <Text style={styles.successSubtitle}>Your Pakyaw account is ready.</Text>
        </View>

        <Pressable
          style={styles.btnPrimary}
          onPress={handleStartBooking}
          accessibilityRole="button"
          testID="start-booking-btn"
        >
          <Text style={styles.btnPrimaryText}>Start booking</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {confirmation ? 'Verify mobile number' : 'Create your account'}
        </Text>
        <Text style={styles.subtitle}>
          {confirmation
            ? `Enter the 6-digit code sent to ${maskMobile(mobile)}`
            : 'Enter your details to get started with Pakyaw.'}
        </Text>
      </View>

      {!confirmation ? (
        <View style={styles.formGroup}>
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g. Juan"
            placeholderTextColor={colors.ink[400]}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="given-name"
            editable={!busy}
            testID="registration-firstname-input"
          />

          <Text style={styles.label}>Last name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="e.g. Dela Cruz"
            placeholderTextColor={colors.ink[400]}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="family-name"
            editable={!busy}
            testID="registration-lastname-input"
          />

          <Text style={styles.label}>Mobile number</Text>
          <TextInput
            style={styles.input}
            value={mobile}
            onChangeText={setMobile}
            placeholder="09171234567"
            placeholderTextColor={colors.ink[400]}
            keyboardType="phone-pad"
            autoComplete="tel"
            editable={!busy}
            testID="passenger-mobile-input"
          />

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
              <Text style={styles.checkboxLabel}>I accept the Terms of Service</Text>
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
              <Text style={styles.checkboxLabel}>I accept the Privacy Policy</Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={
              busy ||
              !termsAccepted ||
              !privacyAccepted ||
              firstName.trim().length < 2 ||
              lastName.trim().length < 2 ||
              mobile.trim().length < 10
            }
            style={[
              styles.btnPrimary,
              (busy ||
                !termsAccepted ||
                !privacyAccepted ||
                firstName.trim().length < 2 ||
                lastName.trim().length < 2 ||
                mobile.trim().length < 10) &&
                styles.btnDisabled,
            ]}
            onPress={sendCode}
            accessibilityRole="button"
            testID="send-code-btn"
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
        </View>
      ) : (
        <View style={styles.formGroup}>
          <Text style={styles.label}>6-digit code</Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor={colors.ink[400]}
            keyboardType="number-pad"
            maxLength={6}
            editable={!busy}
            autoFocus
            testID="otp-input"
          />

          <View style={styles.resendRow}>
            {cooldown > 0 ? (
              <Text style={styles.cooldownText}>Resend code in {cooldown}s</Text>
            ) : (
              <Pressable onPress={handleResend} disabled={busy} testID="resend-btn">
                <Text style={styles.resendLink}>Resend code</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setConfirmation(null);
                setCode('');
                setErrorMessage(null);
              }}
              disabled={busy}
            >
              <Text style={styles.changeNumberLink}>Change number</Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Pressable
            disabled={busy || code.trim().length < 6}
            style={[styles.btnPrimary, (busy || code.trim().length < 6) && styles.btnDisabled]}
            onPress={verifyAndCreate}
            accessibilityRole="button"
            testID="verify-otp-btn"
          >
            {busy ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.white} size="small" />
                <Text style={styles.btnPrimaryText}>{loadingText ?? 'Verifying your mobile'}</Text>
              </View>
            ) : (
              <Text style={styles.btnPrimaryText}>Verify & finish</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
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
  checkboxContainer: {
    marginTop: spacing[2],
    gap: spacing[3],
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: typography.size.body,
    color: colors.ink[700],
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
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  successSubtitle: {
    fontSize: typography.size.bodyMd,
    color: colors.ink[500],
    textAlign: 'center',
  },
});
