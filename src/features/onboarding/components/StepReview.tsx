import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import {
  requirementAppliesToVehicle,
  type DocumentState,
  type DriverDocumentMetadata,
  type DriverOnboardingCatalog,
} from '@pakyaw/shared/onboarding';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { DriverApplicationForm } from '../types';

type StepReviewProps = {
  readonly form: DriverApplicationForm;
  readonly catalog: DriverOnboardingCatalog | null;
  readonly documents: Readonly<Record<string, DocumentState | 'missing'>>;
  readonly documentMetadata: Readonly<Record<string, DriverDocumentMetadata>>;
  readonly onEditStep: (stepNumber: number) => void;
  readonly onSubmit: () => Promise<void>;
  readonly isSubmitting?: boolean;
  readonly submitError?: string | null;
  readonly isReadOnly?: boolean;
};

function maskMobile(mobile: string): string {
  if (!mobile) return '—';
  const clean = mobile.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+63') && clean.length >= 12) {
    return `${clean.slice(0, 6)} ••• ${clean.slice(-4)}`;
  }
  if (clean.startsWith('09') && clean.length >= 11) {
    return `${clean.slice(0, 4)} ••• ${clean.slice(-4)}`;
  }
  return clean;
}

export function StepReview({
  form,
  catalog,
  documents,
  documentMetadata,
  onEditStep,
  onSubmit,
  isSubmitting = false,
  submitError,
  isReadOnly = false,
}: StepReviewProps) {
  const { personalDetails, vehicle } = form;

  const selectedVehicleType = useMemo(() => {
    return catalog?.vehicleTypes.find((vt) => vt.id === vehicle.vehicleTypeId) ?? null;
  }, [catalog, vehicle.vehicleTypeId]);

  const applicableRequirements = useMemo(() => {
    if (!catalog?.documentRequirements) return [];
    return catalog.documentRequirements
      .filter((req) => req.active && req.requiredForApplication)
      .filter((req) => requirementAppliesToVehicle(req, vehicle.vehicleTypeId))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }, [catalog, vehicle.vehicleTypeId]);

  const missingRequirements = useMemo(() => {
    return applicableRequirements.filter((req) => {
      const state = documents[req.key];
      const isDocUploaded = state === 'uploaded' || state === 'approved';
      const meta = documentMetadata[req.key] || {};
      const hasId = !req.requiresIdentification || Boolean(meta.identificationNumber?.trim());
      const hasIssuance = !req.requiresIssuanceDate || Boolean(meta.issuanceDate?.trim());
      const hasExpiry = !req.requiresExpiryDate || Boolean(meta.expiryDate?.trim());
      return !isDocUploaded || !hasId || !hasIssuance || !hasExpiry;
    });
  }, [applicableRequirements, documents, documentMetadata]);

  const isPersonalValid =
    personalDetails.fullLegalName.trim().length >= 2 &&
    personalDetails.barangayAddress.trim().length >= 3 &&
    personalDetails.emergencyContact.name.trim().length >= 2 &&
    personalDetails.emergencyContact.mobile.trim().length >= 7;

  const isVehicleValid =
    Boolean(selectedVehicleType) &&
    vehicle.plateNumber.trim().length >= 3 &&
    vehicle.unitBodyNumber.trim().length >= 1 &&
    (vehicle.isDriverOwner || vehicle.ownerOperatorInfo.trim().length >= 2);

  const isRequirementsValid = missingRequirements.length === 0;

  const canSubmit = isPersonalValid && isVehicleValid && isRequirementsValid;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Review your application</Text>
        <Text style={styles.subtitle}>
          Make sure everything is correct before sending it to Pakyaw Operations.
        </Text>
      </View>

      {/* Section 1: Your Details */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionLabel}>Your details</Text>
          <Pressable
            onPress={() => onEditStep(2)}
            hitSlop={8}
            accessibilityRole="button"
            disabled={isReadOnly}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.primaryText}>{personalDetails.fullLegalName || '—'}</Text>
          <Text style={styles.secondaryText}>{maskMobile(personalDetails.verifiedMobile)}</Text>
          <Text style={styles.secondaryText}>{personalDetails.barangayAddress || '—'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.subheadText}>Emergency contact</Text>
          <Text style={styles.secondaryText}>
            {personalDetails.emergencyContact.name || '—'} ({maskMobile(personalDetails.emergencyContact.mobile)})
          </Text>
        </View>
      </View>

      {/* Section 2: Vehicle */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionLabel}>Vehicle</Text>
          <Pressable
            onPress={() => onEditStep(3)}
            hitSlop={8}
            accessibilityRole="button"
            disabled={isReadOnly}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.primaryText}>{selectedVehicleType?.type || 'No vehicle type selected'}</Text>
          <Text style={styles.secondaryText}>Plate: {vehicle.plateNumber || '—'}</Text>
          <Text style={styles.secondaryText}>Body number: {vehicle.unitBodyNumber || '—'}</Text>
          <Text style={styles.secondaryText}>
            Capacity: {selectedVehicleType ? `${selectedVehicleType.capacity} passengers` : '—'}
          </Text>
          <Text style={styles.secondaryText}>
            Ownership:{' '}
            {vehicle.isDriverOwner
              ? 'Driver is registered owner'
              : `Operator: ${vehicle.ownerOperatorInfo || '—'}`}
          </Text>
        </View>
      </View>

      {/* Section 3: Requirements */}
      <View style={styles.reviewCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionLabel}>Requirements</Text>
          <Pressable
            onPress={() => onEditStep(4)}
            hitSlop={8}
            accessibilityRole="button"
            disabled={isReadOnly}
          >
            <Text style={styles.editText}>{missingRequirements.length > 0 ? 'Complete' : 'Edit'}</Text>
          </Pressable>
        </View>

        <View style={styles.requirementsList}>
          {applicableRequirements.map((req) => {
            const isMissing = missingRequirements.some((m) => m.key === req.key);
            return (
              <View key={req.key} style={styles.reqRow}>
                <Text style={isMissing ? styles.reqIconWarn : styles.reqIconOk}>
                  {isMissing ? '!' : '✓'}
                </Text>
                <View style={styles.reqTextCol}>
                  <Text style={[styles.reqName, isMissing && styles.reqNameWarn]}>
                    {req.label}
                  </Text>
                  {isMissing ? (
                    <Text style={styles.reqMissingHint}>Add the details or upload the document</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {missingRequirements.length > 0 ? (
          <View style={styles.missingAlertBox}>
            <Text style={styles.missingAlertTitle}>
              Missing {missingRequirements.length} required document{missingRequirements.length > 1 ? 's' : ''}:
            </Text>
            {missingRequirements.map((req) => (
              <Text key={req.key} style={styles.missingAlertItem}>
                • {req.label}
              </Text>
            ))}
            <Pressable
              style={styles.completeBtn}
              onPress={() => onEditStep(4)}
              accessibilityRole="button"
            >
              <Text style={styles.completeBtnText}>Complete missing documents</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {submitError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{submitError}</Text>
        </View>
      ) : null}

      {/* Primary Submit Button */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.submitButton, (!canSubmit || isSubmitting || isReadOnly) && styles.submitButtonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit || isSubmitting || isReadOnly}
          accessibilityRole="button"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit application</Text>
          )}
        </Pressable>
        {!canSubmit && !isReadOnly ? (
          <Text style={styles.disabledExplanation}>
            {!isPersonalValid
              ? 'Complete your address and emergency contact in step 2.'
              : !isVehicleValid
              ? 'Add your vehicle details in step 3.'
              : 'Upload all required documents before you submit.'}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[8],
  },
  header: {
    gap: spacing[1],
  },
  title: {
    fontSize: typography.size.h2,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.bodySmall,
  },
  reviewCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[2],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  editText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  infoRow: {
    gap: 3,
  },
  primaryText: {
    fontSize: typography.size.bodyMd,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  secondaryText: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.regular,
    color: colors.ink[700],
    lineHeight: typography.lineHeight.bodySmall,
  },
  subheadText: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.semibold,
    color: colors.ink[500],
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
  },
  requirementsList: {
    gap: spacing[2],
  },
  reqRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reqIconOk: {
    color: colors.green.primary,
    fontSize: 16,
    fontFamily: typography.family.bold,
    width: 20,
    textAlign: 'center',
  },
  reqIconWarn: {
    color: colors.amber.deep,
    fontSize: 16,
    fontFamily: typography.family.bold,
    width: 20,
    textAlign: 'center',
  },
  reqTextCol: {
    flex: 1,
  },
  reqName: {
    fontSize: typography.size.bodySmall,
    fontFamily: typography.family.medium,
    color: colors.ink[900],
  },
  reqNameWarn: {
    color: colors.amber.deep,
    fontFamily: typography.family.semibold,
  },
  reqMissingHint: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.regular,
    color: colors.amber.deep,
  },
  missingAlertBox: {
    backgroundColor: colors.amber.tint,
    borderRadius: radius.sm,
    padding: spacing[3],
    marginTop: spacing[2],
    gap: 4,
    borderWidth: 1,
    borderColor: '#F8D29D',
  },
  missingAlertTitle: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.bold,
    color: colors.amber.deep,
  },
  missingAlertItem: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
    marginLeft: 4,
  },
  completeBtn: {
    marginTop: 6,
    backgroundColor: colors.amber.deep,
    borderRadius: radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  completeBtnText: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: colors.dangerSubtle,
    borderRadius: radius.sm,
    padding: spacing[3],
  },
  errorText: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.medium,
    color: colors.danger,
    lineHeight: typography.lineHeight.caption,
  },
  footer: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  submitButton: {
    backgroundColor: colors.green.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: typography.size.button,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
  disabledExplanation: {
    fontSize: typography.size.caption,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.caption,
  },
});
