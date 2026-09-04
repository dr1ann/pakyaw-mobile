/**
 * (auth)/onboarding.tsx
 *
 * Passenger Onboarding Intro — 3 concise, mobile-first intro slides.
 * Communicates local Ormoc mobility, ride options, and passwordless ease.
 */

import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { Button } from '@pakyaw/shared/components/ui/Button';
import { Text } from '@pakyaw/shared/components/ui/Text';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INTRO_SLIDES = [
  {
    id: '1',
    emoji: '🛺',
    title: 'Ride around Ormoc',
    body: 'Book local tricycle and taxi rides on demand, right from your phone.',
  },
  {
    id: '2',
    emoji: '🧭',
    title: 'Choose how you ride',
    body: 'Pick the right option for your trip: Pakyaw, Shared, or Hop when available.',
  },
  {
    id: '3',
    emoji: '✨',
    title: 'Ready when you are',
    body: 'Sign up in seconds with just your mobile number. No passwords required.',
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
      {/* Top Bar with Skip action */}
      <View style={styles.topBar}>
        <Pressable
          onPress={finish}
          style={styles.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          hitSlop={8}
        >
          <Text variant="body" weight="semibold" color={colors.ink[500]}>
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Slide Carousel */}
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
            <Text variant="h1" align="center" style={styles.slideTitle}>
              {item.title}
            </Text>
            <Text variant="body" align="center" color={colors.ink[500]} style={styles.slideBody}>
              {item.body}
            </Text>
          </View>
        )}
      />

      {/* Pagination Indicator */}
      <View style={styles.dotsRow} accessibilityRole="tablist">
        {INTRO_SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : null]}
            accessibilityRole="tab"
            accessibilityState={{ selected: i === activeIndex }}
          />
        ))}
      </View>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <Button
          label={isLast ? 'Get started' : 'Continue'}
          variant="primary"
          size="lg"
          onPress={next}
          testID="onboarding-continue"
        />
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
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[8],
    paddingBottom: spacing[8],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    backgroundColor: colors.blue.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[6],
  },
  iconEmoji: {
    fontSize: 54,
  },
  slideTitle: {
    color: colors.ink[900],
    marginBottom: spacing[3],
  },
  slideBody: {
    maxWidth: 290,
    lineHeight: typography.lineHeight.body,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[6],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
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
});
