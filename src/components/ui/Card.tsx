import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, spacing } from '@/constants/theme';

type CardElevation = 'none' | 'card' | 'float';
type CardRadius = 'md' | 'lg';

export type CardProps = ViewProps & {
  elevation?: CardElevation;
  rounded?: CardRadius;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  elevation = 'card',
  rounded = 'md',
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        rounded === 'lg' ? styles.roundedLg : styles.roundedMd,
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
