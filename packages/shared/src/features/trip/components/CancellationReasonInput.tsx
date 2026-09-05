import { Pressable, Text, View } from 'react-native';
import { colors, spacing, radius } from '@/constants/theme';
import { CANCELLATION_REASONS } from '../cancellationReasons';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  disabled?: boolean;
};

export function CancellationReasonInput({ value, onChangeText, disabled = false }: Props) {
  return (
    <View style={{ width: '100%', gap: spacing[2], marginVertical: spacing[3] }}>
      <Text style={{ color: colors.ink[700] }}>Why are you cancelling? Choose one.</Text>
      {CANCELLATION_REASONS.map(({ code, label }) => (
        <Pressable
          key={code}
          onPress={() => onChangeText(code)}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === code, disabled }}
          accessibilityLabel={label}
          testID={`cancel-reason-${code}`}
          style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
            borderWidth: 1, borderColor: value === code ? colors.blue.primary : colors.border.subtle,
            borderRadius: radius.md, padding: spacing[3], backgroundColor: colors.surface.card,
            opacity: disabled ? 0.5 : 1 }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2,
            borderColor: value === code ? colors.blue.primary : colors.ink[400],
            backgroundColor: value === code ? colors.blue.primary : 'transparent' }} />
          <Text style={{ color: colors.ink[900], flex: 1 }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
