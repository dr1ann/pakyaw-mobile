import { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import {
  requirementAppliesToVehicle,
  type DocumentState,
  type DriverDocumentMetadata,
  type DriverOnboardingCatalog,
} from '@pakyaw/shared/onboarding';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { RequirementCard } from './RequirementCard';
import type { PickedDriverDocument } from '../services/document-upload.service';

type StepRequirementsProps = {
  readonly catalog: DriverOnboardingCatalog | null;
  readonly isLoadingCatalog: boolean;
  readonly selectedVehicleTypeId: string;
  readonly documents: Readonly<Record<string, DocumentState | 'missing'>>;
  readonly documentMetadata: Readonly<Record<string, DriverDocumentMetadata>>;
  readonly onMetadataChange: (requirementKey: string, patch: Partial<DriverDocumentMetadata>) => void;
  readonly onUploadDocument: (requirementKey: string, asset: PickedDriverDocument) => Promise<void>;
  readonly uploadingKey?: string | null;
  readonly uploadProgress?: number;
  readonly correctionDocumentTypes?: readonly string[];
  readonly correctionReason?: string;
  readonly applicationStatus?: string;
  readonly onNext: () => void;
  readonly isReadOnly?: boolean;
};

export function StepRequirements({
  catalog,
  isLoadingCatalog,
  selectedVehicleTypeId,
  documents,
  documentMetadata,
  onMetadataChange,
  onUploadDocument,
  uploadingKey,
  uploadProgress = 0,
  correctionDocumentTypes = [],
  correctionReason,
  applicationStatus,
  onNext,
  isReadOnly = false,
}: StepRequirementsProps) {
  // Filter active and applicable requirements for this selected vehicle type
  const applicableRequirements = useMemo(() => {
    if (!catalog?.documentRequirements) return [];

    // Requirement lifecycle freeze: if already submitted, under review, or needs correction,
    // retain the submitted requirement keys rather than retroactively invalidating the application.
    const isSubmittedOrCorrection =
      applicationStatus === 'submitted' ||
      applicationStatus === 'under_review' ||
      applicationStatus === 'needs_correction' ||
      applicationStatus === 'approved';

    const existingDocKeys = Object.keys(documents);

    return catalog.documentRequirements
      .filter((req) => {
        if (isSubmittedOrCorrection && existingDocKeys.length > 0) {
          return existingDocKeys.includes(req.key);
        }
        return req.active && req.requiredForApplication && requirementAppliesToVehicle(req, selectedVehicleTypeId);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }, [catalog, selectedVehicleTypeId, applicationStatus, documents]);

  // Compute completed count
  const completedCount = useMemo(() => {
    return applicableRequirements.filter((req) => {
      const state = documents[req.key];
      const isDocUploaded = state === 'uploaded' || state === 'approved';
      const meta = documentMetadata[req.key] || {};
      const hasId = !req.requiresIdentification || Boolean(meta.identificationNumber?.trim());
      const hasIssuance = !req.requiresIssuanceDate || Boolean(meta.issuanceDate?.trim());
      const hasExpiry = !req.requiresExpiryDate || Boolean(meta.expiryDate?.trim());
      return isDocUploaded && hasId && hasIssuance && hasExpiry;
    }).length;
  }, [applicableRequirements, documents, documentMetadata]);

  const totalCount = applicableRequirements.length;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 1;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Required documents</Text>
        <Text style={styles.subtitle}>
          Upload clear photos or PDFs of the required official documents for your vehicle.
        </Text>
      </View>

      {/* Progress tracker card */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressTitle}>Complete your requirements</Text>
          <Text style={styles.progressCount}>
            {completedCount} of {totalCount} completed
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
        </View>
      </View>

      {/* Requirements List */}
      {isLoadingCatalog ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.blue.primary} size="small" />
          <Text style={styles.loadingText}>Loading document requirements</Text>
        </View>
      ) : applicableRequirements.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>No additional documents are needed for this vehicle.</Text>
          <Text style={styles.emptySubtitle}>You can review your application now.</Text>
        </View>
      ) : (
        <View style={styles.requirementsList}>
          {applicableRequirements.map((req) => {
            const state = documents[req.key] ?? 'missing';
            const meta = documentMetadata[req.key] ?? {};
            const isTargetOfCorrection = correctionDocumentTypes.includes(req.key);
            const cardCorrection = isTargetOfCorrection ? correctionReason : undefined;

            return (
              <RequirementCard
                key={req.key}
                requirement={req}
                state={state}
                metadata={meta}
                onMetadataChange={(patch) => onMetadataChange(req.key, patch)}
                onUpload={(asset) => onUploadDocument(req.key, asset)}
                isUploading={uploadingKey === req.key}
                uploadProgress={uploadingKey === req.key ? uploadProgress : 0}
                correctionReason={cardCorrection}
                isReadOnly={isReadOnly}
              />
            );
          })}
        </View>
      )}

      {/* Next CTA */}
      <View style={styles.footer}>
        <Pressable
          style={[
            styles.nextButton,
            (!allCompleted || isReadOnly) && styles.nextButtonDisabled,
          ]}
          onPress={onNext}
          disabled={!allCompleted || isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.nextButtonText}>Review application</Text>
        </Pressable>
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
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: 20,
  },
  progressCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[2],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressTitle: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  progressCount: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.muted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[6],
    gap: spacing[2],
  },
  emptyIcon: {
    fontSize: 32,
    color: colors.green.primary,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
  },
  requirementsList: {
    gap: spacing[4],
  },
  footer: {
    marginTop: spacing[2],
  },
  nextButton: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.45,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
});
