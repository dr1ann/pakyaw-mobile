import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';

import {
  signUpCredentialsSchema,
  signUpProfileSchema,
  type SignUpCredentials,
  type SignUpProfile,
} from '@pakyaw/shared/features/auth/validation/schemas';
import { useSignUp } from '@/features/auth/hooks/useSignUp';
import type { RiderType } from '@pakyaw/shared/features/auth/types';

// ---------------------------------------------------------------------------
// Design tokens (Phase 4 will consolidate these into theme.ts)
// ---------------------------------------------------------------------------
const COLORS = {
  ink900: '#0E1726',
  ink500: '#6B7689',
  ink400: '#9AA4B2',
  bluePrimary: '#2F80ED',
  blueTint: '#E8F1FE',
  danger: '#EB5757',
  surfaceCard: '#FFFFFF',
  surfaceMuted: '#F4F7FB',
  borderSubtle: '#E6EBF2',
  bgPassenger: '#EAF1FB',
};

// ---------------------------------------------------------------------------
// Shared field component
// ---------------------------------------------------------------------------
interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label.toUpperCase()}</Text>
      {children}
      {error ? (
        <Text style={fieldStyles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: COLORS.ink500,
  },
  error: { fontSize: 13, color: COLORS.danger },
});

// ---------------------------------------------------------------------------
// Step progress indicator
// ---------------------------------------------------------------------------
const STEPS = ['Account', 'Profile', 'Type', 'Review'];

function StepProgress({ current }: { current: number }) {
  return (
    <View style={progressStyles.container}>
      <Text style={progressStyles.label}>
        STEP {current + 1} OF {STEPS.length}
      </Text>
      <View style={progressStyles.bar}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              progressStyles.segment,
              i <= current ? progressStyles.segmentActive : progressStyles.segmentInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { gap: 8, marginBottom: 24 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: COLORS.ink500,
    textAlign: 'center',
  },
  bar: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  segmentActive: { backgroundColor: COLORS.bluePrimary },
  segmentInactive: { backgroundColor: COLORS.borderSubtle },
});

// ---------------------------------------------------------------------------
// Primary button
// ---------------------------------------------------------------------------
interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}

function PrimaryButton({ label, onPress, disabled, loading, testID }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[btnStyles.btn, (disabled || loading) && btnStyles.btnDisabled]}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={[btnStyles.label, (disabled || loading) && btnStyles.labelDisabled]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.bluePrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { backgroundColor: COLORS.surfaceMuted },
  label: { fontSize: 16, fontWeight: '700', color: '#fff' },
  labelDisabled: { color: COLORS.ink400 },
});

// ---------------------------------------------------------------------------
// Rider type cards
// ---------------------------------------------------------------------------
const RIDER_TYPES: { value: RiderType; label: string; description: string }[] = [
  { value: 'regular', label: 'Regular', description: 'Standard rate' },
  { value: 'student', label: 'Student', description: 'Valid school ID required' },
  { value: 'pwd', label: 'PWD', description: 'PWD ID required' },
  { value: 'senior', label: 'Senior Citizen', description: 'Senior ID required' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SignUpForm() {
  const {
    step,
    formData,
    credentialsMutation,
    saveProfile,
    selectRiderType,
    createProfileMutation,
    goBack,
  } = useSignUp();

  // Step 0 — Credentials form
  const credentialsForm = useForm<SignUpCredentials>({
    resolver: zodResolver(signUpCredentialsSchema),
    mode: 'onChange',
  });

  // Step 1 — Profile form
  const profileForm = useForm<SignUpProfile>({
    resolver: zodResolver(signUpProfileSchema),
    mode: 'onChange',
  });

  const credEmail = useWatch({ control: credentialsForm.control, name: 'email', defaultValue: '' });
  const credPassword = useWatch({ control: credentialsForm.control, name: 'password', defaultValue: '' });
  const profFirstName = useWatch({ control: profileForm.control, name: 'firstName', defaultValue: '' });
  const profLastName = useWatch({ control: profileForm.control, name: 'lastName', defaultValue: '' });
  const profPhone = useWatch({ control: profileForm.control, name: 'phone', defaultValue: '' });

  const stepIndex = (['credentials', 'profile', 'riderType', 'review'] as const).indexOf(step);

  const mutationError =
    credentialsMutation.error ||
    createProfileMutation.error;

  const errorMessage = mutationError instanceof Error ? mutationError.message : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          {step !== 'credentials' ? (
            <Pressable onPress={goBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join Pakyaw and ride instantly.</Text>
        </View>

        <StepProgress current={stepIndex} />

        {/* ---------------------------------------------------------------- */}
        {/* Step 0 — Credentials                                             */}
        {/* ---------------------------------------------------------------- */}
        {step === 'credentials' && (
          <View style={styles.form}>
            <Field
              label="Email"
              error={credentialsForm.formState.errors.email?.message}
            >
              <TextInput
                style={[
                  styles.input,
                  credentialsForm.formState.errors.email ? styles.inputError : null,
                ]}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.ink400}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                onChangeText={(t) =>
                  credentialsForm.setValue('email', t, { shouldValidate: true })
                }
                value={credEmail}
                testID="signup-email-input"
              />
            </Field>

            <Field
              label="Password"
              error={credentialsForm.formState.errors.password?.message}
            >
              <TextInput
                style={[
                  styles.input,
                  credentialsForm.formState.errors.password ? styles.inputError : null,
                ]}
                placeholder="Minimum 6 characters"
                placeholderTextColor={COLORS.ink400}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                onChangeText={(t) =>
                  credentialsForm.setValue('password', t, { shouldValidate: true })
                }
                value={credPassword}
                testID="signup-password-input"
              />
            </Field>

            {errorMessage ? (
              <Text style={styles.formError}>{errorMessage}</Text>
            ) : null}

            <PrimaryButton
              label="Continue"
              onPress={credentialsForm.handleSubmit((values) => {
                credentialsMutation.mutate(values);
              })}
              disabled={!credentialsForm.formState.isValid}
              loading={credentialsMutation.isPending}
              testID="signup-step1-continue"
            />

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <Link href="/sign-in" style={styles.link}>
                Sign in
              </Link>
            </View>
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 1 — Profile (name + phone)                                  */}
        {/* ---------------------------------------------------------------- */}
        {step === 'profile' && (
          <View style={styles.form}>
            <Field
              label="First name"
              error={profileForm.formState.errors.firstName?.message}
            >
              <TextInput
                style={[
                  styles.input,
                  profileForm.formState.errors.firstName ? styles.inputError : null,
                ]}
                placeholder="Juan"
                placeholderTextColor={COLORS.ink400}
                autoCapitalize="words"
                textContentType="givenName"
                onChangeText={(t) =>
                  profileForm.setValue('firstName', t, { shouldValidate: true })
                }
                value={profFirstName}
                testID="signup-firstname-input"
              />
            </Field>

            <Field
              label="Last name"
              error={profileForm.formState.errors.lastName?.message}
            >
              <TextInput
                style={[
                  styles.input,
                  profileForm.formState.errors.lastName ? styles.inputError : null,
                ]}
                placeholder="dela Cruz"
                placeholderTextColor={COLORS.ink400}
                autoCapitalize="words"
                textContentType="familyName"
                onChangeText={(t) =>
                  profileForm.setValue('lastName', t, { shouldValidate: true })
                }
                value={profLastName}
                testID="signup-lastname-input"
              />
            </Field>

            <Field
              label="Mobile number"
              error={profileForm.formState.errors.phone?.message}
            >
              <TextInput
                style={[
                  styles.input,
                  profileForm.formState.errors.phone ? styles.inputError : null,
                ]}
                placeholder="+639XXXXXXXXX"
                placeholderTextColor={COLORS.ink400}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                onChangeText={(t) =>
                  profileForm.setValue('phone', t, { shouldValidate: true })
                }
                value={profPhone}
                testID="signup-phone-input"
              />
            </Field>

            <PrimaryButton
              label="Continue"
              onPress={profileForm.handleSubmit((values) => saveProfile(values))}
              disabled={!profileForm.formState.isValid}
              loading={false}
              testID="signup-profile-continue"
            />
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 2 — Rider type                                              */}
        {/* ---------------------------------------------------------------- */}
        {step === 'riderType' && (
          <View style={styles.form}>
            <Text style={styles.sectionHint}>
              Select your rider type. This is stored for your profile and may be
              used for future discounts.
            </Text>

            {RIDER_TYPES.map((rt) => (
              <Pressable
                key={rt.value}
                style={[
                  styles.typeCard,
                  formData.riderType === rt.value && styles.typeCardSelected,
                ]}
                onPress={() => selectRiderType(rt.value)}
                testID={`rider-type-${rt.value}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: formData.riderType === rt.value }}
              >
                <Text
                  style={[
                    styles.typeLabel,
                    formData.riderType === rt.value && styles.typeLabelSelected,
                  ]}
                >
                  {rt.label}
                </Text>
                <Text style={styles.typeDesc}>{rt.description}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Step 3 — Review                                                  */}
        {/* ---------------------------------------------------------------- */}
        {step === 'review' && (
          <View style={styles.form}>
            <View style={styles.reviewCard}>
              <ReviewRow label="Email" value={formData.email} />
              <ReviewRow
                label="Name"
                value={`${formData.firstName} ${formData.lastName}`}
              />
              <ReviewRow label="Mobile" value={formData.phone} />
              <ReviewRow
                label="Rider type"
                value={
                  RIDER_TYPES.find((r) => r.value === formData.riderType)?.label ??
                  formData.riderType
                }
              />
            </View>

            {errorMessage ? (
              <Text style={styles.formError}>{errorMessage}</Text>
            ) : null}

            <PrimaryButton
              label="Create account"
              onPress={() => createProfileMutation.mutate()}
              loading={createProfileMutation.isPending}
              testID="signup-create-account"
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={reviewStyles.row}>
      <Text style={reviewStyles.label}>{label}</Text>
      <Text style={reviewStyles.value}>{value}</Text>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  label: { fontSize: 14, color: COLORS.ink500 },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.ink900,
    maxWidth: '60%',
    textAlign: 'right',
  },
});

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: COLORS.bgPassenger,
  },
  header: { marginBottom: 32, gap: 8 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { fontSize: 15, color: COLORS.bluePrimary, fontWeight: '600' },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink900,
    lineHeight: 36,
  },
  subtitle: { fontSize: 15, color: COLORS.ink500 },
  form: { gap: 20 },
  input: {
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.ink900,
  },
  inputError: { borderColor: COLORS.danger },
  formError: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: { fontSize: 14, color: COLORS.ink500 },
  link: { fontSize: 14, fontWeight: '600', color: COLORS.bluePrimary },
  sectionHint: {
    fontSize: 14,
    color: COLORS.ink500,
    lineHeight: 20,
  },
  typeCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.borderSubtle,
    padding: 16,
    gap: 4,
  },
  typeCardSelected: {
    borderColor: COLORS.bluePrimary,
    backgroundColor: COLORS.blueTint,
  },
  typeLabel: { fontSize: 16, fontWeight: '700', color: COLORS.ink900 },
  typeLabelSelected: { color: COLORS.bluePrimary },
  typeDesc: { fontSize: 13, color: COLORS.ink500 },
  reviewCard: {
    backgroundColor: COLORS.surfaceCard,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
});
