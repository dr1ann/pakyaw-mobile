import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';

import {
  driverSignInSchema,
  type DriverSignInFields,
} from '@pakyaw/shared/features/auth/validation/schemas';
import { useDriverSignIn } from '@/features/auth/hooks/useDriverSignIn';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Field } from '@pakyaw/shared/components/ui/Field';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';

export function DriverSignInForm() {
  const { signInMutation } = useDriverSignIn();

  const form = useForm<DriverSignInFields>({
    resolver: zodResolver(driverSignInSchema),
    mode: 'onChange',
  });

  const email = useWatch({ control: form.control, name: 'email', defaultValue: '' });
  const password = useWatch({ control: form.control, name: 'password', defaultValue: '' });

  const errorMessage =
    signInMutation.error instanceof Error ? signInMutation.error.message : null;

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
          <StatusPill label="Driver" tone="success" />
          <Text style={styles.title}>Driver sign-in</Text>
          <Text style={styles.subtitle}>
            Enter your credentials to access your driver account.
          </Text>
        </View>

        <View style={styles.form}>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <TextInput
              style={[styles.input, form.formState.errors.email ? styles.inputError : null]}
              placeholder="you@example.com"
              placeholderTextColor={colors.ink[400]}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              onChangeText={(t) => form.setValue('email', t, { shouldValidate: true })}
              value={email}
              testID="driver-signin-email-input"
            />
          </Field>

          <Field label="Password" error={form.formState.errors.password?.message}>
            <TextInput
              style={[styles.input, form.formState.errors.password ? styles.inputError : null]}
              placeholder="Password"
              placeholderTextColor={colors.ink[400]}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              onChangeText={(t) => form.setValue('password', t, { shouldValidate: true })}
              value={password}
              testID="driver-signin-password-input"
            />
          </Field>

          {errorMessage ? (
            <Text style={styles.formError} accessibilityRole="alert">
              {errorMessage}
            </Text>
          ) : null}

          <Button
            label="Sign in"
            onPress={form.handleSubmit((values) => signInMutation.mutate(values))}
            disabled={!form.formState.isValid}
            loading={signInMutation.isPending}
            testID="driver-signin-submit"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[15],
    paddingBottom: spacing[10],
    backgroundColor: colors.surface.bgLight,
  },
  header: { marginBottom: spacing[8], gap: spacing[2], alignItems: 'flex-start' },
  title: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.bodySmall,
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
  linkText: { fontSize: typography.size.bodySmall, color: colors.ink[500] },
  link: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.blue.primary,
  },
});
