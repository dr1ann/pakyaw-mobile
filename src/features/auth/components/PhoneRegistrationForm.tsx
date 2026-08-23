import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import type { ConfirmationResult } from 'firebase/auth';

import {
  createVerifiedPassengerProfile,
  PhoneVerificationConfigurationError,
  startPassengerPhoneVerification,
} from '@/features/auth/services/phone-registration.service';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { firebaseConfig } from '@/services/firebase/firebase';
import { FirebaseRecaptchaVerifierModal } from '@/services/firebase/recaptcha-verifier';

export function PhoneRegistrationForm() {
  const setSession = useSessionStore((state) => state.setSession);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const verifier = recaptchaVerifier.current;
      if (!verifier) throw new PhoneVerificationConfigurationError();
      setConfirmation(await startPassengerPhoneVerification(mobile, verifier));
    } catch (error) {
      setMessage(error instanceof PhoneVerificationConfigurationError || error instanceof Error ? error.message : 'Unable to send a verification code.');
    } finally { setBusy(false); }
  };

  const verifyAndCreate = async () => {
    if (!confirmation) return;
    setBusy(true);
    setMessage(null);
    try {
      const credential = await confirmation.confirm(code.trim());
      await createVerifiedPassengerProfile({ name, mobile, termsAccepted, privacyAccepted });
      setSession(credential.user.uid, 'passenger');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to verify this mobile number.');
    } finally { setBusy(false); }
  };

  return <><FirebaseRecaptchaVerifierModal ref={recaptchaVerifier} firebaseConfig={firebaseConfig} /><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Create your Pakyaw account</Text>
    <Text style={styles.subtitle}>Your Philippine mobile number is verified before an account is created.</Text>
    <Text style={styles.label}>FULL NAME</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Juan dela Cruz" autoComplete="name" />
    <Text style={styles.label}>MOBILE NUMBER</Text><TextInput style={styles.input} value={mobile} onChangeText={setMobile} placeholder="09171234567" keyboardType="phone-pad" autoComplete="tel" />
    <Pressable onPress={() => setTermsAccepted((value) => !value)} style={styles.checkbox}><Text>{termsAccepted ? '☑' : '☐'} I accept the Terms of Service</Text></Pressable>
    <Pressable onPress={() => setPrivacyAccepted((value) => !value)} style={styles.checkbox}><Text>{privacyAccepted ? '☑' : '☐'} I accept the Privacy Policy</Text></Pressable>
    {confirmation ? <><Text style={styles.label}>SMS CODE</Text><TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="6-digit code" keyboardType="number-pad" /><Pressable disabled={busy || code.trim().length === 0 || !termsAccepted || !privacyAccepted} style={styles.button} onPress={verifyAndCreate}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify and create account</Text>}</Pressable></> : <Pressable disabled={busy || !termsAccepted || !privacyAccepted || name.trim().length < 2} style={styles.button} onPress={sendCode}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send verification code</Text>}</Pressable>}
    {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    <Text style={styles.note}>Complete the security check, then enter the Firebase test code.</Text>
  </ScrollView></>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 12, justifyContent: 'center', backgroundColor: '#EAF1FB' },
  title: { fontSize: 28, fontWeight: '700', color: '#0E1726' }, subtitle: { color: '#6B7689', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7689', marginTop: 6 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6EBF2', borderRadius: 10, padding: 14, fontSize: 16 },
  checkbox: { paddingVertical: 4 }, button: { backgroundColor: '#2F80ED', borderRadius: 999, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#C62828' }, note: { color: '#6B7689', fontSize: 12, marginTop: 6 },
});
