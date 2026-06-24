import { type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/constants/theme';

export type ScreenBackground = 'card' | 'muted' | 'passenger' | 'light';

export type ScreenProps = {
  children: ReactNode;
  background?: ScreenBackground;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'style'>;
};

const BACKGROUNDS: Record<ScreenBackground, string> = {
  card: colors.surface.card,
  muted: colors.surface.muted,
  passenger: colors.surface.bgPassenger,
  light: colors.surface.bgLight,
};

export function Screen({
  children,
  background = 'light',
  scroll = false,
  padded = true,
  edges = ['top', 'left', 'right'],
  style,
  contentContainerStyle,
  scrollProps,
}: ScreenProps) {
  const bg = BACKGROUNDS[background];

  const contentStyles = [padded && styles.padded, contentContainerStyle];

  if (scroll) {
    return (
      <SafeAreaView
        edges={edges}
        style={[styles.root, { backgroundColor: bg }, style]}
      >
        <ScrollView
          contentContainerStyle={contentStyles}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: bg }, style]}
    >
      <View style={[styles.flex, contentStyles]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
});
