import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing, typography } from '@/constants/theme';

export type InputProps = TextInputProps & {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  error?: boolean;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

export function Input({
  leftIcon,
  rightIcon,
  error = false,
  disabled = false,
  containerStyle,
  inputStyle,
  placeholderTextColor = colors.ink[400],
  onFocus,
  onBlur,
  editable,
  ...rest
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isEditable = editable !== false && !disabled;

  return (
    <View
      style={[
        styles.container,
        isFocused && styles.focused,
        error && styles.error,
        !isEditable && styles.disabled,
        containerStyle,
      ]}
    >
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <TextInput
        style={[styles.input, !isEditable && styles.inputDisabled, inputStyle]}
        placeholderTextColor={placeholderTextColor}
        editable={isEditable}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
      {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
  },
  focused: {
    borderColor: colors.blue.primary,
  },
  error: {
    borderColor: colors.danger,
  },
  disabled: {
    backgroundColor: colors.surface.muted,
    borderColor: colors.border.subtle,
  },
  leftIcon: {
    marginRight: spacing[2],
  },
  rightIcon: {
    marginLeft: spacing[2],
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontSize: typography.size.body,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
    paddingVertical: spacing[3],
  },
  inputDisabled: {
    color: colors.ink[400],
  },
});
