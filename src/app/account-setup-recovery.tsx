import { useState } from 'react';
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
import { auth, signOut } from '@/services/firebase/firebase';
import {
  createVerifiedPassengerProfile,
} from '@/features/auth/services/phone-registration.service';
import {
  resolvePassengerSession,
  storePassengerSessionResolution,
} from '@/features/auth/services/passenger-session.service';
import { usePassengerSessionStore } from '@/features/auth/stores/passenger-session.store';

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
    if (trimmedFirstName.length < 2) {
      setErrorMessage('Please enter your first name (at least 2 characters).');
      return;
    }

    const trimmedLastName = lastName.trim();
    if (trimmedLastName.length < 2) {
      setErrorMessage('Please enter your last name (at least 2 characters).');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }

    if (!currentUser || !phoneNumber) {
      setErrorMessage('No authenticated session found. Please sign in again.');
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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>📋</Text>
        </View>
        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>
          Your mobile number is verified. Complete your profile details to start riding.
        </Text>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Verified mobile</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={phoneNumber}
          editable={false}
        />

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
          testID="recovery-firstname-input"
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
          testID="recovery-lastname-input"
        />

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
            <Text style={styles.checkboxLabel}>I accept the Terms of Service</Text>
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
            lastName.trim().length < 2
          }
          style={[
            styles.btnPrimary,
            (busy ||
              !termsAccepted ||
              !privacyAccepted ||
              firstName.trim().length < 2 ||
              lastName.trim().length < 2) &&
              styles.btnDisabled,
          ]}
          onPress={handleCompleteSetup}
          accessibilityRole="button"
          testID="complete-setup-btn"
        >
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.btnPrimaryText}>Finish setup</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.btnSecondary}
          onPress={handleSignOut}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.btnSecondaryText}>Sign out & switch number</Text>
        </Pressable>
      </View>
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
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  iconEmoji: {
    fontSize: 36,
  },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    maxWidth: 300,
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
  inputDisabled: {
    backgroundColor: colors.surface.muted,
    color: colors.ink[500],
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
  btnSecondary: {
    paddingVertical: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
  },
});
