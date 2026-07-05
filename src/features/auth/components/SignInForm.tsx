/**
 * SignInForm.tsx
 *
 * Passenger sign-in — email + password.
 * Domain errors are shown inline. Raw Firebase codes never appear.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useSignIn } from '@/features/auth/hooks/useSignIn';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Field } from '@pakyaw/shared/components/ui/Field';
import {
  signInSchema,
  type SignInFields,
} from '@pakyaw/shared/features/auth/validation/schemas';

export function SignInForm() {
  const signIn = useSignIn();

  const {
    formState: { errors, isValid },
    handleSubmit,
    setValue,
    control,
  } = useForm<SignInFields>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
  });

  const emailValue = useWatch({ control, name: 'email', defaultValue: '' });
  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  const errorMessage =
    signIn.error instanceof Error ? signIn.error.message : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>
            Sign in to your{' '}
            <Text style={styles.brand}>Pakyaw</Text> account.
          </Text>
        </View>

        <View style={styles.form}>
          <Field label="Email" error={errors.email?.message}>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink[400]}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              onChangeText={(t) => setValue('email', t, { shouldValidate: true })}
              value={emailValue}
              testID="signin-email-input"
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="Your password"
              placeholderTextColor={colors.ink[400]}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onChangeText={(t) => setValue('password', t, { shouldValidate: true })}
              value={passwordValue}
              testID="signin-password-input"
            />
          </Field>

          {errorMessage ? (
            <Text style={styles.formError} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}

          <Button
            label="Sign in"
            onPress={handleSubmit((values) => signIn.mutate(values))}
            disabled={!isValid}
            loading={signIn.isPending}
            testID="signin-submit"
          />

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{"Don't have an account? "}</Text>
            <Link href="/sign-up" style={styles.link}>
              Sign up
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[20],
    paddingBottom: spacing[10],
    backgroundColor: colors.surface.bgPassenger,
  },
  header: { marginBottom: spacing[10], gap: spacing[2] },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.body,
  },
  brand: {
    color: colors.blue.primary,
    fontWeight: typography.weight.bold,
  },
  form: { gap: spacing[5] },
  input: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: 14,
    fontSize: typography.size.bodyMd,
    color: colors.ink[900],
  },
  inputError: { borderColor: colors.danger },
  formError: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  link: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
});
