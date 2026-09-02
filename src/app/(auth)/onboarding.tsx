/**
 * (auth)/onboarding.tsx
 *
 * Driver Intro Experience — 3 lightweight slides.
 * Shown once before registration.
 * On completion sets onboardingSeen = true and navigates to welcome.
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSessionStore } from '@pakyaw/shared/stores/sessionStore';
import { colors, typography } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    emoji: '🛺',
    badge: 'Ormoc City Rides',
    title: 'Drive with Pakyaw',
    body: 'Connect with passengers looking for local rides around Ormoc.',
  },
  {
    id: '2',
    emoji: '📋',
    badge: 'Simple Process',
    title: 'Apply one step at a time',
    body: 'Complete your profile, vehicle information, and required documents.',
  },
  {
    id: '3',
    emoji: '✅',
    badge: 'Quick review',
    title: 'Get approved.\nStart driving.',
    body: 'Pakyaw Operations reviews your application before you can go online.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingSeen = useSessionStore((s) => s.setOnboardingSeen);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function finish() {
    setOnboardingSeen(true);
    router.replace('/');
  }

  function next() {
    if (activeIndex < SLIDES.length - 1) {
      const nextIndex = activeIndex + 1;
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    } else {
      finish();
    }
  }

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={finish}
        style={styles.skipBtn}
        accessibilityRole="button"
        accessibilityLabel="Skip intro"
      >
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={listRef}
        data={SLIDES}
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
            <View style={styles.illustrationWrap}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      {/* Pagination dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex ? styles.dotActive : null]}
          />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={next}
          style={styles.btn}
          accessibilityRole="button"
          testID="onboarding-continue"
        >
          <Text style={styles.btnLabel}>{isLast ? 'Start application' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.bgLight },
  skipBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: colors.ink[500],
    fontFamily: typography.family.semibold,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 60,
    gap: 16,
  },
  illustrationWrap: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: colors.blue.tint,
    borderWidth: 2,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emoji: { fontSize: 60 },
  badgeWrap: {
    backgroundColor: colors.cyan.tint,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    color: colors.cyan.deep,
    fontSize: 12,
    fontFamily: typography.family.bold,
  },
  slideTitle: {
    fontSize: 28,
    fontFamily: typography.family.bold,
    color: colors.ink[900],
    textAlign: 'center',
    lineHeight: 36,
  },
  slideBody: {
    fontSize: 15,
    fontFamily: typography.family.regular,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ink[400] },
  dotActive: { width: 26, backgroundColor: colors.blue.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 48 },
  btn: {
    backgroundColor: colors.blue.primary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnLabel: {
    fontSize: 16,
    fontFamily: typography.family.bold,
    color: '#FFFFFF',
  },
});
