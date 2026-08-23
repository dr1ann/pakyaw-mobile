import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ConfirmationResult } from 'firebase/auth';
import { router } from 'expo-router';

import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { OnboardingTextField } from '@/features/onboarding/components/application-field';
import { onboardingFieldGuidance } from '@/features/onboarding/field-guidance';
import { composeFullLegalName, hasNamePart, sanitizeMobileInput, sanitizeNamePart, sanitizeOtpCode } from '@/features/onboarding/input-validation';
import { createVerifiedDriverProfile, DriverPhoneVerificationConfigurationError, normalizePhilippineMobile, startDriverPhoneVerification } from '@/features/onboarding/services/driver-registration.service';
import { firebaseConfig } from '@/services/firebase/firebase';
import { FirebaseRecaptchaVerifierModal } from '@/services/firebase/recaptcha-verifier';

export default function DriverRegistrationScreen() {
  const setSession = useSessionStore((state) => state.setSession);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fullLegalName = useMemo(
    () => composeFullLegalName(firstName, middleName, lastName),
    [firstName, lastName, middleName],
  );
  const canSendCode = hasNamePart(firstName)
    && hasNamePart(lastName)
    && normalizePhilippineMobile(mobile) !== null
    && terms
    && privacy;

  async function sendCode() {
    setBusy(true);
    setMessage(null);
    try {
      const verifier = recaptchaVerifier.current;
      if (!verifier) throw new DriverPhoneVerificationConfigurationError();
      setConfirmation(await startDriverPhoneVerification(mobile, verifier));
    } catch (error) {
      setMessage(error instanceof DriverPhoneVerificationConfigurationError
        ? error.message
        : 'We could not send a verification code. Check your mobile number and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function completeRegistration() {
    if (!confirmation) return;
    setBusy(true);
    setMessage(null);
    try {
      const credential = await confirmation.confirm(code);
      const uid = await createVerifiedDriverProfile({
        name: fullLegalName,
        mobile,
        termsAccepted: terms,
        privacyAccepted: privacy,
      });
      setSession(uid || credential.user.uid, 'driver');
      router.replace('../(driver)/application');
    } catch {
      setMessage('We could not verify that code. Check it and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <FirebaseRecaptchaVerifierModal ref={recaptchaVerifier} firebaseConfig={firebaseConfig} />
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Apply to drive with Pakyaw</Text>
        <Text style={styles.subtitle}>Verify your mobile number, then complete your driver application.</Text>

        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <OnboardingTextField
              label="First name"
              required
              value={firstName}
              onChangeText={(value) => setFirstName(sanitizeNamePart(value))}
              placeholder="Juan"
              autoCapitalize="words"
              autoComplete="name"
              editable={!busy}
            />
          </View>
          <View style={styles.nameField}>
            <OnboardingTextField
              label="Middle name"
              optional
              value={middleName}
              onChangeText={(value) => setMiddleName(sanitizeNamePart(value))}
              placeholder="Santos"
              autoCapitalize="words"
              editable={!busy}
            />
          </View>
        </View>
        <OnboardingTextField
          label="Last name"
          required
          value={lastName}
          onChangeText={(value) => setLastName(sanitizeNamePart(value))}
          placeholder="Dela Cruz"
          autoCapitalize="words"
          autoComplete="name"
          editable={!busy}
        />
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

        <Pressable onPress={() => setTerms((value) => !value)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: terms }}>
          <Text style={styles.checkLabel}>{terms ? '☑' : '☐'} I accept the Terms of Service <Text style={styles.required}>*</Text></Text>
        </Pressable>
        <Pressable onPress={() => setPrivacy((value) => !value)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: privacy }}>
          <Text style={styles.checkLabel}>{privacy ? '☑' : '☐'} I accept the Privacy Policy <Text style={styles.required}>*</Text></Text>
        </Pressable>

        {confirmation ? (
          <>
            <OnboardingTextField
              label={onboardingFieldGuidance.otp.label}
              required
              help={onboardingFieldGuidance.otp.help}
              value={code}
              onChangeText={(value) => setCode(sanitizeOtpCode(value))}
              placeholder={onboardingFieldGuidance.otp.placeholder}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
            />
            <Pressable style={[styles.button, (busy || code.length !== 6) && styles.disabled]} disabled={busy || code.length !== 6} onPress={completeRegistration} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Verify and start application</Text>}
            </Pressable>
          </>
        ) : (
          <Pressable style={[styles.button, (busy || !canSendCode) && styles.disabled]} disabled={busy || !canSendCode} onPress={sendCode} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send verification code</Text>}
          </Pressable>
        )}

        {message ? <Text style={styles.error} selectable>{message}</Text> : null}
        <Text style={styles.note}>Fields marked <Text style={styles.required}>*</Text> are required. Your name and verified mobile are used to start your private application.</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: '#F7FAFE' },
  title: { fontSize: 28, fontWeight: '700', color: '#0E1726' },
  subtitle: { color: '#6B7689', marginBottom: 12, lineHeight: 20 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameField: { flex: 1 },
  check: { minHeight: 44, justifyContent: 'center' },
  checkLabel: { color: '#364152', lineHeight: 20 },
  required: { color: '#B42318', fontWeight: '800' },
  button: { backgroundColor: '#27AE60', borderRadius: 999, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: '#B42318', backgroundColor: '#FEE4E2', borderRadius: 8, padding: 10, lineHeight: 19 },
  note: { color: '#6B7689', fontSize: 12, marginTop: 6, lineHeight: 18 },
});
