import React from 'react';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { MapActionButton } from '@pakyaw/shared/components/ui/MapActionButton';

export type RecenterButtonProps = {
  readonly visible: boolean;
  readonly onPress: () => void;
};

export function RecenterButton({ visible, onPress }: RecenterButtonProps) {
  if (!visible) return null;

  return (
    <MapActionButton
      icon={<SymbolIcon name="navigation" size={16} tintColor={colors.ink[900]} />}
      label="Re-center"
      onPress={onPress}
      accessibilityLabel="Re-center map"
      accessibilityRole="button"
      testID="recenter-button"
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
});
