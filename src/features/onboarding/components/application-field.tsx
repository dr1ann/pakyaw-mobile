import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { FieldHelpDialog } from '@/features/onboarding/components/field-help-dialog';

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
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}{optional ? <Text style={styles.optional}> (Optional)</Text> : null}</Text>
        {help ? <FieldHelpButton title={label} message={help} /> : null}
      </View>
      {children}
      {errors.map((error) => <Text key={error} style={styles.error}>{error}</Text>)}
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

export function OnboardingTextField({ label, required, optional, help, errors, style, placeholderTextColor = '#6B7689', ...inputProps }: OnboardingTextFieldProps) {
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
        hitSlop={4}
      >
        <Text style={styles.helpMark}>?</Text>
      </Pressable>
      <FieldHelpDialog visible={visible} title={title} message={message} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  label: { color: '#364152', fontWeight: '700', flexShrink: 1 },
  required: { color: '#B42318' },
  optional: { color: '#6B7689', fontWeight: '500' },
  input: { backgroundColor: '#F4F7FB', borderWidth: 1, borderColor: '#E6EBF2', borderRadius: 9, minHeight: 46, paddingHorizontal: 12, color: '#0E1726', fontSize: 16 },
  helpButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  helpMark: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', lineHeight: 22, color: '#0B2E6B', backgroundColor: '#E8F1FE', fontWeight: '800' },
  error: { color: '#B42318', fontSize: 12, lineHeight: 17 },
});
