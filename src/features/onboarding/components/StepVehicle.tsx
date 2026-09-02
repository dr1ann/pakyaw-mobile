import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { DriverOnboardingCatalog, OnboardingVehicleType } from '@pakyaw/shared/onboarding';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { OnboardingTextField } from './application-field';
import { sanitizeIdentifier } from '../input-validation';
import type { DriverApplicationForm } from '../types';

type StepVehicleProps = {
  readonly form: DriverApplicationForm;
  readonly catalog: DriverOnboardingCatalog | null;
  readonly isLoadingCatalog: boolean;
  readonly onChange: (path: string, value: string | boolean) => void;
  readonly onNext: () => void;
  readonly isReadOnly?: boolean;
  readonly isSaving?: boolean;
  readonly error?: string | null;
};

function getVehicleIcon(vt: OnboardingVehicleType): string {
  if (vt.icon) return vt.icon;
  const lower = vt.type.toLowerCase();
  if (lower.includes('tri') || lower.includes('pedi')) return '🛺';
  if (lower.includes('motor') || lower.includes('bike')) return '🏍️';
  if (lower.includes('van') || lower.includes('suv')) return '🚙';
  return '🚗';
}

export function StepVehicle({
  form,
  catalog,
  isLoadingCatalog,
  onChange,
  onNext,
  isReadOnly = false,
  isSaving = false,
  error = null,
}: StepVehicleProps) {
  const { vehicle, personalDetails } = form;
  const activeVehicleTypes = (catalog?.vehicleTypes ?? []).filter((vt) => vt.status === 'active');

  const selectedVehicleType = activeVehicleTypes.find((vt) => vt.id === vehicle.vehicleTypeId);
  const isPlateValid = vehicle.plateNumber.trim().length >= 3;
  const isBodyValid = vehicle.unitBodyNumber.trim().length >= 1;
  const isOwnerInfoValid = vehicle.isDriverOwner
    ? true
    : vehicle.ownerOperatorInfo.trim().length >= 2;

  const canContinue = Boolean(selectedVehicleType) && isPlateValid && isBodyValid && isOwnerInfoValid;

  const handleSelectVehicle = (vt: OnboardingVehicleType) => {
    if (isReadOnly) return;
    onChange('vehicle.vehicleTypeId', vt.id);
  };

  const handleOwnerToggle = (isOwner: boolean) => {
    if (isReadOnly) return;
    onChange('vehicle.isDriverOwner', isOwner);
    if (isOwner) {
      onChange('vehicle.ownerOperatorInfo', personalDetails.fullLegalName);
    } else if (vehicle.ownerOperatorInfo === personalDetails.fullLegalName) {
      onChange('vehicle.ownerOperatorInfo', '');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your vehicle</Text>
        <Text style={styles.subtitle}>
          Choose your registered vehicle type in Ormoc and enter its details.
        </Text>
      </View>

      {/* Dynamic Vehicle Types Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose vehicle type</Text>
        {isLoadingCatalog ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.blue.primary} size="small" />
            <Text style={styles.loadingText}>Loading available vehicle types</Text>
          </View>
        ) : activeVehicleTypes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>⚠️</Text>
            <Text style={styles.emptyTitle}>{"Vehicle registration isn’t available yet."}</Text>
            <Text style={styles.emptySubtitle}>Try again later.</Text>
          </View>
        ) : (
          <View style={styles.vehicleGrid}>
            {activeVehicleTypes.map((vt) => {
              const isSelected = vehicle.vehicleTypeId === vt.id;
              return (
                <Pressable
                  key={vt.id}
                  style={[
                    styles.vehicleCard,
                    isSelected && styles.vehicleCardSelected,
                    isReadOnly && styles.vehicleCardDisabled,
                  ]}
                  onPress={() => handleSelectVehicle(vt)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.vehicleEmoji}>{getVehicleIcon(vt)}</Text>
                    {isSelected ? (
                      <View style={styles.checkCircle}>
                        <Text style={styles.checkText}>✓</Text>
                      </View>
                    ) : (
                      <View style={styles.uncheckCircle} />
                    )}
                  </View>
                  <Text style={[styles.vehicleTypeName, isSelected && styles.vehicleTypeNameSelected]}>
                    {vt.type}
                  </Text>
                  <Text style={styles.vehicleCapacity}>
                    Up to {vt.capacity} passenger{vt.capacity > 1 ? 's' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Vehicle Registration Details */}
      {selectedVehicleType ? (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Identification and unit number</Text>
          <OnboardingTextField
            label="Plate number"
            required
            placeholder="Ex: ABC-1234 or MV file number"
            value={vehicle.plateNumber}
            onChangeText={(val) => onChange('vehicle.plateNumber', sanitizeIdentifier(val).toUpperCase())}
            autoCapitalize="characters"
            editable={!isReadOnly}
          />

          <OnboardingTextField
            label="Body or unit number"
            required
            placeholder="Ex: 017"
            value={vehicle.unitBodyNumber}
            onChangeText={(val) => onChange('vehicle.unitBodyNumber', val)}
            editable={!isReadOnly}
          />

          <View style={styles.divider} />

          {/* Ownership Question */}
          <Text style={styles.sectionTitle}>Vehicle ownership</Text>
          <Text style={styles.ownershipQuestion}>Are you the registered owner of this vehicle?</Text>
          <View style={styles.ownerToggleRow}>
            <Pressable
              style={[
                styles.toggleBtn,
                vehicle.isDriverOwner && styles.toggleBtnActive,
                isReadOnly && styles.toggleBtnDisabled,
              ]}
              onPress={() => handleOwnerToggle(true)}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleBtnText, vehicle.isDriverOwner && styles.toggleBtnTextActive]}>
                Yes, I am the owner
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleBtn,
                !vehicle.isDriverOwner && styles.toggleBtnActive,
                isReadOnly && styles.toggleBtnDisabled,
              ]}
              onPress={() => handleOwnerToggle(false)}
              accessibilityRole="button"
            >
              <Text style={[styles.toggleBtnText, !vehicle.isDriverOwner && styles.toggleBtnTextActive]}>
                No, I drive for an owner
              </Text>
            </Pressable>
          </View>

          {!vehicle.isDriverOwner ? (
            <OnboardingTextField
              label="Owner or operator name"
              required
              placeholder="Ex: Pedro Santos"
              value={vehicle.ownerOperatorInfo}
              onChangeText={(val) => onChange('vehicle.ownerOperatorInfo', val)}
              editable={!isReadOnly}
              autoCapitalize="words"
            />
          ) : null}
        </View>
      ) : null}

      {/* Error Alert */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, (!canContinue || isReadOnly || isSaving) && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={!canContinue || isReadOnly || isSaving}
          accessibilityRole="button"
        >
          {isSaving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.nextButtonText}>Saving vehicle details</Text>
            </View>
          ) : (
            <Text style={styles.nextButtonText}>Continue to requirements</Text>
          )}
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
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
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
  vehicleGrid: {
    gap: spacing[3],
  },
  vehicleCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[1],
  },
  vehicleCardSelected: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
  },
  vehicleCardDisabled: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  vehicleEmoji: {
    fontSize: 36,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.family.bold,
  },
  uncheckCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border.subtle,
  },
  vehicleTypeName: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  vehicleTypeNameSelected: {
    color: colors.blue.primary,
  },
  vehicleCapacity: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  formSection: {
    gap: spacing[3],
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing[1],
  },
  ownershipQuestion: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
    marginTop: -spacing[1],
  },
  ownerToggleRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.blue.primary,
    backgroundColor: colors.blue.tint,
  },
  toggleBtnDisabled: {
    opacity: 0.5,
  },
  toggleBtnText: {
    fontSize: 13,
    fontFamily: typography.family.semibold,
    color: colors.ink[700],
    textAlign: 'center',
  },
  toggleBtnTextActive: {
    color: colors.blue.primary,
    fontFamily: typography.family.bold,
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
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.md,
    padding: spacing[3],
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: '#DC2626',
    lineHeight: 18,
  },
});
