import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, typography, shadow } from '@/constants/theme';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import type { PublicTransportConfig } from '@pakyaw/shared/transport/contract';
import { DEFAULT_PUBLIC_TRANSPORT_CONFIG } from '@pakyaw/shared/transport/contract';
import type { BookingRideSelection } from '../types';

type OnboardingModalProps = {
  readonly mode: BookingRideSelection;
  readonly isVisible: boolean;
  readonly onClose: () => void;
  readonly config?: PublicTransportConfig;
};

export function OnboardingModal({ mode, isVisible, onClose, config = DEFAULT_PUBLIC_TRANSPORT_CONFIG }: OnboardingModalProps) {
  if (!isVisible) return null;

  const soloMax = config.modes.solo.maxPassengers || config.vehicleCapacity || 6;
  const soloMinBilled = config.modes.solo.minimumBilledSeats || 6;
  const sharedMax = config.modes.shared.maxSeatsPerBooking || 3;

  const modeContent = {
    private: {
      title: 'Pakyaw',
      badge: 'Private Trip',
      icon: 'car.fill',
      color: colors.blue.primary,
      description: 'Book the entire tricycle for a private trip directly to your destination.',
      points: [
        'Private ride for you and your companions.',
        'Direct route with no extra passenger pickups.',
        `Reserves all ${soloMinBilled} vehicle seats; choose 1–${soloMax} actual riders.`,
      ],
    },
    shared: {
      title: 'Shared',
      badge: 'Shared Trip',
      icon: 'person.2.fill',
      color: colors.green.primary,
      description: 'Book individual seats on a shared route with other passengers.',
      points: [
        `Select 1 to ${sharedMax} seats for your ride.`,
        'Pay per seat based on your route distance.',
        'Other passengers along your route corridor may share the ride.',
      ],
    },
  };

  const content = modeContent[mode];

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close modal" />
        <View style={[styles.card, shadow.float]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.blue.tint }]}>
            <SymbolIcon name={content.icon} size={28} tintColor={content.color} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>{content.title}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{content.badge}</Text>
            </View>
          </View>

          <Text style={styles.description}>{content.description}</Text>

          <View style={styles.pointsContainer}>
            {content.points.map((point, index) => (
              <View key={index} style={styles.pointRow}>
                <View style={[styles.pointDot, { backgroundColor: content.color }]} />
                <Text style={styles.pointText}>{point}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    padding: spacing[6],
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  badge: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
  },
  description: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing[4],
  },
  pointsContainer: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[5],
    backgroundColor: colors.surface.muted,
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  pointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  pointText: {
    flex: 1,
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    lineHeight: 18,
  },
  button: {
    width: '100%',
  },
});
