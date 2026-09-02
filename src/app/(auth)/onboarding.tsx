/**
 * (auth)/onboarding.tsx
 *
 * Passenger Onboarding Intro — Maximum 3 concise, mobile-first intro screens.
 */

import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INTRO_SLIDES = [
  {
    id: '1',
    emoji: '🛺',
    title: 'Ride around Ormoc',
    body: 'Find a Pakyaw ride when you need one.',
  },
  {
    id: '2',
    emoji: '🧭',
    title: 'Choose how you ride',
    body: 'Book Pakyaw, Shared, or Hop when available.',
  },
  {
    id: '3',
    emoji: '✨',
    title: 'Ready when you are',
    body: 'Set up your account and start booking.',
  },
];

export default function PassengerOnboardingScreen() {
  const router = useRouter();
  const setOnboardingSeen = useSessionStore((s) => s.setOnboardingSeen);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function finish() {
    setOnboardingSeen(true);
    router.replace('/(auth)/sign-up');
  }

  function next() {
    if (activeIndex < INTRO_SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else {
      finish();
    }
  }

  const isLast = activeIndex === INTRO_SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          onPress={finish}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={INTRO_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      {/* Pagination indicators */}
      <View style={styles.dotsRow}>
        {INTRO_SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : null]}
          />
        ))}
      </View>

      {/* CTA Footer */}
      <View style={styles.footer}>
        <Pressable
          onPress={next}
          style={styles.btnPrimary}
          accessibilityRole="button"
          testID="onboarding-continue"
        >
          <Text style={styles.btnPrimaryText}>{isLast ? 'Get started' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.bgPassenger,
  },
  topBar: {
    paddingTop: 56,
    paddingHorizontal: spacing[6],
    alignItems: 'flex-end',
  },
  skipBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
  },
  skipText: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[10],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  iconEmoji: {
    fontSize: 54,
  },
  slideTitle: {
    fontSize: typography.size.h1,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    textAlign: 'center',
    marginBottom: spacing[3],
    lineHeight: typography.lineHeight.h1,
  },
  slideBody: {
    fontSize: typography.size.bodyMd,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: typography.lineHeight.body,
    maxWidth: 280,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[5],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.ink[400],
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.blue.primary,
  },
  footer: {
    paddingHorizontal: spacing[6],
    paddingBottom: spacing[10],
  },
  btnPrimary: {
    backgroundColor: colors.blue.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: typography.size.bodyMd,
    fontWeight: typography.weight.bold,
    color: colors.white,
  },
});
