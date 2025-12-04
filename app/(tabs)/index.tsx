import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Pressable, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  SlideInRight,
  SlideInUp,
  ZoomIn,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from 'react-native-svg';

import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';

// Create animated SVG Circle component for Reanimated
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ImpactScore = 'high' | 'med';
type EnergyReq = 'high' | 'med' | 'low';

type Task = {
  id: string;
  title: string;
  impact_score: ImpactScore;
  energy_req: EnergyReq;
  duration: string;
  ai_reasoning: string;
};

type MockData = {
  userName: string;
  focusScore: number;
  tasks: Task[];
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARC_SIZE = Math.min(SCREEN_WIDTH * 0.7, 260);
const ARC_RADIUS = ARC_SIZE / 2 - 14;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const ARC_SWEEP = 0.75; // 270 degrees

const mockData: MockData = {
  userName: 'Kabir',
  focusScore: 82,
  tasks: [
    {
      id: '1',
      title: 'Deep work: Outline FocusWise product narrative',
      impact_score: 'high',
      energy_req: 'high',
      duration: '90 min',
      ai_reasoning: 'High Impact & High Energy Match.',
    },
    {
      id: '2',
      title: 'Reply to priority investor emails',
      impact_score: 'high',
      energy_req: 'med',
      duration: '30 min',
      ai_reasoning: 'Time-sensitive and unblocks external stakeholders.',
    },
    {
      id: '3',
      title: 'Plan tomorrow\'s deep work blocks',
      impact_score: 'med',
      energy_req: 'low',
      duration: '20 min',
      ai_reasoning: 'Improves tomorrow’s execution quality with minimal effort.',
    },
    {
      id: '4',
      title: 'Review latest PES energy pattern insights',
      impact_score: 'med',
      energy_req: 'med',
      duration: '25 min',
      ai_reasoning: 'Aligns your schedule with your current energy signature.',
    },
    {
      id: '5',
      title: 'Tidy up backlog: close or reschedule stale tasks',
      impact_score: 'med',
      energy_req: 'low',
      duration: '30 min',
      ai_reasoning: 'Reduces cognitive load and keeps your system clean.',
    },
    {
      id: '6',
      title: 'Light admin: inbox triage and calendar clean-up',
      impact_score: 'med',
      energy_req: 'low',
      duration: '20 min',
      ai_reasoning: 'Good recovery activity that still moves the day forward.',
    },
  ],
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topTask = useMemo(() => mockData.tasks[0], []);
  const upNextTasks = useMemo(() => mockData.tasks.slice(1, 6), []);

  // Ambient background "breathing" glow behind the focus metric
  const ambientOpacity = useSharedValue(0.35);

  // Arc progress (0 → score)
  const arcProgress = useSharedValue(0);

  // Press feedback for Start Focus button
  const startFocusScale = useSharedValue(1);

  useEffect(() => {
    ambientOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    arcProgress.value = withTiming(mockData.focusScore / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [ambientOpacity, arcProgress]);

  const ambientStyle = useAnimatedStyle(() => ({
    opacity: ambientOpacity.value,
  }));

  const arcAnimatedProps = useAnimatedProps(() => {
    const visibleLength = ARC_CIRCUMFERENCE * ARC_SWEEP * arcProgress.value;
    return {
      strokeDasharray: `${visibleLength} ${ARC_CIRCUMFERENCE}`,
      strokeDashoffset: ARC_CIRCUMFERENCE * 0.25,
    };
  });

  const startFocusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: startFocusScale.value }],
  }));

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={styles.headerContainer}
          entering={FadeIn.duration(500)}
        >
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.03)',
              'rgba(255, 255, 255, 0.01)',
              'rgba(0, 0, 0, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              'rgba(0, 0, 0, 0)',
              Colors.ai_chief.glow,
              'rgba(0, 0, 0, 0)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGlow}
          />
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greetingLabel}>Good Morning,</Text>
              <Text style={styles.greetingName}>{mockData.userName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Link href="/modal" asChild>
                <TouchableOpacity>
                   <Ionicons name="settings-outline" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </Link>
              <View style={styles.headerAvatar}>
                 <LinearGradient
                  colors={[Colors.ai_chief.active_ring, Colors.ai_chief.glow]}
                  style={styles.avatarGradient}
                 >
                   <Text style={styles.avatarText}>{mockData.userName.charAt(0)}</Text>
                 </LinearGradient>
              </View>
            </View>
          </View>
        </Animated.View>

          {/* Metric: Daily Focus Score - Refined Deep Sea HUD */}
        <Animated.View
          style={styles.metricContainer}
          entering={ZoomIn.duration(600)}
        >
          {/* Subtle Ambient Glow - reduced intensity, shifted to Cyan/Deep Blue */}
          <Animated.View style={[styles.ambientGlow, ambientStyle]}>
            <LinearGradient
              colors={['rgba(0, 240, 255, 0.15)', 'rgba(112, 0, 255, 0.05)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.ambientGlowGradient}
            />
          </Animated.View>

          <View style={styles.metricArcWrapper}>
            <View style={styles.metricArcShadow}>
              <Svg width={ARC_SIZE} height={ARC_SIZE} viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}>
                <Defs>
                  <SvgLinearGradient id="focusArcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#7000FF" />
                    <Stop offset="100%" stopColor="#00F0FF" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="trackGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                     <Stop offset="0%" stopColor="rgba(255,255,255,0.03)" />
                     <Stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
                  </SvgLinearGradient>
                </Defs>
                
                {/* Outer decorative thin ring */}
                 <Circle
                  cx={ARC_SIZE / 2}
                  cy={ARC_SIZE / 2}
                  r={ARC_RADIUS + 10}
                  stroke="rgba(255,255,255,0.03)"
                  strokeWidth={1}
                  strokeDasharray="4, 8"
                  fill="transparent"
                />

                {/* Background Track */}
                <Circle
                  cx={ARC_SIZE / 2}
                  cy={ARC_SIZE / 2}
                  r={ARC_RADIUS}
                  stroke="url(#trackGrad)"
                  strokeWidth={4}
                  strokeDasharray={`${ARC_CIRCUMFERENCE * ARC_SWEEP} ${ARC_CIRCUMFERENCE}`}
                  strokeDashoffset={ARC_CIRCUMFERENCE * 0.25}
                  strokeLinecap="round"
                  fill="transparent"
                />
                
                {/* Progress Arc */}
                <AnimatedCircle
                  cx={ARC_SIZE / 2}
                  cy={ARC_SIZE / 2}
                  r={ARC_RADIUS}
                  stroke="url(#focusArcGrad)"
                  strokeWidth={8}
                  strokeLinecap="round"
                  fill="transparent"
                  animatedProps={arcAnimatedProps}
                />
              </Svg>
            </View>
            
            <View style={styles.metricContent}>
              <View style={styles.metricBadgePill}>
                 {/* Improved contrast pill */}
                <Text style={styles.metricBadgeText}>HIGH ENERGY FLOW</Text>
              </View>
              <Text style={styles.metricLabel}>DAILY FOCUS SCORE</Text>
              <View style={styles.metricRow}>
                <Text style={styles.metricValue}>{mockData.focusScore}</Text>
                <Text style={styles.metricUnit}>%</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Chief's Choice - Hero Card */}
        <Animated.View
          style={styles.sectionSpacing}
          entering={SlideInUp.duration(500).delay(100)}
        >
          <Text style={styles.sectionTitle}>The Chief&apos;s Choice</Text>
          <Animated.View
            style={styles.heroCardOuter}
            // Subtle pulsing glow on the hero card border
            entering={FadeIn.duration(500)}
          >
            <LinearGradient
              colors={[
                'rgba(112, 0, 255, 0.35)',
                Colors.ai_chief.active_ring,
                'rgba(0, 0, 0, 0.9)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardBorder}
            >
              <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>{topTask.title}</Text>
                <View style={styles.heroMetaRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{topTask.ai_reasoning}</Text>
                  </View>
                  <View style={styles.chipRow}>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        Impact: {topTask.impact_score.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>
                        Energy: {topTask.energy_req.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.chip}>
                      <Text style={styles.chipText}>{topTask.duration}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.heroFooterRow}>
                  <Text style={styles.heroSubLabel}>Designed to match your current PES peak.</Text>
                  <Pressable
                    onPressIn={() => {
                      startFocusScale.value = withTiming(0.95, { duration: 80 });
                    }}
                    onPressOut={() => {
                      startFocusScale.value = withTiming(1, { duration: 80 });
                    }}
                  >
                    <Animated.View style={[styles.primaryButton, startFocusStyle]}>
                      <Text style={styles.primaryButtonText}>Start Focus</Text>
                    </Animated.View>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </Animated.View>

        {/* Up Next */}
        <Animated.View
          style={styles.sectionSpacing}
          entering={SlideInRight.duration(500).delay(200)}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Up Next</Text>
            <Text style={styles.sectionSubtitle}>Curated by your Chief of Staff</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.upNextScroll}
          >
            {upNextTasks.map((task) => (
              <TouchableOpacity key={task.id} activeOpacity={0.8}>
                <LinearGradient
                  colors={[
                    Colors.glassmorphism.color,
                    'rgba(0, 0, 0, 0.95)',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.upNextCard}
                >
                  <View style={styles.upNextCardInner}>
                    <Text style={styles.upNextTitle} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <Text style={styles.upNextReason} numberOfLines={2}>
                      {task.ai_reasoning}
                    </Text>
                    <View style={styles.upNextMetaRow}>
                      <Text style={styles.upNextMeta}>{task.duration}</Text>
                      <View style={styles.upNextDot} />
                      <Text style={styles.upNextMeta}>
                        {task.impact_score.toUpperCase()} • {task.energy_req.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl * 2.2, // extra space so content never hides behind tab bar on phones
  },
  headerContainer: {
    marginBottom: Spacing.xl,
    overflow: 'hidden',
    borderRadius: BorderRadius.lg,
  },
  headerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
  },
  headerContent: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)', // Slightly more transparent to show gradient
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarGradient: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 20,
  },
  greetingLabel: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
  },
  greetingName: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.xs,
  },
  metricContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  ambientGlow: {
    position: 'absolute',
    width: ARC_SIZE * 1.4,
    height: ARC_SIZE * 1.4,
    borderRadius: (ARC_SIZE * 1.4) / 2,
    top: -Spacing.lg,
    alignSelf: 'center',
  },
  ambientGlowGradient: {
    flex: 1,
    borderRadius: (ARC_SIZE * 1.4) / 2,
  },
  metricArcWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricArcShadow: {
    shadowColor: Colors.pes_energy.high_end,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 18,
  },
  metricContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricBadgePill: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker background for contrast
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: Spacing.sm,
  },
  metricBadgeText: {
    color: Colors.pes_energy.high_end, // Cyan for "High Energy"
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline', // Better alignment
  },
  metricValue: {
    color: Colors.text.primary,
    fontSize: 72, // Slightly larger
    fontWeight: '300', // Thinner but larger can be more readable if cleaner
    letterSpacing: -2,
    textShadowColor: 'rgba(0, 240, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  metricUnit: {
    color: Colors.text.secondary,
    fontSize: 20,
    marginLeft: 4,
    fontWeight: '500',
  },
  metricLabel: {
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: Spacing.xs,
    marginBottom: -Spacing.xs, // Pull closer to the number
  },
  sectionSpacing: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.md,
  },
  heroCardOuter: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.ai_chief.active_ring,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  heroCardBorder: {
    borderRadius: BorderRadius.lg,
    padding: 1,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background.secondary,
    padding: Spacing.lg,
  },
  heroTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.md,
  },
  heroMetaRow: {
    marginBottom: Spacing.lg,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0,199,252,0.15)',
    marginBottom: Spacing.sm,
  },
  badgeText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.background.tertiary,
  },
  chipText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  heroSubLabel: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
  },
  primaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.text.primary,
  },
  primaryButtonText: {
    color: Colors.background.primary,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
  },
  upNextScroll: {
    paddingRight: Spacing.lg,
  },
  upNextCard: {
    width: 220,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  upNextCardInner: {
    padding: Spacing.md,
  },
  upNextTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
    marginBottom: Spacing.sm,
  },
  upNextReason: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginBottom: Spacing.md,
  },
  upNextMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  upNextMeta: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
  },
  upNextDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.text.tertiary,
  },
});
