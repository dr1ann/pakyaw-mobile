import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, shadow } from '@/constants/theme';
import { SymbolIcon } from '@/components/ui/SymbolIcon';

export type RecenterButtonProps = {
  readonly visible: boolean;
  readonly onPress: () => void;
};

export function RecenterButton({ visible, onPress }: RecenterButtonProps) {
  if (!visible) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
      testID="recenter-button"
    >
      <SymbolIcon name="navigation" size={16} tintColor={colors.ink[900]} />
      <Text style={styles.text}>Re-center</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 300, // positioned nicely above the driver sheets
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...shadow.float,
    zIndex: 1000,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink[900],
    marginLeft: 8,
  },
});
