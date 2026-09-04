import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, spacing } from '@/constants/theme';

export type CardElevation = 'none' | 'card' | 'float';
export type CardRadius = 'sm' | 'md' | 'lg';
export type CardVariant = 'default' | 'muted' | 'outlined';

export type CardProps = ViewProps & {
  elevation?: CardElevation;
  rounded?: CardRadius;
  variant?: CardVariant;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  elevation = 'card',
  rounded = 'md',
  variant = 'default',
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'muted' && styles.variantMuted,
        variant === 'outlined' && styles.variantOutlined,
        rounded === 'sm' && styles.roundedSm,
        rounded === 'md' && styles.roundedMd,
        rounded === 'lg' && styles.roundedLg,
        padded && styles.padded,
        elevation === 'card' && shadow.card,
        elevation === 'float' && shadow.float,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface.card,
  },
  variantMuted: {
    backgroundColor: colors.surface.muted,
  },
  variantOutlined: {
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roundedSm: {
    borderRadius: radius.sm,
  },
  roundedMd: {
    borderRadius: radius.md,
  },
  roundedLg: {
    borderRadius: radius.lg,
  },
  padded: {
    padding: spacing[4],
  },
});
