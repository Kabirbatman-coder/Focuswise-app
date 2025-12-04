import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { APP_CONFIG } from '@/constants/config';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColors: [string, string];
  title: string;
  description: string;
  feature?: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'sparkles',
    iconColors: [Colors.ai_chief.glow, Colors.ai_chief.active_ring],
    title: 'Meet Your AI Chief of Staff',
    description: 'FocusWise acts like a personal assistant in your pocket — scheduling, prioritizing, and protecting your focus automatically.',
    feature: 'Just tell me what you need to do',
  },
  {
    id: '2',
    icon: 'battery-charging',
    iconColors: ['#8B5CF6', '#EC4899'],
    title: 'Personal Energy Signature',
    description: 'Track your energy throughout the day. FocusWise learns your patterns and schedules tasks when you\'re at your best.',
    feature: 'Log energy in seconds with emoji check-ins',
  },
  {
    id: '3',
    icon: 'calendar',
    iconColors: ['#10B981', '#06B6D4'],
    title: 'Smart Auto-Scheduling',
    description: 'Your calendar meets your energy profile. High-impact work goes to peak hours. Admin tasks fill the gaps.',
    feature: 'Syncs with Google Calendar',
  },
  {
    id: '4',
    icon: 'shield-checkmark',
    iconColors: ['#F59E0B', '#EF4444'],
    title: 'Distraction Shield',
    description: 'Block distracting apps during focus sessions. Stay in the zone and protect your deep work time.',
    feature: 'Intelligent blocking that adapts to you',
  },
  {
    id: '5',
    icon: 'rocket',
    iconColors: ['#00C7FC', '#7000FF'],
    title: 'Ready to Transform Your Day?',
    description: 'Let\'s set up your FocusWise experience. It only takes a minute.',
    feature: 'Your day runs itself',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Animation values
  const buttonScale = useSharedValue(1);
  
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
  // Handle next
  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };
  
  // Handle skip
  const handleSkip = () => {
    completeOnboarding();
  };
  
  // Complete onboarding
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(APP_CONFIG.STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('[Onboarding] Error saving:', error);
      router.replace('/(tabs)');
    }
  };
  
  // Handle scroll
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;
  
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  
  // Render slide
  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={styles.slide}>
      {/* Background decoration */}
      <View style={styles.backgroundDecoration}>
        <LinearGradient
          colors={[`${item.iconColors[0]}15`, 'transparent']}
          style={styles.decorationGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
      
      {/* Icon */}
      <Animated.View
        style={styles.iconContainer}
        entering={FadeInDown.delay(200).duration(600).springify()}
      >
        <LinearGradient
          colors={item.iconColors}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={item.icon} size={48} color="#FFF" />
        </LinearGradient>
        
        {/* Decorative rings */}
        <View style={[styles.iconRing, styles.iconRingOuter, { borderColor: `${item.iconColors[0]}30` }]} />
        <View style={[styles.iconRing, styles.iconRingInner, { borderColor: `${item.iconColors[1]}20` }]} />
      </Animated.View>
      
      {/* Content */}
      <Animated.View
        style={styles.content}
        entering={FadeInUp.delay(400).duration(500)}
      >
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        
        {item.feature && (
          <View style={styles.featurePill}>
            <Ionicons name="checkmark-circle" size={16} color={item.iconColors[0]} />
            <Text style={[styles.featureText, { color: item.iconColors[0] }]}>
              {item.feature}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
  
  const isLastSlide = currentIndex === SLIDES.length - 1;
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Skip button */}
      {!isLastSlide && (
        <Animated.View style={styles.skipContainer} entering={FadeIn.delay(800)}>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      
      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />
      
      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Progress dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
                index === currentIndex && { backgroundColor: SLIDES[currentIndex]?.iconColors[0] },
              ]}
            />
          ))}
        </View>
        
        {/* Action button */}
        <Animated.View style={buttonAnimatedStyle}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            onPressIn={() => {
              buttonScale.value = withSpring(0.95);
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1);
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={SLIDES[currentIndex]?.iconColors || [Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
              style={styles.nextButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {isLastSlide ? (
                <>
                  <Text style={styles.nextButtonText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" />
                </>
              ) : (
                <>
                  <Text style={styles.nextButtonText}>Continue</Text>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Page indicator text */}
        <Text style={styles.pageIndicator}>
          {currentIndex + 1} of {SLIDES.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  skipContainer: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  
  // Slide
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
  },
  decorationGradient: {
    flex: 1,
  },
  
  // Icon
  iconContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ai_chief.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  iconRing: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 100,
  },
  iconRingOuter: {
    width: 140,
    height: 140,
  },
  iconRingInner: {
    width: 160,
    height: 160,
  },
  
  // Content
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.bold,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 36,
  },
  description: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: Spacing.lg,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  
  // Bottom section
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.tertiary,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
  },
  
  // Button
  nextButton: {
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    shadowColor: Colors.ai_chief.glow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl * 1.5,
    gap: Spacing.sm,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  pageIndicator: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    marginTop: Spacing.md,
  },
});

