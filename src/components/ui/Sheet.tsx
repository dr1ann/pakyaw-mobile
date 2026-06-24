import { type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, spacing } from '@/constants/theme';

export type SheetProps = {
  visible: boolean;
  onClose?: () => void;
  children: ReactNode;
  dismissOnBackdropPress?: boolean;
  rounded?: 'lg' | 'md';
  padded?: boolean;
  showHandle?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  modal?: boolean;
};

export function Sheet({
  visible,
  onClose,
  children,
  dismissOnBackdropPress = true,
  rounded = 'lg',
  padded = true,
  showHandle = true,
  style,
  contentStyle,
  modal = true,
}: SheetProps) {
  if (!visible) return null;

  const content = (
    <View style={[styles.root, style, !modal && StyleSheet.absoluteFill]}>
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdropPress ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel="Close sheet"
      />
      <View
        style={[
          styles.sheet,
          rounded === 'lg' ? styles.roundedLg : styles.roundedMd,
          padded && styles.padded,
          shadow.float,
          contentStyle,
        ]}
      >
        {showHandle ? (
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );

  if (modal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {content}
      </Modal>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 23, 38, 0.5)',
  },
  sheet: {
    backgroundColor: colors.surface.card,
    paddingBottom: spacing[8],
  },
  roundedMd: {
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  roundedLg: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  padded: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  handleWrap: {
    alignItems: 'center',
    paddingBottom: spacing[3],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border.subtle,
  },
});
