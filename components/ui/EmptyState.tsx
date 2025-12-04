import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'minimal' | 'illustrated';
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
}: EmptyStateProps) {
  if (variant === 'minimal') {
    return (
      <Animated.View style={styles.minimalContainer} entering={FadeIn.duration(400)}>
        <Ionicons name={icon} size={32} color={Colors.text.tertiary} />
        <Text style={styles.minimalTitle}>{title}</Text>
        <Text style={styles.minimalDescription}>{description}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity style={styles.minimalAction} onPress={onAction}>
            <Text style={styles.minimalActionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View style={styles.container} entering={FadeIn.duration(500)}>
      <Animated.View style={styles.iconContainer} entering={ZoomIn.delay(100).duration(400)}>
        <LinearGradient
          colors={['rgba(112, 0, 255, 0.15)', 'rgba(0, 199, 252, 0.1)']}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={icon} size={48} color={Colors.ai_chief.active_ring} />
        </LinearGradient>
      </Animated.View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.primaryButton} onPress={onAction} activeOpacity={0.8}>
          <LinearGradient
            colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
      
      {secondaryActionLabel && onSecondaryAction && (
        <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryAction}>
          <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// Pre-built empty states for common scenarios
export function NoTasksEmpty({ onCreateTask }: { onCreateTask?: () => void }) {
  return (
    <EmptyState
      icon="checkbox-outline"
      title="No tasks yet"
      description="Create your first task and let FocusWise help you stay focused and productive."
      actionLabel="Create a Task"
      onAction={onCreateTask}
      secondaryActionLabel="Ask AI to create one"
    />
  );
}

export function NoEventsEmpty({ onSyncCalendar }: { onSyncCalendar?: () => void }) {
  return (
    <EmptyState
      icon="calendar-outline"
      title="No upcoming events"
      description="Your calendar is clear! Add events or sync with Google Calendar to see them here."
      actionLabel="Sync Calendar"
      onAction={onSyncCalendar}
    />
  );
}

export function NoEnergyDataEmpty({ onLogEnergy }: { onLogEnergy?: () => void }) {
  return (
    <EmptyState
      icon="battery-half-outline"
      title="Start tracking energy"
      description="Log your energy levels throughout the day to unlock personalized scheduling and insights."
      actionLabel="Log Energy Now"
      onAction={onLogEnergy}
    />
  );
}

export function NoScheduleEmpty({ onCreateTask }: { onCreateTask?: () => void }) {
  return (
    <EmptyState
      icon="time-outline"
      title="Nothing scheduled"
      description="Add tasks and log your energy to get AI-powered scheduling recommendations."
      actionLabel="Add Tasks"
      onAction={onCreateTask}
      variant="minimal"
    />
  );
}

export function SearchEmpty({ query }: { query: string }) {
  return (
    <EmptyState
      icon="search-outline"
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try a different search term.`}
      variant="minimal"
    />
  );
}

export function ConnectionErrorEmpty({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Connection issue"
      description="We're having trouble connecting to the server. Please check your internet connection and try again."
      actionLabel="Retry"
      onAction={onRetry}
    />
  );
}

export function SignInRequiredEmpty({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <EmptyState
      icon="log-in-outline"
      title="Sign in required"
      description="Sign in with Google to access this feature and sync your data across devices."
      actionLabel="Sign In"
      onAction={onSignIn}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
    maxWidth: 300,
  },
  primaryButton: {
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  buttonGradient: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.body - 1,
    fontWeight: Typography.weights.medium,
  },
  
  // Minimal variant
  minimalContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  minimalTitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  minimalDescription: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 18,
    maxWidth: 280,
  },
  minimalAction: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  minimalActionText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
});

