/**
 * (driver)/account.tsx
 *
 * Driver account screen.
 * Shows: name, phone, role, Sign Out button.
 */

import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@pakyaw/shared/features/auth/hooks/useSession';
import { useSignOut } from '@pakyaw/shared/features/auth/hooks/useSignOut';
import { getUserDoc } from '@pakyaw/shared/features/auth/services/auth.service';
import type { UserDoc } from '@pakyaw/shared/features/auth/types';
import { Avatar } from '@pakyaw/shared/components/ui/Avatar';
import { Card } from '@pakyaw/shared/components/ui/Card';
import { StatusPill } from '@pakyaw/shared/components/ui/StatusPill';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function DriverAccountScreen() {
  const { uid } = useSession();
  const signOut = useSignOut();

  const { data: profile, isLoading } = useQuery<UserDoc | null>({
    queryKey: ['profile', uid],
    queryFn: () => getUserDoc(uid!),
    enabled: !!uid,
    staleTime: 5 * 60_000,
  });

  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.pageTitle}>Account</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.green.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.avatarSection}>
            <Avatar name={fullName} size="xl" tone="green" />
            <Text style={styles.fullName}>{fullName ?? '—'}</Text>
            <StatusPill label="DRIVER" tone="success" />
          </View>

          <Card padded={false} style={styles.card}>
            <InfoRow label="Phone" value={profile?.phone ?? '—'} />
            <InfoRow label="Email" value={profile?.email ?? '—'} />
          </Card>
        </>
      )}

      <View style={styles.signOutWrap}>
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
            <Text style={styles.signOutLabel}>Sign out</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  label: { fontSize: typography.size.bodySmall, color: colors.ink[500] },
  value: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
    paddingHorizontal: spacing[6],
  },
  pageTitle: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.extraBold,
    color: colors.ink[900],
    marginTop: spacing[6],
    marginBottom: spacing[8],
  },
  loader: { marginTop: spacing[10] },
  avatarSection: {
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[8],
  },
  fullName: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  card: {
    paddingHorizontal: spacing[4],
    overflow: 'hidden',
  },
  signOutWrap: {
    position: 'absolute',
    bottom: spacing[12],
    left: spacing[6],
    right: spacing[6],
    gap: spacing[3],
  },
  errorText: {
    fontSize: typography.size.bodySmall,
    color: colors.danger,
    textAlign: 'center',
  },
  signOutBtn: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutLabel: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.danger,
  },
});
