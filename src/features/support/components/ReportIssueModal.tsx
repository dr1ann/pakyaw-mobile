import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { formatUserFriendlyError } from '@pakyaw/shared/lib/userError';
import {
  createSupportTicket,
  type PassengerCaseType,
} from '../services/support-ticket.service';

const CATEGORIES: readonly { id: PassengerCaseType; label: string; icon: string; subtitle?: string }[] = [
  { id: 'lost_item', label: 'I left an item in the vehicle', icon: 'bag.fill' },
  { id: 'ride_concern', label: 'Driver / ride concern', icon: 'car.fill' },
  { id: 'fare_concern', label: 'Fare concern', icon: 'creditcard.fill' },
  { id: 'safety_concern', label: 'Safety concern', icon: 'shield.fill', subtitle: 'Post-trip concern (use SOS during active trip)' },
  { id: 'other', label: 'Other', icon: 'questionmark.circle.fill' },
];

interface ReportIssueModalProps {
  readonly visible: boolean;
  readonly tripId: string;
  readonly pickupLabel?: string;
  readonly destinationLabel?: string;
  readonly onClose: () => void;
  readonly onSubmitted?: (ticketId: string) => void;
}

export function ReportIssueModal({
  visible,
  tripId,
  pickupLabel,
  destinationLabel,
  onClose,
  onSubmitted,
}: ReportIssueModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<PassengerCaseType>('lost_item');
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [rememberedLocation, setRememberedLocation] = useState('');
  const [generalSubject, setGeneralSubject] = useState('');
  const [generalBody, setGeneralBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCaseId, setSubmittedCaseId] = useState<string | null>(null);

  function resetForm() {
    setSelectedCategory('lost_item');
    setItemName('');
    setDescription('');
    setRememberedLocation('');
    setGeneralSubject('');
    setGeneralBody('');
    setSubmittedCaseId(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (selectedCategory === 'lost_item') {
      if (!itemName.trim()) {
        Alert.alert('Missing item name', 'Please specify what item you left.');
        return;
      }
      if (!description.trim()) {
        Alert.alert('Missing description', 'Please provide a short description of the item.');
        return;
      }
    } else {
      if (!generalSubject.trim() && selectedCategory === 'other') {
        Alert.alert('Missing subject', 'Please enter a brief subject for your report.');
        return;
      }
      if (!generalBody.trim()) {
        Alert.alert('Missing details', 'Please describe what happened.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const subject =
        selectedCategory === 'lost_item'
          ? `Lost Item: ${itemName.trim()}`
          : selectedCategory === 'safety_concern'
          ? `Safety Concern: ${tripId.slice(0, 8)}`
          : selectedCategory === 'fare_concern'
          ? `Fare Concern: ${tripId.slice(0, 8)}`
          : selectedCategory === 'ride_concern'
          ? `Ride Concern: ${tripId.slice(0, 8)}`
          : generalSubject.trim() || 'Trip Report';

      const body =
        selectedCategory === 'lost_item'
          ? `Item: ${itemName.trim()}\nDescription: ${description.trim()}\nRemembered location: ${rememberedLocation.trim() || 'Not specified'}`
          : generalBody.trim();

      const result = await createSupportTicket({
        category: selectedCategory,
        caseType: selectedCategory,
        priority: selectedCategory === 'safety_concern' ? 'high' : 'normal',
        subject,
        body,
        relatedTripId: tripId,
        lostItemDetails:
          selectedCategory === 'lost_item'
            ? {
                itemName: itemName.trim(),
                description: description.trim(),
                rememberedLocation: rememberedLocation.trim() || 'In vehicle',
              }
            : undefined,
      });

      setSubmittedCaseId(result.ticketId);
      onSubmitted?.(result.ticketId);
    } catch (err) {
      Alert.alert(
        'Submission Failed',
        formatUserFriendlyError(err, 'Unable to submit your report right now. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer} testID="report-issue-modal">
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {submittedCaseId ? 'Report Received' : 'Report an Issue'}
              </Text>
              {pickupLabel && destinationLabel && !submittedCaseId ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  Trip: {pickupLabel} → {destinationLabel}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close report modal">
              <SymbolIcon name="xmark" size={18} tintColor={colors.ink[500]} />
            </Pressable>
          </View>

          {submittedCaseId ? (
            /* Confirmation View */
            <View style={styles.confirmationContainer}>
              <View style={styles.successIconCircle}>
                <SymbolIcon name="checkmark" size={28} tintColor={colors.white} />
              </View>
              <Text style={styles.confirmationTitle}>Report Received</Text>
              <Text style={styles.confirmationMessage}>
                {selectedCategory === 'lost_item'
                  ? 'We have notified the Driver and Pakyaw Operations.'
                  : 'Our operations team has received your report and is reviewing the trip details.'}
              </Text>
              <View style={styles.referenceBox}>
                <Text style={styles.referenceLabel}>CASE REFERENCE</Text>
                <Text style={styles.referenceCode}>#CASE-{submittedCaseId.slice(0, 8).toUpperCase()}</Text>
              </View>
              <Button label="Done" onPress={handleClose} style={styles.doneBtn} testID="report-done-btn" />
            </View>
          ) : (
            /* Form View */
            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              {/* Category Selector */}
              <Text style={styles.sectionLabel}>Select what happened</Text>
              <View style={styles.categoriesList}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat.id)}
                      style={[styles.categoryOption, isSelected && styles.categoryOptionSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[styles.categoryIconWrap, isSelected && styles.categoryIconWrapSelected]}>
                        <SymbolIcon
                          name={cat.icon}
                          size={16}
                          tintColor={isSelected ? colors.blue.primary : colors.ink[500]}
                        />
                      </View>
                      <View style={styles.categoryTextWrap}>
                        <Text style={[styles.categoryText, isSelected && styles.categoryTextSelected]}>
                          {cat.label}
                        </Text>
                        {cat.subtitle && (
                          <Text style={styles.categorySubtext}>{cat.subtitle}</Text>
                        )}
                      </View>
                      {isSelected && (
                        <SymbolIcon name="checkmark.circle.fill" size={18} tintColor={colors.blue.primary} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Dynamic Inputs based on Category */}
              {selectedCategory === 'lost_item' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>What did you leave?</Text>
                  <TextInput
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="e.g. Umbrella, Wallet, Backpack"
                    placeholderTextColor={colors.ink[400]}
                    maxLength={80}
                    style={styles.textInput}
                    testID="lost-item-name-input"
                  />

                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="e.g. Black folding umbrella with wooden handle"
                    placeholderTextColor={colors.ink[400]}
                    maxLength={300}
                    multiline
                    numberOfLines={3}
                    style={[styles.textInput, styles.multilineInput]}
                    testID="lost-item-desc-input"
                  />

                  <Text style={styles.fieldLabel}>Where do you remember having it?</Text>
                  <TextInput
                    value={rememberedLocation}
                    onChangeText={setRememberedLocation}
                    placeholder="e.g. Back passenger seat, floor"
                    placeholderTextColor={colors.ink[400]}
                    maxLength={100}
                    style={styles.textInput}
                    testID="lost-item-location-input"
                  />
                </View>
              ) : (
                <View style={styles.fieldGroup}>
                  {selectedCategory === 'other' && (
                    <>
                      <Text style={styles.fieldLabel}>Subject</Text>
                      <TextInput
                        value={generalSubject}
                        onChangeText={setGeneralSubject}
                        placeholder="Brief summary of the issue"
                        placeholderTextColor={colors.ink[400]}
                        maxLength={100}
                        style={styles.textInput}
                      />
                    </>
                  )}

                  <Text style={styles.fieldLabel}>Tell us what happened</Text>
                  <TextInput
                    value={generalBody}
                    onChangeText={setGeneralBody}
                    placeholder="Provide relevant details so we can investigate..."
                    placeholderTextColor={colors.ink[400]}
                    maxLength={600}
                    multiline
                    numberOfLines={4}
                    style={[styles.textInput, styles.multilineInput]}
                    testID="general-issue-desc-input"
                  />
                </View>
              )}

              <Button
                label={isSubmitting ? 'Submitting Report...' : 'Submit Report'}
                onPress={() => void handleSubmit()}
                loading={isSubmitting}
                style={styles.submitBtn}
                testID="submit-report-btn"
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing[5],
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.muted,
    paddingBottom: spacing[3],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  closeBtn: {
    padding: spacing[1],
  },
  formScroll: {
    marginBottom: spacing[2],
  },
  sectionLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.bold,
    color: colors.ink[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
  categoriesList: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.muted,
    backgroundColor: colors.surface.card,
    gap: spacing[3],
  },
  categoryOptionSelected: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconWrapSelected: {
    backgroundColor: colors.white,
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
  },
  categoryTextSelected: {
    fontWeight: typography.weight.bold,
    color: colors.blue.primary,
  },
  categorySubtext: {
    fontSize: 10,
    color: colors.ink[500],
    marginTop: 1,
  },
  fieldGroup: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  fieldLabel: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.bodySmall,
    color: colors.ink[900],
    backgroundColor: colors.white,
    marginBottom: spacing[2],
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: colors.blue.primary,
    marginTop: spacing[2],
    marginBottom: spacing[4],
  },
  confirmationContainer: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    gap: spacing[3],
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.green.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  confirmationTitle: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  confirmationMessage: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
  referenceBox: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    alignItems: 'center',
    marginVertical: spacing[3],
  },
  referenceLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.ink[500],
    letterSpacing: 0.5,
  },
  referenceCode: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    fontFamily: 'monospace',
    marginTop: 2,
  },
  doneBtn: {
    backgroundColor: colors.blue.primary,
    width: '100%',
    marginTop: spacing[2],
  },
});
