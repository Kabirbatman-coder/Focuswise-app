import { StyleSheet, TouchableOpacity, Switch, View, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function ModalScreen() {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Reset loading when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Settings</ThemedText>

      <View style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionHeader}>Integrations</ThemedText>
        
        <View style={styles.row}>
          <View style={styles.flex1}>
            <ThemedText style={styles.label}>Connect Google Calendar</ThemedText>
            <ThemedText style={styles.subtext}>
              {isLoading 
                ? 'Connecting...' 
                : isAuthenticated 
                  ? `Connected as ${user?.name || user?.email || 'User'}` 
                  : 'Sync your schedule with Google Calendar'}
            </ThemedText>
          </View>
          <View style={styles.switchContainer}>
            {isLoading && (
              <ActivityIndicator 
                size="small" 
                color={Colors.ai_chief.active_ring} 
                style={styles.loader}
              />
            )}
            <Switch
              value={isAuthenticated || isLoading}
              onValueChange={async (val) => {
                if (val && !isAuthenticated) {
                  // Turning ON - Sign in
                  setIsLoading(true);
                  try {
                    await signIn();
                    // Don't set loading to false here - let the auth state update handle it
                    // The switch will stay on because isAuthenticated will become true
                    // Wait a bit for auth to complete, then reset loading
                    setTimeout(() => {
                      setIsLoading(false);
                    }, 2000);
                  } catch (error: any) {
                    console.error('Sign in error:', error);
                    setIsLoading(false);
                    // Only show error if it's not a user cancellation
                    if (error?.message && !error.message.includes('cancelled') && !error.message.includes('dismissed')) {
                      // Error already shown in signIn function
                    }
                    // Switch will toggle back off because isAuthenticated is still false
                  }
                } else if (!val && isAuthenticated) {
                  // Turning OFF - Sign out
                  setIsLoading(true);
                  try {
                    signOut();
                    setIsLoading(false);
                  } catch (error) {
                    console.error('Sign out error:', error);
                    setIsLoading(false);
                  }
                }
              }}
              disabled={isLoading}
              trackColor={{ 
                false: '#767577', 
                true: Colors.ai_chief.active_ring 
              }}
              thumbColor={(isAuthenticated || isLoading) ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#767577"
            />
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
        <ThemedText style={{ color: Colors.text.primary }}>Close</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: Colors.background.primary,
  },
  section: {
    marginTop: 30,
  },
  sectionHeader: {
    marginBottom: 15,
    color: Colors.text.primary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.tertiary,
  },
  switchContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    position: 'absolute',
    right: 35,
  },
  flex1: {
    flex: 1,
    marginRight: 15,
  },
  label: {
    fontWeight: '600',
  },
  subtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  closeButton: {
    marginTop: 'auto',
    alignSelf: 'center',
    padding: 15,
  },
});
