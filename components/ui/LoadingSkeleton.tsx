import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// Base skeleton component with shimmer effect
export function Skeleton({ width = '100%', height = 20, borderRadius = BorderRadius.sm, style }: SkeletonProps) {
  const shimmerPosition = useSharedValue(0);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false
    );
  }, [shimmerPosition]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmerPosition.value, [0, 1], [-100, 100]);
    return {
      transform: [{ translateX: translateX as number }],
    };
  });

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmerContainer, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

// Task card skeleton
export function TaskCardSkeleton() {
  return (
    <View style={styles.taskCard}>
      <View style={styles.taskLeft}>
        <Skeleton width={24} height={24} borderRadius={12} />
        <View style={styles.taskInfo}>
          <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
      <Skeleton width={28} height={28} borderRadius={14} />
    </View>
  );
}

// Task list skeleton
export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.taskList}>
      {Array.from({ length: count }).map((_, index) => (
        <TaskCardSkeleton key={index} />
      ))}
    </View>
  );
}

// Calendar event skeleton
export function CalendarEventSkeleton() {
  return (
    <View style={styles.calendarEvent}>
      <View style={styles.eventTime}>
        <Skeleton width={50} height={14} />
        <Skeleton width={6} height={6} borderRadius={3} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.eventContent}>
        <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
  );
}

// Calendar list skeleton
export function CalendarListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.calendarList}>
      {Array.from({ length: count }).map((_, index) => (
        <CalendarEventSkeleton key={index} />
      ))}
    </View>
  );
}

// Schedule card skeleton for home screen
export function ScheduleCardSkeleton() {
  return (
    <View style={styles.scheduleCard}>
      <View style={styles.scheduleTime}>
        <Skeleton width={60} height={14} />
        <Skeleton width={6} height={6} borderRadius={3} style={{ marginTop: 4 }} />
      </View>
      <View style={styles.scheduleContent}>
        <Skeleton width="75%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="90%" height={12} />
      </View>
    </View>
  );
}

// Home screen hero skeleton
export function HeroCardSkeleton() {
  return (
    <View style={styles.heroCard}>
      <Skeleton width="85%" height={20} style={{ marginBottom: 12 }} />
      <Skeleton width="60%" height={14} style={{ marginBottom: 16 }} />
      <View style={styles.heroChips}>
        <Skeleton width={80} height={24} borderRadius={BorderRadius.pill} />
        <Skeleton width={80} height={24} borderRadius={BorderRadius.pill} />
        <Skeleton width={60} height={24} borderRadius={BorderRadius.pill} />
      </View>
      <View style={styles.heroFooter}>
        <Skeleton width="50%" height={12} />
        <Skeleton width={100} height={36} borderRadius={BorderRadius.pill} />
      </View>
    </View>
  );
}

// Energy card skeleton
export function EnergyCardSkeleton() {
  return (
    <View style={styles.energyCard}>
      <Skeleton width="50%" height={16} style={{ marginBottom: 12 }} />
      <View style={styles.energyBars}>
        {Array.from({ length: 7 }).map((_, index) => (
          <View key={index} style={styles.energyBarColumn}>
            <Skeleton width={24} height={40 + Math.random() * 40} borderRadius={4} />
            <Skeleton width={16} height={10} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Full screen loading skeleton
export function FullScreenSkeleton({ type = 'tasks' }: { type?: 'tasks' | 'calendar' | 'energy' }) {
  return (
    <View style={styles.fullScreen}>
      <View style={styles.fullScreenHeader}>
        <Skeleton width={120} height={28} />
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>
      
      {type === 'tasks' && <TaskListSkeleton />}
      {type === 'calendar' && <CalendarListSkeleton />}
      {type === 'energy' && <EnergyCardSkeleton />}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmerGradient: {
    flex: 1,
    width: '100%',
  },
  
  // Task styles
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  taskList: {
    paddingHorizontal: Spacing.lg,
  },
  
  // Calendar styles
  calendarEvent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
  },
  eventTime: {
    alignItems: 'center',
    marginRight: Spacing.md,
    width: 60,
  },
  eventContent: {
    flex: 1,
  },
  calendarList: {
    paddingHorizontal: Spacing.lg,
  },
  
  // Schedule styles
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  scheduleTime: {
    alignItems: 'center',
    marginRight: Spacing.md,
    minWidth: 60,
  },
  scheduleContent: {
    flex: 1,
  },
  
  // Hero card styles
  heroCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  heroChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  // Energy styles
  energyCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
  },
  energyBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  energyBarColumn: {
    alignItems: 'center',
    flex: 1,
  },
  
  // Full screen styles
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    paddingTop: Spacing.lg,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
});

