import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';

// Enhanced PES (Physical, Emotional, Spiritual) color matching
const getPESColor = (summary: string = '', description: string = '') => {
  const text = (summary + ' ' + (description || '')).toLowerCase();
  
  // High Energy (Physical/Active) - Cyan/Blue
  const highEnergyKeywords = [
    'work', 'focus', 'deep', 'meeting', 'call', 'presentation', 
    'exercise', 'workout', 'gym', 'run', 'training', 'project',
    'deadline', 'urgent', 'important', 'coding', 'development'
  ];
  
  // Low Energy (Rest/Recovery) - Purple/Indigo
  const lowEnergyKeywords = [
    'break', 'lunch', 'rest', 'relax', 'nap', 'sleep', 'dinner',
    'meal', 'coffee', 'tea', 'meditation', 'yoga', 'stretch',
    'reading', 'leisure', 'personal', 'family', 'friends'
  ];
  
  // Steady Energy (Balanced) - Gold/Yellow
  const steadyEnergyKeywords = [
    'review', 'plan', 'organize', 'email', 'admin', 'errands',
    'shopping', 'routine', 'maintenance', 'update', 'sync'
  ];
  
  const hasHighEnergy = highEnergyKeywords.some(keyword => text.includes(keyword));
  const hasLowEnergy = lowEnergyKeywords.some(keyword => text.includes(keyword));
  const hasSteadyEnergy = steadyEnergyKeywords.some(keyword => text.includes(keyword));
  
  if (hasHighEnergy && !hasLowEnergy) return '#00F0FF'; // High/Cyan
  if (hasLowEnergy && !hasHighEnergy) return '#8A2BE2'; // Low/Indigo
  if (hasSteadyEnergy) return '#FFD700'; // Steady/Gold
  
  // Default based on time of day
  const hour = new Date().getHours();
  if (hour >= 9 && hour <= 17) return '#00F0FF'; // Work hours - High energy
  if (hour >= 18 || hour <= 8) return '#8A2BE2'; // Off hours - Low energy
  
  return '#FFD700'; // Default - Steady
};

export default function CalendarScreen() {
  const { isAuthenticated, isLoading, syncCalendar, calendarEvents, signIn, signOut, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await syncCalendar();
    } catch (error) {
      console.error('[Calendar] Refresh failed:', error);
    }
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Sign out of Google Calendar? You can sign back in anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  useEffect(() => {
    if (isAuthenticated) {
      console.log('[Calendar] Authenticated, syncing calendar...');
      syncCalendar().catch(console.error);
    }
  }, [isAuthenticated]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>
        {isAuthenticated ? (
          <TouchableOpacity style={styles.accountButton} onPress={handleSignOut}>
            <Ionicons name="person-circle" size={32} color={Colors.ai_chief.active_ring} />
          </TouchableOpacity>
        ) : null}
      </View>

      {!isAuthenticated ? (
        <View style={styles.centerContent}>
          <View style={styles.signInCard}>
            <Ionicons name="calendar" size={48} color={Colors.ai_chief.active_ring} />
            <Text style={styles.signInTitle}>Connect Google Calendar</Text>
            <Text style={styles.signInSubtitle}>
              Sign in to sync your events and let AI schedule meetings for you
            </Text>
            <TouchableOpacity style={styles.signInButton} onPress={signIn}>
              <Ionicons name="logo-google" size={20} color="#FFF" />
              <Text style={styles.signInButtonText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing || isLoading} 
              onRefresh={onRefresh} 
              tintColor={Colors.text.primary} 
            />
          }
        >
          {isLoading && calendarEvents.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.message}>Loading events...</Text>
            </View>
          ) : calendarEvents.length === 0 ? (
            <View style={styles.centerContent}>
              <Text style={styles.message}>No upcoming events found.</Text>
              <Text style={[styles.message, { marginTop: 10, fontSize: 14 }]}>
                Pull down to refresh or add events to your Google Calendar.
              </Text>
            </View>
          ) : (
            calendarEvents.map((event, index) => {
              const pesColor = getPESColor(event.summary, event.description);
              const startDateTime = event.start?.dateTime || event.start?.date;
              const endDateTime = event.end?.dateTime || event.end?.date;
              
              const startTime = startDateTime ? new Date(startDateTime) : new Date();
              const endTime = endDateTime ? new Date(endDateTime) : new Date();
              const isAllDay = !event.start?.dateTime; // Date-only events
              
              return (
                <View key={event.id || index} style={[styles.eventCard, { borderLeftColor: pesColor }]}>
                  <Text style={styles.eventTime}>
                    {isAllDay 
                      ? 'All Day'
                      : `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </Text>
                  <View style={styles.eventDetails}>
                    <Text style={styles.eventTitle}>{event.summary || 'No title'}</Text>
                    {event.description && (
                      <Text numberOfLines={2} style={styles.eventDesc}>{event.description}</Text>
                    )}
                    {event.location && (
                      <Text numberOfLines={1} style={styles.eventLocation}>📍 {event.location}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
          
          {/* Show event count */}
          {calendarEvents.length > 0 && (
            <Text style={styles.eventCount}>
              {calendarEvents.length} upcoming event{calendarEvents.length !== 1 ? 's' : ''}
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginTop: 5,
  },
  accountButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  signInCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  signInTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  signInSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.ai_chief.glow,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.lg,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.semibold,
    marginLeft: Spacing.sm,
  },
  message: {
    color: Colors.text.secondary,
    fontSize: 16,
    textAlign: 'center',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: Colors.background.secondary,
    marginBottom: 15,
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: 'center',
  },
  eventTime: {
    color: Colors.text.secondary,
    fontSize: 14,
    marginRight: 15,
    width: 60,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  eventDesc: {
    color: Colors.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  eventLocation: {
    color: Colors.text.secondary,
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
  eventCount: {
    color: Colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
});
