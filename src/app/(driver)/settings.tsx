import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function DriverSettingsScreen() {
  const [voiceGuidance, setVoiceGuidance] = useState(true);
  const [audioAlerts, setAudioAlerts] = useState(true);
  const [highContrastMap, setHighContrastMap] = useState(false);
  const [autoRecenter, setAutoRecenter] = useState(true);

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => (typeof router.canGoBack === 'function' && router.canGoBack() ? router.back() : router.replace('/(driver)/account'))}
          accessibilityRole="button"
          accessibilityLabel="Back to Account"
        >
          <SymbolIcon name="chevron.left" size={20} tintColor={colors.blue.primary} />
          <Text style={styles.backButtonText}>Account</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Navigation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation & Audio</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Voice Guidance</Text>
                <Text style={styles.settingDescription}>
                  Spoken turn-by-turn navigation alerts
                </Text>
              </View>
              <Switch
                value={voiceGuidance}
                onValueChange={setVoiceGuidance}
                trackColor={{ false: colors.border.default, true: colors.green.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Audio Alerts</Text>
                <Text style={styles.settingDescription}>
                  Sound chimes for new incoming trip offers
                </Text>
              </View>
              <Switch
                value={audioAlerts}
                onValueChange={setAudioAlerts}
                trackColor={{ false: colors.border.default, true: colors.green.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* Map Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Map Display</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Auto-Recenter Map</Text>
                <Text style={styles.settingDescription}>
                  Automatically return camera to vehicle while driving
                </Text>
              </View>
              <Switch
                value={autoRecenter}
                onValueChange={setAutoRecenter}
                trackColor={{ false: colors.border.default, true: colors.green.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>High-Contrast Outdoors</Text>
                <Text style={styles.settingDescription}>
                  Enhanced contrast for bright daylight visibility
                </Text>
              </View>
              <Switch
                value={highContrastMap}
                onValueChange={setHighContrastMap}
                trackColor={{ false: colors.border.default, true: colors.green.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>

        {/* Application Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Application Info</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoValue}>2.4.0 (Build 120)</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Operating Zone</Text>
              <Text style={styles.infoValue}>Ormoc City, Leyte</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dispatch Engine</Text>
              <Text style={styles.infoValue}>Pakyaw Dynamic v2</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.bgLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[3],
    backgroundColor: colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
    minHeight: 44,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.blue.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    padding: spacing[4],
    gap: spacing[5],
    paddingBottom: spacing[10],
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
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[4],
  },
  settingTextCol: {
    flex: 1,
    marginRight: spacing[3],
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[4],
  },
  infoLabel: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.ink[700],
  },
  infoValue: {
    fontSize: 15,
    fontFamily: typography.family.semibold,
    color: colors.ink[900],
  },
});
