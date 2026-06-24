/**
 * onboarding.tsx
 *
 * Onboarding carousel — shown once on first launch.
 * On completion sets onboardingSeen = true and navigates to /welcome.
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

import { useSessionStore } from '@/stores/sessionStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  ink900: '#0E1726',
  ink500: '#6B7689',
  ink400: '#9AA4B2',
  bluePrimary: '#2F80ED',
  blueTint: '#E8F1FE',
  surfaceMuted: '#F4F7FB',
  bgPassenger: '#EAF1FB',
};

const SLIDES = [
  {
    id: '1',
    emoji: '🛺',
    title: 'Ride instantly,\naround your city',
    body: 'Book a Pakyaw — the whole vehicle is yours, just for you.',
  },
  {
    id: '2',
    emoji: '📍',
    title: 'Go where you\nneed to go',
    body: 'Pick your destination and a driver will be on their way.',
  },
  {
    id: '3',
    emoji: '✅',
    title: 'Safe, simple,\naffordable',
    body: 'Pre-verified drivers. Transparent pricing. No surprises.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const setOnboardingSeen = useSessionStore((s) => s.setOnboardingSeen);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function finish() {
    setOnboardingSeen(true);
    router.replace('/welcome');
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
        accessibilityLabel="Skip onboarding"
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
          <Text style={styles.btnLabel}>{isLast ? 'Get started' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgPassenger },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: { fontSize: 15, color: COLORS.ink500, fontWeight: '600' },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    gap: 20,
  },
  illustrationWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.blueTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: { fontSize: 64 },
  slideTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.ink900,
    textAlign: 'center',
    lineHeight: 38,
  },
  slideBody: {
    fontSize: 16,
    color: COLORS.ink500,
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.ink400 },
  dotActive: { width: 24, backgroundColor: COLORS.bluePrimary },
  footer: { paddingHorizontal: 24, paddingBottom: 48 },
  btn: {
    backgroundColor: COLORS.bluePrimary,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
