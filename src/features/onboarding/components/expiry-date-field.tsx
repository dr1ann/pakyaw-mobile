import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FormField } from '@/features/onboarding/components/application-field';
import { dateFromDateOnly, formatDateOnly, formatReadableDate } from '@/features/onboarding/input-validation';

type ExpiryDateFieldProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly editable: boolean;
  readonly help: string;
  readonly errors?: readonly string[];
};

export function ExpiryDateField({ label, value, onChange, editable, help, errors }: ExpiryDateFieldProps) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const selectedDate = dateFromDateOnly(value) ?? new Date();

  return (
    <FormField label={label} required help={help} errors={errors}>
      <Pressable
        style={[styles.input, !editable && styles.disabled]}
        onPress={() => setPickerVisible(true)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens a native date picker"
      >
        <Text style={[styles.value, !value && styles.placeholder]}>{formatReadableDate(value)}</Text>
        <Text style={styles.format}>YYYY-MM-DD</Text>
      </Pressable>
      {pickerVisible ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(_event, nextDate) => {
            setPickerVisible(false);
            if (nextDate) onChange(formatDateOnly(nextDate));
          }}
        />
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  input: { backgroundColor: '#F4F7FB', borderWidth: 1, borderColor: '#E6EBF2', borderRadius: 9, minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  value: { color: '#0E1726', fontSize: 16, flexShrink: 1 },
  placeholder: { color: '#6B7689' },
  format: { color: '#6B7689', fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
