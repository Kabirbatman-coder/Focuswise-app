import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
  withSpring,
} from 'react-native-reanimated';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';
import { API_CONFIG, getApiUrl } from '@/constants/config';
import { useAuth } from '@/context/AuthContext';
import { useAIOverlay } from '@/context/AIOverlayContext';
import { Skeleton, TaskCardSkeleton } from '@/components/ui/LoadingSkeleton';
import { NoTasksEmpty } from '@/components/ui/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Quick command suggestions
const QUICK_COMMANDS = [
  { icon: 'add-circle', label: 'Create Task', command: 'Create a task to ' },
  { icon: 'calendar', label: 'Schedule', command: 'Schedule a meeting for ' },
  { icon: 'bulb', label: 'Focus Tips', command: 'What should I focus on?' },
  { icon: 'list', label: 'My Tasks', command: 'Show me my tasks' },
  { icon: 'today', label: 'Today', command: "What's on my schedule today?" },
  { icon: 'analytics', label: 'Summary', command: 'Give me a summary of my day' },
];

// Insight cards data type
interface Insight {
  id: string;
  type: 'energy' | 'task' | 'focus' | 'tip';
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  action?: string;
}

// Recent command history type
interface CommandHistory {
  id: string;
  command: string;
  response: string;
  timestamp: string;
  intent?: string;
}

export default function AIChiefScreen() {
  const { user, isAuthenticated, accessToken } = useAuth();
  const { toggle: openAIOverlay } = useAIOverlay();
  const scrollRef = useRef<ScrollView>(null);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recentCommands, setRecentCommands] = useState<CommandHistory[]>([]);
  const [taskCount, setTaskCount] = useState(0);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  
  // Animations
  const orbPulse = useSharedValue(1);
  const orbGlow = useSharedValue(0.5);
  const inputScale = useSharedValue(1);
  
  const userId = user?.id || 'default_user';
  
  // Orb animations
  useEffect(() => {
    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    
    orbGlow.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [orbPulse, orbGlow]);
  
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbPulse.value }],
  }));
  
  const glowStyle = useAnimatedStyle(() => ({
    opacity: orbGlow.value,
  }));
  
  const inputAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));
  
  // Fetch data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      // Fetch tasks count
      const tasksRes = await fetch(getApiUrl('/api/ai/tasks'));
      const tasksData = await tasksRes.json();
      if (tasksData.success) {
        const pendingTasks = tasksData.tasks?.filter((t: any) => t.status !== 'completed') || [];
        setTaskCount(pendingTasks.length);
      }
      
      // Fetch energy profile
      const energyRes = await fetch(getApiUrl(`/api/energy/profile/${userId}`));
      const energyData = await energyRes.json();
      if (energyData.success && energyData.profile?.recentCheckIns?.[0]) {
        setEnergyLevel(energyData.profile.recentCheckIns[0].level);
      }
      
      // Generate insights based on data
      generateInsights(tasksData.tasks || [], energyData.profile);
    } catch (error) {
      console.error('[AIChief] Error fetching data:', error);
    }
  }, [isAuthenticated, userId]);
  
  // Generate contextual insights
  const generateInsights = (tasks: any[], energyProfile: any) => {
    const newInsights: Insight[] = [];
    
    // Energy insight
    if (energyProfile?.peakPeriod) {
      newInsights.push({
        id: 'energy-peak',
        type: 'energy',
        title: 'Your Peak Hours',
        description: `You're most productive during ${formatPeriod(energyProfile.peakPeriod)}. Schedule important work then!`,
        icon: 'flash',
        color: '#8B5CF6',
      });
    } else {
      newInsights.push({
        id: 'energy-tip',
        type: 'tip',
        title: 'Track Your Energy',
        description: 'Log your energy levels to unlock personalized scheduling insights.',
        icon: 'battery-charging',
        color: '#F59E0B',
        action: 'Log Energy',
      });
    }
    
    // Task insights
    const pendingTasks = tasks.filter((t: any) => t.status !== 'completed');
    const highPriorityTasks = pendingTasks.filter((t: any) => t.priority === 'high');
    
    if (highPriorityTasks.length > 0) {
      newInsights.push({
        id: 'high-priority',
        type: 'task',
        title: `${highPriorityTasks.length} High Priority`,
        description: highPriorityTasks.length === 1 
          ? `"${highPriorityTasks[0].title}" needs your attention.`
          : `You have ${highPriorityTasks.length} urgent tasks waiting.`,
        icon: 'flame',
        color: '#EF4444',
        action: 'View Tasks',
      });
    }
    
    // Focus insight
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 11) {
      newInsights.push({
        id: 'focus-morning',
        type: 'focus',
        title: 'Morning Focus Block',
        description: 'Mornings are great for deep work. Start a focus session to maximize productivity.',
        icon: 'shield-checkmark',
        color: '#10B981',
        action: 'Start Focus',
      });
    } else if (hour >= 14 && hour <= 16) {
      newInsights.push({
        id: 'focus-afternoon',
        type: 'focus',
        title: 'Afternoon Energy Dip',
        description: 'Energy typically drops after lunch. Consider lighter tasks or a short break.',
        icon: 'cafe',
        color: '#F59E0B',
      });
    }
    
    // General tip
    if (pendingTasks.length === 0) {
      newInsights.push({
        id: 'tip-tasks',
        type: 'tip',
        title: 'All Caught Up!',
        description: "You don't have any pending tasks. Great job! Plan ahead or enjoy your free time.",
        icon: 'checkmark-circle',
        color: '#10B981',
      });
    }
    
    setInsights(newInsights.slice(0, 3)); // Show max 3 insights
  };
  
  // Format time period
  const formatPeriod = (period: string): string => {
    const periods: Record<string, string> = {
      early_morning: 'early morning (5-7 AM)',
      morning: 'morning (7-10 AM)',
      midday: 'midday (10 AM-1 PM)',
      afternoon: 'afternoon (1-5 PM)',
      evening: 'evening (5-8 PM)',
      night: 'night (8 PM-12 AM)',
    };
    return periods[period] || period;
  };
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  
  // Handle quick command
  const handleQuickCommand = (command: string) => {
    setInputText(command);
    // If it's a complete command (doesn't end with space), send it
    if (!command.endsWith(' ')) {
      sendCommand(command);
    }
  };
  
  // Send command
  const sendCommand = async (command: string) => {
    if (!command.trim()) return;
    
    Keyboard.dismiss();
    setIsLoading(true);
    
    try {
      const response = await fetch(getApiUrl('/api/ai/command'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: command.trim(),
          accessToken,
          userId,
        }),
      });
      
      const result = await response.json();
      
      // Add to recent commands
      const newCommand: CommandHistory = {
        id: Date.now().toString(),
        command: command.trim(),
        response: result.response || 'Command processed',
        timestamp: new Date().toISOString(),
        intent: result.intent,
      };
      
      setRecentCommands(prev => [newCommand, ...prev.slice(0, 4)]);
      setInputText('');
      
      // Refresh data to reflect any changes
      fetchData();
    } catch (error) {
      console.error('[AIChief] Error sending command:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle submit
  const handleSubmit = () => {
    if (inputText.trim()) {
      sendCommand(inputText);
    }
  };
  
  const userName = user?.given_name || user?.name?.split(' ')[0] || 'there';
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.ai_chief.active_ring}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with AI Orb */}
          <Animated.View style={styles.header} entering={FadeIn.duration(600)}>
            {/* Ambient glow */}
            <Animated.View style={[styles.orbGlow, glowStyle]}>
              <LinearGradient
                colors={['rgba(112, 0, 255, 0.3)', 'rgba(0, 199, 252, 0.2)', 'transparent']}
                style={styles.orbGlowGradient}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
            
            {/* AI Orb */}
            <Animated.View style={[styles.orbContainer, orbStyle]}>
              <LinearGradient
                colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
                style={styles.orb}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="sparkles" size={32} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            
            <Text style={styles.greeting}>Hey {userName}</Text>
            <Text style={styles.subtitle}>I'm your Chief of Staff. How can I help?</Text>
            
            {/* Status pills */}
            <View style={styles.statusRow}>
              <View style={styles.statusPill}>
                <Ionicons name="checkbox" size={14} color={Colors.text.secondary} />
                <Text style={styles.statusText}>{taskCount} tasks</Text>
              </View>
              {energyLevel && (
                <View style={styles.statusPill}>
                  <Text style={styles.statusEmoji}>
                    {['😴', '😔', '😐', '😊', '⚡'][energyLevel - 1]}
                  </Text>
                  <Text style={styles.statusText}>Energy {energyLevel}/5</Text>
                </View>
              )}
            </View>
          </Animated.View>
          
          {/* Command Input */}
          <Animated.View 
            style={[styles.inputSection, inputAnimatedStyle]} 
            entering={FadeInUp.delay(200).duration(500)}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Ask me anything..."
                placeholderTextColor={Colors.text.tertiary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSubmit}
                returnKeyType="send"
                multiline={false}
                onFocus={() => {
                  inputScale.value = withSpring(1.02);
                }}
                onBlur={() => {
                  inputScale.value = withSpring(1);
                }}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={handleSubmit}
                disabled={!inputText.trim() || isLoading}
              >
                <LinearGradient
                  colors={inputText.trim() ? [Colors.ai_chief.glow, Colors.ai_chief.active_ring] : ['#333', '#333']}
                  style={styles.sendButtonGradient}
                >
                  <Ionicons
                    name={isLoading ? 'hourglass' : 'send'}
                    size={18}
                    color={inputText.trim() ? '#FFF' : Colors.text.tertiary}
                  />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
          
          {/* Quick Commands */}
          <Animated.View style={styles.section} entering={FadeInUp.delay(300).duration(500)}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickCommandsScroll}
            >
              {QUICK_COMMANDS.map((cmd, index) => (
                <Animated.View key={cmd.label} entering={SlideInRight.delay(100 * index).duration(400)}>
                  <TouchableOpacity
                    style={styles.quickCommandChip}
                    onPress={() => handleQuickCommand(cmd.command)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={cmd.icon as any} size={16} color={Colors.ai_chief.active_ring} />
                    <Text style={styles.quickCommandText}>{cmd.label}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
          </Animated.View>
          
          {/* Insights */}
          {insights.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInUp.delay(400).duration(500)}>
              <Text style={styles.sectionTitle}>Insights</Text>
              {insights.map((insight, index) => (
                <Animated.View
                  key={insight.id}
                  entering={FadeInDown.delay(100 * index).duration(400)}
                >
                  <TouchableOpacity
                    style={[styles.insightCard, { borderLeftColor: insight.color }]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.insightIcon, { backgroundColor: `${insight.color}20` }]}>
                      <Ionicons name={insight.icon} size={20} color={insight.color} />
                    </View>
                    <View style={styles.insightContent}>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Text style={styles.insightDescription}>{insight.description}</Text>
                    </View>
                    {insight.action && (
                      <View style={styles.insightAction}>
                        <Text style={[styles.insightActionText, { color: insight.color }]}>
                          {insight.action}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={insight.color} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </Animated.View>
          )}
          
          {/* Recent Commands */}
          {recentCommands.length > 0 && (
            <Animated.View style={styles.section} entering={FadeInUp.delay(500).duration(500)}>
              <Text style={styles.sectionTitle}>Recent</Text>
              {recentCommands.map((cmd, index) => (
                <Animated.View
                  key={cmd.id}
                  entering={FadeIn.delay(50 * index).duration(300)}
                >
                  <View style={styles.recentCard}>
                    <View style={styles.recentHeader}>
                      <Text style={styles.recentCommand} numberOfLines={1}>
                        {cmd.command}
                      </Text>
                      <Text style={styles.recentTime}>
                        {formatTime(cmd.timestamp)}
                      </Text>
                    </View>
                    <Text style={styles.recentResponse} numberOfLines={2}>
                      {cmd.response}
                    </Text>
                    {cmd.intent && (
                      <View style={styles.intentBadge}>
                        <Text style={styles.intentText}>
                          {cmd.intent.replace(/_/g, ' ')}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </Animated.View>
          )}
          
          {/* Help Section */}
          <Animated.View style={styles.helpSection} entering={FadeIn.delay(600).duration(500)}>
            <TouchableOpacity style={styles.helpCard} onPress={openAIOverlay}>
              <LinearGradient
                colors={['rgba(112, 0, 255, 0.1)', 'rgba(0, 199, 252, 0.05)']}
                style={styles.helpGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="chatbubbles" size={24} color={Colors.ai_chief.active_ring} />
                <View style={styles.helpContent}>
                  <Text style={styles.helpTitle}>Open Full Chat</Text>
                  <Text style={styles.helpDescription}>
                    Have a longer conversation with AI Chief
                  </Text>
    </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.text.tertiary} />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Helper function
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  
  // Header
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    position: 'relative',
  },
  orbGlow: {
    position: 'absolute',
    top: 0,
    width: 200,
    height: 200,
  },
  orbGlowGradient: {
    flex: 1,
    borderRadius: 100,
  },
  orbContainer: {
    marginBottom: Spacing.md,
  },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ai_chief.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  greeting: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    gap: 6,
  },
  statusText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
  },
  statusEmoji: {
    fontSize: 14,
  },
  
  // Input
  inputSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  sendButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  
  // Quick Commands
  quickCommandsScroll: {
    paddingRight: Spacing.lg,
  },
  quickCommandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 199, 252, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 199, 252, 0.2)',
    gap: 6,
  },
  quickCommandText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  
  // Insights
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
    fontWeight: Typography.weights.semibold,
  },
  insightDescription: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 2,
    lineHeight: 18,
  },
  insightAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  insightActionText: {
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.medium,
  },
  
  // Recent Commands
  recentCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  recentCommand: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
    fontWeight: Typography.weights.medium,
    flex: 1,
  },
  recentTime: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption - 1,
    marginLeft: Spacing.sm,
  },
  recentResponse: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
  },
  intentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(112, 0, 255, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  intentText: {
    color: Colors.ai_chief.glow,
    fontSize: 10,
    fontWeight: Typography.weights.medium,
    textTransform: 'capitalize',
  },
  
  // Help Section
  helpSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  helpCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  helpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(112, 0, 255, 0.2)',
    borderRadius: BorderRadius.lg,
  },
  helpContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  helpTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
    fontWeight: Typography.weights.semibold,
  },
  helpDescription: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
});
