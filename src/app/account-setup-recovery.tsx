/**
 * account-setup-recovery.tsx
 *
 * Fallback screen for users who have a verified Firebase Auth phone session
 * but no corresponding users/{uid} document in Firestore.
 */

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { auth, signOut } from '@/services/firebase/firebase';
import {
  createVerifiedPassengerProfile,
} from '@/features/auth/services/phone-registration.service';
import {
  resolvePassengerSession,
  storePassengerSessionResolution,
} from '@/features/auth/services/passenger-session.service';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Text } from '@pakyaw/shared/components/ui/Text';

export default function AccountSetupRecoveryScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser;
  const phoneNumber = currentUser?.phoneNumber ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCompleteSetup = async () => {
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

    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!currentUser || !phoneNumber) {
      setErrorMessage('No active phone session found. Please sign in again.');
      return;
    }

    setBusy(true);

    try {
      await createVerifiedPassengerProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        mobile: phoneNumber,
        termsAccepted,
        privacyAccepted,
      });

      const resolution = await resolvePassengerSession(currentUser.uid);
      storePassengerSessionResolution(resolution);
      router.replace('/(passenger)');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to complete account setup. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth).catch(() => undefined);
    usePassengerSessionStore.getState().clear();
    router.replace('/(auth)');
  };

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
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
          <View style={styles.iconBadge}>
            <Text style={styles.iconEmoji}>📋</Text>
          </View>
          <Text variant="h1" align="center" style={styles.title}>
            Complete your profile
          </Text>
          <Text variant="body" align="center" color={colors.ink[500]} style={styles.subtitle}>
            Your mobile number is verified. Finish your profile details to start riding.
          </Text>
        </View>

        <View style={styles.formGroup}>
          <View style={styles.fieldContainer}>
            <Text variant="label" style={styles.label}>Verified mobile</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={phoneNumber}
              editable={false}
            />
          </View>

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
              editable={!busy}
              testID="recovery-firstname-input"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text variant="label" style={styles.label}>Last name</Text>
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
              testID="recovery-lastname-input"
            />
          </View>

          <View style={styles.checkboxContainer}>
            <Pressable
              onPress={() => setTermsAccepted((v) => !v)}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              testID="recovery-terms-checkbox"
            >
              <View style={[styles.checkboxBox, termsAccepted && styles.checkboxBoxChecked]}>
                {termsAccepted ? <Text style={styles.checkboxCheckmark}>✓</Text> : null}
              </View>
              <Text variant="bodySmall" color={colors.ink[700]}>
                I accept the Terms of Service
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setPrivacyAccepted((v) => !v)}
              style={styles.checkboxRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: privacyAccepted }}
              testID="recovery-privacy-checkbox"
            >
              <View style={[styles.checkboxBox, privacyAccepted && styles.checkboxBoxChecked]}>
                {privacyAccepted ? <Text style={styles.checkboxCheckmark}>✓</Text> : null}
              </View>
              <Text variant="bodySmall" color={colors.ink[700]}>
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
            label={busy ? 'Completing setup...' : 'Finish setup'}
            variant="primary"
            size="lg"
            disabled={busy || !isFormValid}
            loading={busy}
            onPress={handleCompleteSetup}
            testID="complete-setup-btn"
          />

          <Button
            label="Sign out & switch number"
            variant="ghost"
            size="md"
            disabled={busy}
            onPress={handleSignOut}
          />
        </View>
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
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconBadge: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    color: colors.ink[900],
    marginBottom: spacing[2],
  },
  subtitle: {
    maxWidth: 290,
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
  inputDisabled: {
    backgroundColor: colors.surface.muted,
    color: colors.ink[500],
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
});
