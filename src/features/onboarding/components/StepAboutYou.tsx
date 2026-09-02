import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { OnboardingTextField } from './application-field';
import { sanitizeMobileInput, sanitizeNamePart } from '../input-validation';
import { normalizePhilippineMobile } from '../services/driver-registration.service';
import type { DriverApplicationForm } from '../types';

type StepAboutYouProps = {
  readonly form: DriverApplicationForm;
  readonly onChange: (path: string, value: string | boolean) => void;
  readonly onNext: () => void;
  readonly isReadOnly?: boolean;
};

export function StepAboutYou({
  form,
  onChange,
  onNext,
  isReadOnly = false,
}: StepAboutYouProps) {
  const { personalDetails } = form;
  const isAddressValid = personalDetails.barangayAddress.trim().length >= 3;
  const isContactNameValid = personalDetails.emergencyContact.name.trim().length >= 2;
  const isContactMobileValid = normalizePhilippineMobile(personalDetails.emergencyContact.mobile) !== null;
  const canContinue = isAddressValid && isContactNameValid && isContactMobileValid;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>
          Your verified account information and essential contact details.
        </Text>
      </View>

      {/* Verified Account Card */}
      <View style={styles.verifiedCard}>
        <View style={styles.verifiedBadgeRow}>
          <Text style={styles.verifiedBadgeIcon}>✓</Text>
          <Text style={styles.verifiedBadgeText}>Verified mobile account</Text>
        </View>
        <View style={styles.verifiedRow}>
          <Text style={styles.verifiedLabel}>Legal name</Text>
          <Text style={styles.verifiedValue}>{personalDetails.fullLegalName || '—'}</Text>
        </View>
        <View style={styles.verifiedDivider} />
        <View style={styles.verifiedRow}>
          <Text style={styles.verifiedLabel}>Mobile number</Text>
          <Text style={styles.verifiedValue}>{personalDetails.verifiedMobile || '—'}</Text>
        </View>
      </View>

      {/* Operational Details Form */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Your residence</Text>
        <OnboardingTextField
          label="Barangay / address in Ormoc"
          required
          placeholder="Ex: Brgy. Cogon, Ormoc City"
          value={personalDetails.barangayAddress}
          onChangeText={(val) => onChange('personalDetails.barangayAddress', val)}
          editable={!isReadOnly}
          autoCapitalize="words"
        />

        <View style={styles.spacer} />

        <Text style={styles.sectionTitle}>Emergency contact</Text>
        <Text style={styles.sectionHint}>
          Someone we can contact in case of an incident or emergency on the road.
        </Text>
        <OnboardingTextField
          label="Contact name"
          required
          placeholder="Ex: Maria Dela Cruz"
          value={personalDetails.emergencyContact.name}
          onChangeText={(val) => onChange('personalDetails.emergencyContact.name', sanitizeNamePart(val))}
          editable={!isReadOnly}
          autoCapitalize="words"
        />

        <OnboardingTextField
          label="Contact mobile number"
          required
          placeholder="Ex: 09181234567"
          value={personalDetails.emergencyContact.mobile}
          onChangeText={(val) => onChange('personalDetails.emergencyContact.mobile', sanitizeMobileInput(val))}
          keyboardType="phone-pad"
          editable={!isReadOnly}
        />
      </View>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.nextButton, (!canContinue || isReadOnly) && styles.nextButtonDisabled]}
          onPress={onNext}
          disabled={!canContinue || isReadOnly}
          accessibilityRole="button"
        >
          <Text style={styles.nextButtonText}>Continue to vehicle</Text>
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
  verifiedCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
    gap: spacing[3],
  },
  verifiedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.green.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  verifiedBadgeIcon: {
    color: colors.green.primary,
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  verifiedBadgeText: {
    color: colors.green.primary,
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  verifiedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifiedLabel: {
    fontSize: 13,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
  },
  verifiedValue: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  verifiedDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  formSection: {
    gap: spacing[3],
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing[4],
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    marginTop: -spacing[1],
    marginBottom: spacing[1],
    lineHeight: 18,
  },
  spacer: {
    height: spacing[2],
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
