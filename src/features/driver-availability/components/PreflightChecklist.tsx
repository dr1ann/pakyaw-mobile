/**
 * PreflightChecklist — modal sheet with the 6 FR-1.3.9 items.
 *
 * All six items must be checked before "Go Online" becomes enabled.
 * Checklist state is local UI only (not persisted to Firestore).
 * Only preflightPassedAt is written to Firestore (by the presence service).
 *
 * Calls onConfirm when the driver taps "Go Online" with all items checked.
 * Calls onClose to dismiss without going online.
 */

import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@pakyaw/shared/components/ui/Button';
import { Sheet } from '@pakyaw/shared/components/ui/Sheet';
import { colors, radius, spacing, typography } from '@/constants/theme';
import {
  PREFLIGHT_ITEMS,
  type PreflightItemId,
} from '@/features/driver-availability/types';

type PreflightChecklistProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
};

export function PreflightChecklist({
  visible,
  onClose,
  onConfirm,
  loading = false,
}: PreflightChecklistProps) {
  const [checked, setChecked] = useState<Set<PreflightItemId>>(
    () => new Set(PREFLIGHT_ITEMS.map((item) => item.id)),
  );

  const allChecked = checked.size === PREFLIGHT_ITEMS.length;

  function toggle(id: PreflightItemId) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleClose() {
    setChecked(new Set()); // reset on dismiss
    onClose();
  }

  function handleConfirm() {
    if (!allChecked || loading) return;
    onConfirm();
  }

  return (
    <Sheet
      visible={visible}
      onClose={handleClose}
      dismissOnBackdropPress={false}
      showHandle
      padded={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PRE-FLIGHT CHECK</Text>
        <Text style={styles.title}>Ready to Drive?</Text>
        <Text style={styles.subtitle}>
          Confirm all items before going online. Passengers are counting on you.
        </Text>
      </View>

      {/* Checklist */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {PREFLIGHT_ITEMS.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isChecked }}
              accessibilityLabel={item.label}
              accessibilityHint={isChecked ? 'Double-tap to uncheck' : 'Double-tap to check'}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [
                styles.item,
                isChecked && styles.itemChecked,
                pressed && styles.itemPressed,
              ]}
              testID={`preflight-item-${item.id}`}
            >
              {/* Checkbox */}
              <View
                style={[
                  styles.checkbox,
                  isChecked && styles.checkboxChecked,
                ]}
              >
                {isChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>

              {/* Label + description */}
              <View style={styles.itemText}>
                <Text
                  style={[
                    styles.itemLabel,
                    isChecked && styles.itemLabelChecked,
                  ]}
                >
                  {item.label}
                </Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {!allChecked && (
          <Text style={styles.hint}>
            {PREFLIGHT_ITEMS.length - checked.size} item
            {PREFLIGHT_ITEMS.length - checked.size !== 1 ? 's' : ''} remaining
          </Text>
        )}
        <Button
          label={loading ? 'Going online…' : 'Go Online'}
          onPress={handleConfirm}
          disabled={!allChecked}
          loading={loading}
          fullWidth
          testID="preflight-confirm-btn"
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={handleClose}
          fullWidth
          style={styles.cancelBtn}
          testID="preflight-cancel-btn"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
  },
  eyebrow: {
    fontSize: typography.size.label,
    fontWeight: typography.weight.semibold,
    color: colors.green.primary,
    letterSpacing: typography.letterSpacing.label,
    marginBottom: spacing[1],
  },
  title: {
    fontSize: typography.size.h2,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.bodySmall,
  },
  listContainer: {
    maxHeight: 340,
  },
  list: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    gap: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.surface.muted,
    borderRadius: radius.md,
    padding: spacing[3],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  itemChecked: {
    backgroundColor: colors.green.tint,
    borderColor: colors.green.primary,
  },
  itemPressed: {
    opacity: 0.8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm / 2,
    borderWidth: 2,
    borderColor: colors.ink[400],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.green.primary,
    borderColor: colors.green.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: typography.weight.bold,
    lineHeight: 16,
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[700],
    marginBottom: 2,
  },
  itemLabelChecked: {
    color: colors.ink[900],
  },
  itemDescription: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    lineHeight: typography.lineHeight.bodySmall,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
    gap: spacing[2],
  },
  hint: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[400],
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  cancelBtn: {
    marginTop: spacing[1],
  },
});
