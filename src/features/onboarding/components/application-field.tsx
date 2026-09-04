import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { FieldHelpDialog } from '@/features/onboarding/components/field-help-dialog';
import { colors, radius, spacing, typography } from '@/constants/theme';

type FormFieldProps = {
  readonly label: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly help?: string;
  readonly errors?: readonly string[];
  readonly children: ReactNode;
};

export function FormField({ label, required = false, optional = false, help, errors = [], children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
          {optional ? <Text style={styles.optional}> (Optional)</Text> : null}
        </Text>
        {help ? <FieldHelpButton title={label} message={help} /> : null}
      </View>
      {children}
      {errors.map((error) => (
        <Text key={error} style={styles.error}>
          {error}
        </Text>
      ))}
    </View>
  );
}

type OnboardingTextFieldProps = TextInputProps & {
  readonly label: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly help?: string;
  readonly errors?: readonly string[];
};

export function OnboardingTextField({
  label,
  required,
  optional,
  help,
  errors,
  style,
  placeholderTextColor = colors.ink[400],
  ...inputProps
}: OnboardingTextFieldProps) {
  return (
    <FormField label={label} required={required} optional={optional} help={help} errors={errors}>
      <TextInput
        {...inputProps}
        style={[styles.input, style]}
        accessibilityLabel={label}
        placeholderTextColor={placeholderTextColor}
      />
    </FormField>
  );
}

export function FieldHelpButton({ title, message }: { readonly title: string; readonly message: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Pressable
        style={styles.helpButton}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Help for ${title}`}
        accessibilityHint="Opens guidance for this field"
        hitSlop={8}
      >
        <Text style={styles.helpMark}>?</Text>
      </Pressable>
      <FieldHelpDialog visible={visible} title={title} message={message} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing[1],
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  label: {
    color: colors.ink[700],
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.semibold,
    flexShrink: 1,
  },
  required: {
    color: colors.danger,
    fontFamily: typography.family.bold,
  },
  optional: {
    color: colors.ink[400],
    fontFamily: typography.family.regular,
    fontSize: typography.size.caption,
  },
  input: {
    backgroundColor: colors.surface.muted,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.sm,
    minHeight: 48,
    paddingHorizontal: spacing[3],
    color: colors.ink[900],
    fontSize: typography.size.body,
    fontFamily: typography.family.medium,
  },
  helpButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpMark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 20,
    color: colors.blue.primary,
    backgroundColor: colors.blue.tint,
    fontFamily: typography.family.bold,
    fontSize: 12,
  },
  error: {
    color: colors.danger,
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    lineHeight: typography.lineHeight.caption,
  },
});
