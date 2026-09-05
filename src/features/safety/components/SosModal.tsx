import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { formatUserFriendlyError } from '@pakyaw/shared/lib/userError';
import { createTripIncident } from '../services/incident.service';

export type EmergencyCategory =
  | 'accident'
  | 'medical'
  | 'threat'
  | 'danger'
  | 'other';

const EMERGENCY_CATEGORIES: readonly { id: EmergencyCategory; label: string; icon: string }[] = [
  { id: 'danger', label: 'Immediate danger', icon: 'exclamationmark.shield.fill' },
  { id: 'threat', label: 'Unsafe / threatening behavior', icon: 'person.crop.circle.badge.exclamationmark' },
  { id: 'accident', label: 'Accident', icon: 'car.fill' },
  { id: 'medical', label: 'Medical emergency', icon: 'cross.case.fill' },
  { id: 'other', label: 'Other emergency', icon: 'bell.fill' },
];

interface SosModalProps {
  readonly visible: boolean;
  readonly tripId: string;
  readonly userId: string;
  readonly onClose: () => void;
}

export function SosModal({ visible, tripId, userId, onClose }: SosModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<EmergencyCategory>('danger');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSendEmergencyAlert() {
    setIsSubmitting(true);
    try {
      let location = { latitude: 11.005, longitude: 124.6075 }; // Default Ormoc City coordinates fallback
      try {
        const currentPermission = await Location.getForegroundPermissionsAsync();
        const permission = currentPermission.status === 'granted'
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch {
        // Continue with trip context even if GPS lookup fails
      }

      await createTripIncident(
        tripId,
        userId,
        location,
        selectedCategory,
        note.trim() || undefined
      );

      Alert.alert(
        'Emergency Alert Sent',
        'Pakyaw Operations has received your alert with your trip and vehicle context.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (err) {
      Alert.alert(
        'Unable to send SOS',
        formatUserFriendlyError(err, 'Failed to send alert. Please call emergency services if you are in immediate danger.')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard} testID="sos-modal">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <SymbolIcon name="exclamationmark.triangle.fill" size={20} tintColor={colors.white} />
              </View>
              <View>
                <Text style={styles.title}>Emergency SOS</Text>
                <Text style={styles.subtitle}>Active Trip Security Alert</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close emergency modal">
              <SymbolIcon name="xmark" size={16} tintColor={colors.ink[500]} />
            </Pressable>
          </View>

          {/* Prompt */}
          <Text style={styles.sectionLabel}>What is happening?</Text>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            {EMERGENCY_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[styles.categoryItem, isSelected && styles.categoryItemSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <SymbolIcon
                    name={cat.icon}
                    size={16}
                    tintColor={isSelected ? colors.danger : colors.ink[500]}
                  />
                  <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                    {cat.label}
                  </Text>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <SymbolIcon name="checkmark" size={10} tintColor={colors.white} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Optional Note */}
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Optional note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. details, specific location indicator..."
              placeholderTextColor={colors.ink[400]}
              maxLength={300}
              style={styles.noteInput}
            />
          </View>

          {/* Action Button */}
          <Button
            label={isSubmitting ? 'Sending Alert...' : 'Send Emergency Alert'}
            onPress={() => void handleSendEmergencyAlert()}
            loading={isSubmitting}
            style={styles.submitBtn}
            testID="send-sos-alert-btn"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing[5],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
  },
  closeBtn: {
    padding: spacing[2],
  },
  sectionLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  categoriesContainer: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surface.muted,
    backgroundColor: colors.surface.card,
    gap: spacing[3],
  },
  categoryItemSelected: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(235, 87, 87, 0.08)',
  },
  categoryLabel: {
    flex: 1,
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
  },
  categoryLabelSelected: {
    fontWeight: typography.weight.bold,
    color: colors.danger,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteSection: {
    marginBottom: spacing[5],
  },
  noteLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.medium,
    color: colors.ink[500],
    marginBottom: spacing[1],
  },
  noteInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    backgroundColor: colors.white,
  },
  submitBtn: {
    backgroundColor: colors.danger,
  },
});
