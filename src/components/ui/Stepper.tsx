import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/constants/theme';

export type StepperOrientation = 'horizontal' | 'vertical';
export type StepperItemState = 'completed' | 'active' | 'pending';
export type StepperTone = 'blue' | 'green' | 'violet';

export type StepperItem = {
  label: string;
  state: StepperItemState;
};

export type StepperProps = {
  items: StepperItem[];
  orientation?: StepperOrientation;
  tone?: StepperTone;
  style?: StyleProp<ViewStyle>;
};

const TONES: Record<StepperTone, string> = {
  blue: colors.blue.primary,
  green: colors.green.primary,
  violet: colors.violet.primary,
};

function nodeColors(state: StepperItemState, accent: string) {
  switch (state) {
    case 'completed':
      return { bg: accent, border: accent, fg: colors.white };
    case 'active':
      return { bg: colors.white, border: accent, fg: accent };
    default:
      return { bg: colors.surface.muted, border: colors.border.subtle, fg: colors.ink[400] };
  }
}

export function Stepper({
  items,
  orientation = 'horizontal',
  tone = 'blue',
  style,
}: StepperProps) {
  const accent = TONES[tone];

  if (orientation === 'vertical') {
    return (
      <View style={[styles.vContainer, style]}>
        {items.map((item, index) => {
          const palette = nodeColors(item.state, accent);
          const isLast = index === items.length - 1;
          const connectorColor =
            item.state === 'completed' ? accent : colors.border.subtle;
          return (
            <View key={`${item.label}-${index}`} style={styles.vRow}>
              <View style={styles.vNodeColumn}>
                <View
                  style={[
                    styles.node,
                    {
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.nodeText, { color: palette.fg }]}>
                    {item.state === 'completed' ? '✓' : `${index + 1}`}
                  </Text>
                </View>
                {!isLast ? (
                  <View style={[styles.vConnector, { backgroundColor: connectorColor }]} />
                ) : null}
              </View>
              <View style={styles.vLabelWrap}>
                <Text
                  style={[
                    styles.label,
                    item.state === 'pending' && styles.labelPending,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.hContainer, style]}>
      {items.map((item, index) => {
        const palette = nodeColors(item.state, accent);
        const isLast = index === items.length - 1;
        const connectorColor =
          item.state === 'completed' ? accent : colors.border.subtle;
        return (
          <Fragment key={`${item.label}-${index}`}>
            <View style={styles.hItem}>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: palette.bg,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.nodeText, { color: palette.fg }]}>
                  {item.state === 'completed' ? '✓' : `${index + 1}`}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.hLabel,
                  item.state === 'pending' && styles.labelPending,
                ]}
              >
                {item.label}
              </Text>
            </View>
            {!isLast ? (
              <View
                style={[styles.hConnector, { backgroundColor: connectorColor }]}
              />
            ) : null}
          </Fragment>
        );
      })}
    </View>
  );
}

const NODE_SIZE = 28;

const styles = StyleSheet.create({
  hContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hItem: {
    alignItems: 'center',
    gap: spacing[1],
  },
  hConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: spacing[2],
    marginBottom: 18,
  },
  hLabel: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: colors.ink[700],
    textAlign: 'center',
    maxWidth: 96,
  },
  vContainer: {
    gap: 0,
  },
  vRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  vNodeColumn: {
    alignItems: 'center',
  },
  vConnector: {
    width: 2,
    flex: 1,
    minHeight: 24,
    marginTop: spacing[1],
  },
  vLabelWrap: {
    flex: 1,
    paddingBottom: spacing[4],
  },
  label: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  labelPending: {
    color: colors.ink[400],
    fontWeight: typography.weight.medium,
  },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
});
