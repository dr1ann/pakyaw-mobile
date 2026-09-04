import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { BookingRideSelection } from '../types';

type OnboardingModalProps = {
  readonly mode: BookingRideSelection;
  readonly isVisible: boolean;
  readonly onClose: () => void;
};

const MODE_CONTENT = {
  private: {
    title: 'Pakyaw Private',
    icon: 'car.fill',
    color: colors.blue.primary,
    steps: [
      'Book the whole tricycle for yourself and your group.',
      'Go directly to your destination.',
      'Pay for the full capacity of the tricycle (min 4 seats).',
    ],
  },
  shared: {
    title: 'Shared Ride',
    icon: 'person.2.fill',
    color: colors.green.primary,
    steps: [
      'Cover 1 to 3 seats depending on your group size.',
      'Pay per seat + a small pickup fee.',
      'Remaining seats stay open for others along your route to hop on.',
    ],
  },
  hopon: {
    title: 'Hop-On Radar',
    icon: 'antenna.radiowaves.left.and.right',
    color: colors.amber.primary,
    steps: [
      'See nearby shared rides heading your way.',
      'Tap to join an active ride instantly.',
      'Save money by sharing the ride with others!',
    ],
  },
};

export function OnboardingModal({ mode, isVisible, onClose }: OnboardingModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    async function checkSeen() {
      if (!isVisible) {
        setShow(false);
        return;
      }
      const key = `onboarding_seen_${mode}`;
      const seen = await AsyncStorage.getItem(key);
      if (!seen) {
        setShow(true);
        await AsyncStorage.setItem(key, 'true');
      } else {
        setShow(false);
        onClose(); // Automatically close if already seen
      }
    }
    checkSeen();
  }, [isVisible, mode, onClose]);

  if (!show) return null;

  const content = MODE_CONTENT[mode];

  return (
    <Modal
      visible={show}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, shadow.float]}>
          <View style={[styles.iconContainer, { backgroundColor: content.color + '20' }]}>
            <SymbolIcon name={content.icon} size={32} tintColor={content.color} />
          </View>
          
          <Text style={styles.title}>{content.title}</Text>
          
          <View style={styles.stepsContainer}>
            {content.steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={[styles.stepDot, { backgroundColor: content.color }]} />
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          <Button label="Got it" onPress={onClose} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[6],
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    gap: spacing[4],
    marginBottom: spacing[6],
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  stepText: {
    flex: 1,
    fontSize: typography.size.body,
    color: colors.ink[700],
    lineHeight: 22,
  },
  button: {
    width: '100%',
  },
});
