import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { useAuth } from '@/context/AuthContext';

import { getApiUrl, ENERGY_CONFIG } from '@/constants/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Energy level config
const ENERGY_LEVELS = [
  { level: 1, emoji: '😴', label: 'Very Low', color: '#6B7280', description: 'Need rest' },
  { level: 2, emoji: '😔', label: 'Low', color: '#EF4444', description: 'Feeling tired' },
  { level: 3, emoji: '😐', label: 'Moderate', color: '#F59E0B', description: 'Doing okay' },
  { level: 4, emoji: '😊', label: 'Good', color: '#10B981', description: 'Feeling productive' },
  { level: 5, emoji: '⚡', label: 'Peak', color: '#8B5CF6', description: 'Maximum energy!' },
];

interface EnergyProfile {
  averages: {
    early_morning: number | null;
    morning: number | null;
    midday: number | null;
    afternoon: number | null;
    evening: number | null;
    night: number | null;
  };
  confidence: {
    early_morning: number;
    morning: number;
    midday: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  peakPeriod: string | null;
  peakPeriodFormatted: string | null;
  lowPeriod: string | null;
  lowPeriodFormatted: string | null;
  totalCheckIns: number;
  lastCheckIn: string | null;
  weeklyTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  recentCheckIns: any[];
  patterns: EnergyPattern[];
  suggestions: DailySuggestion;
  profileStrength: number;
  weekdayAnalysis?: WeekdayAnalysis;
}

interface EnergyPattern {
  type: string;
  description: string;
  strength: number;
  insight: string;
}

interface DailySuggestion {
  bestTimeForDeepWork: { period: string; confidence: number };
  bestTimeForMeetings: { period: string; confidence: number };
  warningPeriods: { period: string; reason: string }[];
  personalizedTip: string;
}

interface WeekdayAnalysis {
  bestDay: { day: string; avgEnergy: number };
  worstDay: { day: string; avgEnergy: number };
  weekdayAverage: number;
  weekendAverage: number;
}

interface EnergyTrend {
  date: string;
  averageLevel: number;
  checkInCount: number;
}

export default function EnergyScreen() {
  const { user, isAuthenticated } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [isLogging, setIsLogging] = useState(false);
  const [profile, setProfile] = useState<EnergyProfile | null>(null);
  const [trends, setTrends] = useState<EnergyTrend[]>([]);
  const [todayCheckIns, setTodayCheckIns] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const userId = user?.id || 'default_user';
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch all data - simplified without useCallback to avoid loops
  const fetchAllData = async () => {
    try {
      const [profileRes, trendsRes, todayRes] = await Promise.all([
        fetch(getApiUrl(`/api/energy/profile/${userId}`)),
        fetch(getApiUrl(`/api/energy/trends/${userId}?days=7`)),
        fetch(getApiUrl(`/api/energy/today/${userId}`)),
      ]);
      
      const [profileData, trendsData, todayData] = await Promise.all([
        profileRes.json(),
        trendsRes.json(),
        todayRes.json(),
      ]);
      
      if (profileData.success) setProfile(profileData.profile);
      if (trendsData.success) setTrends(trendsData.trends);
      if (todayData.success) setTodayCheckIns(todayData.count);
    } catch (error) {
      console.error('[Energy] Error fetching data:', error);
    }
  };

  // Initial fetch - only once
  useEffect(() => {
    if (isAuthenticated && !hasFetched) {
      setHasFetched(true);
      fetchAllData();
    }
  }, [isAuthenticated, hasFetched]);

  // Refresh all data
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  // Handle energy level selection
  const handleSelectLevel = (level: number) => {
    setSelectedLevel(level);
    
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  // Log energy check-in
  const handleLogEnergy = async () => {
    if (!selectedLevel) return;
    
    setIsLogging(true);
    
    try {
      const response = await fetch(getApiUrl('/api/energy/quick-checkin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          level: selectedLevel,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show success animation
        setShowSuccess(true);
        Animated.sequence([
          Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(1500),
          Animated.timing(successAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => {
          setShowSuccess(false);
          setSelectedLevel(null);
        });
        
        // Refresh data
        fetchAllData();
      }
    } catch (error) {
      console.error('[Energy] Error logging energy:', error);
    } finally {
      setIsLogging(false);
    }
  };

  // Get trend icon
  const getTrendIcon = () => {
    if (!profile) return 'analytics-outline';
    switch (profile.weeklyTrend) {
      case 'improving': return 'trending-up';
      case 'declining': return 'trending-down';
      case 'stable': return 'remove';
      default: return 'analytics-outline';
    }
  };

  // Get trend color
  const getTrendColor = () => {
    if (!profile) return Colors.text.secondary;
    switch (profile.weeklyTrend) {
      case 'improving': return '#10B981';
      case 'declining': return '#EF4444';
      case 'stable': return '#F59E0B';
      default: return Colors.text.secondary;
    }
  };

  // Render mini bar chart for trends
  const renderTrendChart = () => {
    if (trends.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={32} color={Colors.text.tertiary} />
          <Text style={styles.emptyChartText}>Log energy to see trends</Text>
        </View>
      );
    }

    const maxLevel = 5;
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartBars}>
          {trends.slice(-7).map((trend, index) => {
            const height = (trend.averageLevel / maxLevel) * 80;
            const color = trend.averageLevel >= 4 ? '#10B981' : 
                         trend.averageLevel >= 3 ? '#F59E0B' : '#EF4444';
            
            return (
              <View key={index} style={styles.barColumn}>
                <View style={[styles.bar, { height, backgroundColor: color }]} />
                <Text style={styles.barLabel}>
                  {new Date(trend.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // Render time period averages
  const renderTimePeriodAverages = () => {
    if (!profile) return null;
    
    const periods = [
      { key: 'morning', label: '🌅 Morning', time: '7-10 AM' },
      { key: 'midday', label: '☀️ Midday', time: '10AM-1PM' },
      { key: 'afternoon', label: '🌤 Afternoon', time: '1-5 PM' },
      { key: 'evening', label: '🌆 Evening', time: '5-8 PM' },
    ];
    
    return (
      <View style={styles.periodsContainer}>
        {periods.map((period) => {
          const avg = profile.averages[period.key as keyof typeof profile.averages];
          const displayAvg = avg !== null ? avg.toFixed(1) : '-';
          const isPeak = profile.peakPeriod === period.key;
          const isLow = profile.lowPeriod === period.key;
          
          return (
            <View 
              key={period.key} 
              style={[
                styles.periodCard,
                isPeak && styles.peakPeriodCard,
                isLow && styles.lowPeriodCard,
              ]}
            >
              <Text style={styles.periodEmoji}>{period.label.split(' ')[0]}</Text>
              <Text style={styles.periodAvg}>{displayAvg}</Text>
              <Text style={styles.periodTime}>{period.time}</Text>
              {isPeak && <Text style={styles.peakBadge}>⚡ Peak</Text>}
              {isLow && <Text style={styles.lowBadge}>💤 Low</Text>}
            </View>
          );
        })}
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="battery-half-outline" size={64} color={Colors.text.tertiary} />
          <Text style={styles.signInPrompt}>Sign in to track your energy</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.text.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Energy Check-In</Text>
          <Text style={styles.subtitle}>How's your energy right now?</Text>
        </View>

        {/* Energy Level Selector */}
        <View style={styles.selectorContainer}>
          <Animated.View style={[styles.emojiRow, { transform: [{ scale: scaleAnim }] }]}>
            {ENERGY_LEVELS.map((item) => (
              <TouchableOpacity
                key={item.level}
                style={[
                  styles.emojiButton,
                  selectedLevel === item.level && styles.emojiButtonSelected,
                  selectedLevel === item.level && { borderColor: item.color },
                ]}
                onPress={() => handleSelectLevel(item.level)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                {selectedLevel === item.level && (
                  <View style={[styles.levelIndicator, { backgroundColor: item.color }]}>
                    <Text style={styles.levelNumber}>{item.level}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </Animated.View>
          
          {/* Selected level info */}
          {selectedLevel && (
            <View style={styles.selectedInfo}>
              <Text style={[styles.selectedLabel, { color: ENERGY_LEVELS[selectedLevel - 1]?.color }]}>
                {ENERGY_LEVELS[selectedLevel - 1]?.label}
              </Text>
              <Text style={styles.selectedDescription}>
                {ENERGY_LEVELS[selectedLevel - 1]?.description}
              </Text>
            </View>
          )}

          {/* Log Button */}
          <TouchableOpacity
            style={[
              styles.logButton,
              !selectedLevel && styles.logButtonDisabled,
            ]}
            onPress={handleLogEnergy}
            disabled={!selectedLevel || isLogging}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={selectedLevel ? ['#8B5CF6', '#6366F1'] : ['#374151', '#374151']}
              style={styles.logButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.logButtonText}>
                {isLogging ? 'Logging...' : 'Log Energy'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.todayCount}>
            {todayCheckIns} check-in{todayCheckIns !== 1 ? 's' : ''} today
          </Text>
        </View>

        {/* Success Animation */}
        {showSuccess && (
          <Animated.View style={[styles.successOverlay, { opacity: successAnim }]}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successText}>Energy Logged!</Text>
          </Animated.View>
        )}

        {/* Weekly Trend Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly Trend</Text>
            <View style={styles.trendBadge}>
              <Ionicons name={getTrendIcon() as any} size={16} color={getTrendColor()} />
              <Text style={[styles.trendText, { color: getTrendColor() }]}>
                {profile?.weeklyTrend?.replace('_', ' ') || 'No data'}
              </Text>
            </View>
          </View>
          {renderTrendChart()}
        </View>

        {/* Time Period Insights */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Energy by Time of Day</Text>
            <Ionicons name="time-outline" size={18} color={Colors.text.secondary} />
          </View>
          {profile?.totalCheckIns && profile.totalCheckIns > 0 ? (
            renderTimePeriodAverages()
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Log your energy throughout the day to discover your peak hours!
              </Text>
            </View>
          )}
        </View>

        {/* Stats Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Your Stats</Text>
            <Ionicons name="stats-chart-outline" size={18} color={Colors.text.secondary} />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.totalCheckIns || 0}</Text>
              <Text style={styles.statLabel}>Total Check-Ins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {profile?.peakPeriod ? profile.peakPeriod.split('_').map(w => w[0]?.toUpperCase()).join('') : '-'}
              </Text>
              <Text style={styles.statLabel}>Peak Time</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {profile?.recentCheckIns?.[0]?.level || '-'}
              </Text>
              <Text style={styles.statLabel}>Last Level</Text>
            </View>
          </View>
        </View>

        {/* AI Suggestions Card (NEW) */}
        {profile?.suggestions && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🎯 AI Suggestions</Text>
              <View style={styles.profileStrength}>
                <Text style={styles.profileStrengthText}>{profile.profileStrength || 0}%</Text>
              </View>
            </View>
            
            <View style={styles.suggestionRow}>
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionLabel}>Best for Deep Work</Text>
                <Text style={styles.suggestionValue}>
                  {formatPeriodName(profile.suggestions.bestTimeForDeepWork?.period)}
                </Text>
                <View style={styles.confidenceBar}>
                  <View style={[styles.confidenceFill, { 
                    width: `${(profile.suggestions.bestTimeForDeepWork?.confidence || 0) * 100}%`,
                    backgroundColor: '#10B981'
                  }]} />
                </View>
              </View>
              
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionLabel}>Best for Meetings</Text>
                <Text style={styles.suggestionValue}>
                  {formatPeriodName(profile.suggestions.bestTimeForMeetings?.period)}
                </Text>
                <View style={styles.confidenceBar}>
                  <View style={[styles.confidenceFill, { 
                    width: `${(profile.suggestions.bestTimeForMeetings?.confidence || 0) * 100}%`,
                    backgroundColor: '#6366F1'
                  }]} />
                </View>
              </View>
            </View>
            
            {profile.suggestions.personalizedTip && (
              <View style={styles.personalTip}>
                <Ionicons name="sparkles" size={16} color="#F59E0B" />
                <Text style={styles.personalTipText}>{profile.suggestions.personalizedTip}</Text>
              </View>
            )}
          </View>
        )}

        {/* Patterns Card (NEW) */}
        {profile?.patterns && profile.patterns.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>🔍 Detected Patterns</Text>
              <Ionicons name="analytics" size={18} color={Colors.text.secondary} />
            </View>
            
            {profile.patterns.slice(0, 3).map((pattern, index) => (
              <View key={index} style={styles.patternItem}>
                <View style={styles.patternHeader}>
                  <Text style={styles.patternType}>{formatPatternType(pattern.type)}</Text>
                  <View style={[styles.patternStrength, { opacity: pattern.strength }]}>
                    <Text style={styles.patternStrengthText}>
                      {Math.round(pattern.strength * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.patternInsight}>{pattern.insight}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Weekday Analysis Card (NEW) */}
        {profile?.weekdayAnalysis && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>📅 Weekday Analysis</Text>
            </View>
            
            <View style={styles.weekdayRow}>
              <View style={styles.weekdayItem}>
                <Text style={styles.weekdayLabel}>Best Day</Text>
                <Text style={[styles.weekdayValue, { color: '#10B981' }]}>
                  {profile.weekdayAnalysis.bestDay?.day || '-'}
                </Text>
                <Text style={styles.weekdayEnergy}>
                  {profile.weekdayAnalysis.bestDay?.avgEnergy?.toFixed(1) || '-'}/5
                </Text>
              </View>
              
              <View style={styles.weekdayDivider} />
              
              <View style={styles.weekdayItem}>
                <Text style={styles.weekdayLabel}>Challenging Day</Text>
                <Text style={[styles.weekdayValue, { color: '#EF4444' }]}>
                  {profile.weekdayAnalysis.worstDay?.day || '-'}
                </Text>
                <Text style={styles.weekdayEnergy}>
                  {profile.weekdayAnalysis.worstDay?.avgEnergy?.toFixed(1) || '-'}/5
                </Text>
              </View>
            </View>
            
            <View style={styles.weekCompare}>
              <View style={styles.weekCompareItem}>
                <Text style={styles.weekCompareLabel}>Weekday Avg</Text>
                <Text style={styles.weekCompareValue}>
                  {profile.weekdayAnalysis.weekdayAverage?.toFixed(1) || '-'}
                </Text>
              </View>
              <Text style={styles.weekCompareVs}>vs</Text>
              <View style={styles.weekCompareItem}>
                <Text style={styles.weekCompareLabel}>Weekend Avg</Text>
                <Text style={styles.weekCompareValue}>
                  {profile.weekdayAnalysis.weekendAverage?.toFixed(1) || '-'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tips Card */}
        <View style={[styles.card, styles.tipsCard]}>
          <Ionicons name="bulb-outline" size={24} color="#F59E0B" />
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>Energy Tip</Text>
            <Text style={styles.tipsText}>
              {profile?.suggestions?.personalizedTip || 
                'Log your energy 3-4 times daily to help FocusWise learn your patterns and schedule tasks optimally.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper functions
function formatPeriodName(period: string | undefined): string {
  if (!period) return '-';
  const names: Record<string, string> = {
    early_morning: 'Early AM',
    morning: 'Morning',
    midday: 'Midday',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  };
  return names[period] || period;
}

function formatPatternType(type: string): string {
  const types: Record<string, string> = {
    weekday_variation: '📊 Weekly Pattern',
    fatigue_curve: '📉 Fatigue Curve',
    peak_shift: '🔄 Peak Shift',
    consistency: '⚖️ Consistency',
  };
  return types[type] || type;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginTop: Spacing.xs,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  signInPrompt: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginTop: Spacing.md,
  },
  
  // Energy Selector
  selectorContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: Spacing.md,
  },
  emojiButton: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * 4) / 5,
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiButtonSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
  },
  emoji: {
    fontSize: 32,
  },
  levelIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumber: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedInfo: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  selectedLabel: {
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.bold,
  },
  selectedDescription: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 4,
  },
  logButton: {
    width: '100%',
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  logButtonDisabled: {
    opacity: 0.5,
  },
  logButtonGradient: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  logButtonText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  todayCount: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
  },
  
  // Success overlay
  successOverlay: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  successEmoji: {
    fontSize: 48,
  },
  successText: {
    color: '#10B981',
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.sm,
  },
  
  // Cards
  card: {
    backgroundColor: Colors.background.secondary,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  
  // Trend badge
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  trendText: {
    fontSize: Typography.sizes.caption,
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  
  // Chart
  chartContainer: {
    height: 100,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingHorizontal: Spacing.sm,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 4,
  },
  barLabel: {
    color: Colors.text.tertiary,
    fontSize: 10,
  },
  emptyChart: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    marginTop: Spacing.xs,
  },
  
  // Time periods
  periodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  periodCard: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2 - Spacing.sm) / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  peakPeriodCard: {
    borderWidth: 1,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  lowPeriodCard: {
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  periodEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  periodAvg: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.bold,
  },
  periodTime: {
    color: Colors.text.tertiary,
    fontSize: 10,
  },
  peakBadge: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  lowBadge: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  emptyStateText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h2,
    fontWeight: Typography.weights.bold,
  },
  statLabel: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 40,
  },
  
  // Tips
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  tipsContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  tipsTitle: {
    color: '#F59E0B',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  tipsText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 4,
    lineHeight: 18,
  },
  
  // NEW: Profile Strength
  profileStrength: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  profileStrengthText: {
    color: '#10B981',
    fontSize: Typography.sizes.caption,
    fontWeight: '600',
  },
  
  // NEW: Suggestions
  suggestionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  suggestionItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  suggestionLabel: {
    color: Colors.text.tertiary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionValue: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    marginBottom: 6,
  },
  confidenceBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 2,
  },
  personalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  personalTipText: {
    flex: 1,
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    lineHeight: 18,
  },
  
  // NEW: Patterns
  patternItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  patternHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  patternType: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
  },
  patternStrength: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  patternStrengthText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  patternInsight: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption - 1,
    lineHeight: 16,
  },
  
  // NEW: Weekday Analysis
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  weekdayItem: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    color: Colors.text.tertiary,
    fontSize: 10,
    marginBottom: 4,
  },
  weekdayValue: {
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.bold,
  },
  weekdayEnergy: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  weekdayDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: Spacing.md,
  },
  weekCompare: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  weekCompareItem: {
    alignItems: 'center',
    flex: 1,
  },
  weekCompareLabel: {
    color: Colors.text.tertiary,
    fontSize: 10,
  },
  weekCompareValue: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
  },
  weekCompareVs: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    marginHorizontal: Spacing.md,
  },
});

