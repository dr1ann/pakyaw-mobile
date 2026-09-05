/**
 * (driver)/account.tsx
 *
 * Driver Account & Identity Screen.
 * Shows:
 * - Driver Identity Header (Avatar, Name, Verified Driver badge, Active status)
 * - Driver Information (Phone, Vehicle, Plate, Body/Unit, Capacity)
 * - Driver Account (Verification status, View application)
 * - Help & Settings (Trip reports, Help & Support, Settings)
 * - Sign Out action
 */

import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import { useSignOut } from '@pakyaw/shared/features/auth/hooks/useSignOut';
import { getUserDoc } from '@pakyaw/shared/features/auth/services/auth.service';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import { Avatar } from '@pakyaw/shared/components/ui/Avatar';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useDriverApplication } from '@/features/onboarding/hooks/useDriverApplication';

export default function DriverAccountScreen() {
  const router = useRouter();
  const { uid } = useSession();
  const signOut = useSignOut();
  const { application, isApplicationLoaded } = useDriverApplication();

  const { data: profile, isLoading: isProfileLoading } = useQuery<UserDoc | null>({
    queryKey: ['profile', uid],
    queryFn: () => getUserDoc(uid!),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });

  const canonicalProfile = profile as (UserDoc & { readonly name?: string; readonly mobile?: string }) | null;
  const fullName =
    canonicalProfile?.name ??
    (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : application?.personalDetails?.fullLegalName ?? 'Driver');

  const phone = canonicalProfile?.mobile ?? profile?.phone ?? application?.personalDetails?.verifiedMobile ?? '—';
  const vehicleType = application?.vehicle?.vehicleTypeId ? application.vehicle.vehicleTypeId.toUpperCase() : 'Tricycle';
  const plateNumber = application?.vehicle?.plateNumber || '654315';
  const bodyNumber = application?.vehicle?.unitBodyNumber || '762';
  const capacity = '6 passengers';
  const isApproved = application?.status === 'approved' || !application;

  const isLoading = isProfileLoading && !isApplicationLoaded;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Account</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.green.primary} size="large" />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Identity Header */}
          <View style={styles.identityCard}>
            <Avatar name={fullName} size="xl" tone="green" />
            <Text style={styles.fullName}>{fullName}</Text>
            <View style={styles.identityBadgeRow}>
              <View style={styles.verifiedBadge}>
                <SymbolIcon name="checkmark.circle.fill" size={14} tintColor={colors.green.primary} />
                <Text style={styles.verifiedBadgeText}>Verified Driver</Text>
              </View>
              <View style={styles.activeBadge}>
                <View style={styles.activeDot} />
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>
          </View>

          {/* Group 1: Driver Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Information</Text>
            <View style={styles.card}>
              <InfoRow label="Phone" value={phone} />
              <InfoRow label="Vehicle" value={vehicleType} />
              <InfoRow label="Plate" value={plateNumber} />
              <InfoRow label="Body / Unit" value={bodyNumber} />
              <InfoRow label="Capacity" value={capacity} isLast />
            </View>
          </View>

          {/* Group 2: Driver Account */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Driver Account</Text>
            <View style={styles.card}>
              <InfoRow label="Verification" value={isApproved ? 'Approved' : 'Under Review'} />
              <Pressable
                style={styles.navRow}
                onPress={() => router.push('/(driver)/application')}
                accessibilityRole="button"
                accessibilityLabel="View driver application"
              >
                <Text style={styles.navRowLabel}>Application</Text>
                <View style={styles.navRowRight}>
                  <Text style={styles.navRowLink}>View application</Text>
                  <SymbolIcon name="chevron.right" size={16} tintColor={colors.blue.primary} />
                </View>
              </Pressable>
            </View>
          </View>

          {/* Group 3: Help & Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help & Settings</Text>
            <View style={styles.card}>
              <Pressable
                style={styles.navRow}
                onPress={() => router.push('/(driver)/support')}
                accessibilityRole="button"
                accessibilityLabel="Help & Support"
              >
                <View style={styles.navIconRow}>
                  <SymbolIcon name="questionmark.circle.fill" size={18} tintColor={colors.blue.primary} />
                  <Text style={styles.navRowLabel}>Help & Support</Text>
                </View>
                <SymbolIcon name="chevron.right" size={16} tintColor={colors.ink[400]} />
              </Pressable>

              <View style={styles.rowDivider} />

              <Pressable
                style={styles.navRow}
                onPress={() => router.push('/(driver)/settings')}
                accessibilityRole="button"
                accessibilityLabel="Driver settings"
              >
                <View style={styles.navIconRow}>
                  <SymbolIcon name="sparkles" size={18} tintColor={colors.green.primary} />
                  <Text style={styles.navRowLabel}>Settings</Text>
                </View>
                <SymbolIcon name="chevron.right" size={16} tintColor={colors.ink[400]} />
              </Pressable>
            </View>
          </View>

          {/* Sign Out Action */}
          <View style={styles.actionSection}>
            {signOut.error instanceof Error ? (
              <Text style={styles.errorText}>{signOut.error.message}</Text>
            ) : null}
            <Pressable
              style={[styles.signOutBtn, signOut.isPending && styles.signOutBtnDisabled]}
              onPress={() => signOut.mutate()}
              disabled={signOut.isPending}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              testID="driver-sign-out"
            >
              {signOut.isPending ? (
                <ActivityIndicator color={colors.danger} size="small" />
              ) : (
                <Text style={styles.signOutLabel}>Sign Out</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value, isLast = false }: { readonly label: string; readonly value: string; readonly isLast?: boolean }) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  pageTitle: {
    fontSize: 24,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  loadingText: {
    fontSize: 15,
    fontFamily: typography.family.medium,
    color: colors.ink[500],
    marginTop: spacing[3],
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
    paddingBottom: spacing[12],
  },
  identityCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    padding: spacing[5],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing[2],
  },
  fullName: {
    fontSize: 20,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    marginTop: 4,
  },
  identityBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.green.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontFamily: typography.family.semibold,
    color: colors.green.primary,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface.muted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green.primary,
  },
  activeBadgeText: {
    fontSize: 12,
    fontFamily: typography.family.medium,
    color: colors.ink[700],
  },
  section: {
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: typography.family.bold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: spacing[1],
  },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
  },
  infoValue: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 48,
  },
  navIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navRowLabel: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
  navRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navRowLink: {
    fontSize: 14,
    fontFamily: typography.family.medium,
    color: colors.blue.primary,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  actionSection: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  signOutBtn: {
    backgroundColor: colors.surface.card,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  signOutBtnDisabled: {
    opacity: 0.5,
  },
  signOutLabel: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: colors.danger,
  },
  errorText: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.danger,
    textAlign: 'center',
  },
});
