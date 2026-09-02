import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import type { DocumentState, DriverDocumentMetadata, OnboardingDocumentRequirement } from '@pakyaw/shared/onboarding';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { OnboardingTextField } from './application-field';
import { ExpiryDateField } from './expiry-date-field';
import type { PickedDriverDocument } from '../services/document-upload.service';

type RequirementCardProps = {
  readonly requirement: OnboardingDocumentRequirement;
  readonly state: DocumentState | 'missing';
  readonly metadata: DriverDocumentMetadata;
  readonly onMetadataChange: (patch: Partial<DriverDocumentMetadata>) => void;
  readonly onUpload: (asset: PickedDriverDocument) => Promise<void>;
  readonly isUploading?: boolean;
  readonly uploadProgress?: number;
  readonly correctionReason?: string;
  readonly isReadOnly?: boolean;
};

export function getHumanReadableState(
  state: DocumentState | 'missing',
  hasCorrection?: boolean,
): { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' } {
  if (hasCorrection) {
    return { label: 'Needs update', tone: 'warning' };
  }
  switch (state) {
    case 'approved':
      return { label: 'Approved', tone: 'success' };
    case 'uploaded':
      return { label: 'Uploaded', tone: 'info' };
    case 'under_review':
      return { label: 'Under review', tone: 'info' };
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' };
    case 'expired':
      return { label: 'Expired', tone: 'danger' };
    case 'missing':
    default:
      return { label: 'Not started', tone: 'neutral' };
  }
}

export function RequirementCard({
  requirement,
  state,
  metadata,
  onMetadataChange,
  onUpload,
  isUploading = false,
  uploadProgress = 0,
  correctionReason,
  isReadOnly = false,
}: RequirementCardProps) {
  const [pickError, setPickError] = useState<string | null>(null);
  const statusInfo = getHumanReadableState(state, Boolean(correctionReason));
  const isComplete = state === 'uploaded' || state === 'approved';

  const handleChooseDocument = async () => {
    if (isReadOnly || isUploading) return;
    setPickError(null);
    try {
      const picker = await import('expo-document-picker');
      const result = await picker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        await onUpload({
          uri: file.uri,
          name: file.name,
          size: file.size ?? null,
          mimeType: file.mimeType ?? null,
        });
      }
    } catch (err: any) {
      console.error('[RequirementCard] pick failed:', err);
      setPickError(err?.message || 'We couldn’t choose that document. Try again.');
    }
  };

  return (
    <View style={styles.card} testID={`requirement-card-${requirement.key}`}>
      {/* Header with Title and Status Pill */}
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.label}>{requirement.label}</Text>
          {requirement.requiredForApplication ? (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          ) : (
            <View style={styles.optionalBadge}>
              <Text style={styles.optionalText}>Optional</Text>
            </View>
          )}
        </View>

        <View style={[styles.statusPill, styles[`status_${statusInfo.tone}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${statusInfo.tone}`]]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Description */}
      {requirement.description ? (
        <Text style={styles.description}>{requirement.description}</Text>
      ) : null}

      {/* Correction Notice */}
      {correctionReason ? (
        <View style={styles.correctionBox}>
          <Text style={styles.correctionTitle}>Pakyaw Operations requested an update:</Text>
          <Text style={styles.correctionMessage}>{correctionReason}</Text>
        </View>
      ) : null}

      {/* Conditional Fields: Document Number, Issuance Date, Expiry Date */}
      <View style={styles.fieldsContainer}>
        {requirement.requiresIdentification ? (
          <OnboardingTextField
            label="Document or ID number"
            required
            placeholder="Ex: N01-12-345678"
            value={metadata.identificationNumber ?? ''}
            onChangeText={(val) =>
              onMetadataChange({ identificationNumber: val.trim() })
            }
            editable={!isReadOnly}
            autoCapitalize="characters"
          />
        ) : null}

        {requirement.requiresIssuanceDate ? (
          <ExpiryDateField
            label="Issuance date"
            value={metadata.issuanceDate ?? ''}
            onChange={(val) => onMetadataChange({ issuanceDate: val })}
            editable={!isReadOnly}
            help="Date the document was officially issued."
          />
        ) : null}

        {requirement.requiresExpiryDate ? (
          <ExpiryDateField
            label="Expiry date"
            value={metadata.expiryDate ?? ''}
            onChange={(val) => onMetadataChange({ expiryDate: val })}
            editable={!isReadOnly}
            help="Document must not be expired."
          />
        ) : null}
      </View>

      {/* Document Upload Area */}
      <View style={styles.uploadArea}>
        <View style={styles.uploadStatusRow}>
          <Text style={styles.uploadSectionTitle}>Document file</Text>
          {isComplete ? (
            <Text style={styles.uploadSuccessBadge}>✓ Document uploaded</Text>
          ) : (
            <Text style={styles.uploadPendingBadge}>Attach clear photo or PDF</Text>
          )}
        </View>

        {isUploading ? (
          <View style={styles.uploadingBox}>
            <ActivityIndicator color={colors.blue.primary} size="small" />
            <Text style={styles.uploadingText}>
              Uploading {Math.round(uploadProgress * 100)}%
            </Text>
          </View>
        ) : (
          <Pressable
            style={[
              styles.uploadButton,
              isComplete && styles.uploadButtonComplete,
              isReadOnly && styles.uploadButtonDisabled,
            ]}
            onPress={handleChooseDocument}
            disabled={isReadOnly || isUploading}
            accessibilityRole="button"
          >
            <Text style={[styles.uploadButtonText, isComplete && styles.uploadButtonTextComplete]}>
              {isComplete ? 'Replace document' : 'Upload document'}
            </Text>
          </Pressable>
        )}

        {pickError ? <Text style={styles.errorText}>{pickError}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[3],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    fontSize: 17,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  requiredBadge: {
    backgroundColor: colors.blue.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  requiredText: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  optionalBadge: {
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  optionalText: {
    fontSize: 11,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  status_neutral: {
    backgroundColor: colors.surface.muted,
  },
  statusText_neutral: {
    color: colors.ink[500],
  },
  status_info: {
    backgroundColor: colors.blue.tint,
  },
  statusText_info: {
    color: colors.blue.primary,
  },
  status_success: {
    backgroundColor: colors.green.tint,
  },
  statusText_success: {
    color: colors.green.primary,
  },
  status_warning: {
    backgroundColor: colors.amber.tint,
  },
  statusText_warning: {
    color: colors.amber.deep,
  },
  status_danger: {
    backgroundColor: '#FEE4E2',
  },
  statusText_danger: {
    color: '#B42318',
  },
  description: {
    fontSize: 14,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: 20,
    marginTop: -4,
  },
  correctionBox: {
    backgroundColor: colors.amber.tint,
    borderRadius: radius.sm,
    padding: spacing[3],
    gap: 4,
    borderWidth: 1,
    borderColor: '#F8D29D',
  },
  correctionTitle: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.amber.deep,
  },
  correctionMessage: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[900],
    lineHeight: 18,
  },
  fieldsContainer: {
    gap: spacing[3],
  },
  uploadArea: {
    marginTop: spacing[1],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    gap: spacing[2],
  },
  uploadStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadSectionTitle: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  uploadSuccessBadge: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.green.primary,
  },
  uploadPendingBadge: {
    fontSize: 12,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  uploadButton: {
    borderWidth: 1.5,
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
    borderRadius: radius.sm,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonComplete: {
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.muted,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 14,
    fontFamily: typography.family.bold,
    color: colors.blue.primary,
  },
  uploadButtonTextComplete: {
    color: colors.ink[700],
  },
  uploadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    backgroundColor: colors.surface.muted,
    borderRadius: radius.sm,
  },
  uploadingText: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.ink[700],
  },
  errorText: {
    color: '#B42318',
    fontSize: 12,
    fontFamily: typography.family.medium,
  },
});
