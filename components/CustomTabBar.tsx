import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAIOverlay } from '@/context/AIOverlayContext';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { toggle } = useAIOverlay();
  const nucleusScale = useSharedValue(1);

  React.useEffect(() => {
    nucleusScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, [nucleusScale]);

  const nucleusStyle = useAnimatedStyle(() => ({
    transform: [{ scale: nucleusScale.value }],
  }));

  // We want to render the tabs in a specific order:
  // index (Home), calendar, ai_chief (Middle), tasks, focus
  // However, state.routes order depends on how they are defined in _layout.tsx.
  // We'll trust _layout.tsx to provide them in the right order or we can map manually.

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <BlurView intensity={20} tint="dark" style={styles.blurContainer}>
        <View style={styles.tabBar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;

            const onPress = () => {
              // Intercept center AI button separately
              if (route.name === 'ai_chief') {
                toggle();
                return;
              }

              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            // Middle button logic
            if (route.name === 'ai_chief') {
              return (
                <View key={route.key} style={styles.aiButtonWrapper}>
                  <Animated.View style={nucleusStyle}>
                    <TouchableOpacity
                      onPress={onPress}
                      style={styles.aiButtonContainer}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
                        style={styles.aiButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        {/* Abstract Sphere / Nucleus Icon */}
                        <Ionicons name="aperture" size={22} color="#FFF" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              );
            }

            let iconName: keyof typeof Ionicons.glyphMap = 'home';
            
            if (route.name === 'index') iconName = isFocused ? 'home' : 'home-outline';
            else if (route.name === 'calendar') iconName = isFocused ? 'calendar' : 'calendar-outline';
            else if (route.name === 'tasks') iconName = isFocused ? 'checkmark-circle' : 'checkmark-circle-outline';
            else if (route.name === 'energy') iconName = isFocused ? 'battery-charging' : 'battery-half-outline';

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                style={styles.tabItem}
              >
                <Ionicons
                    name={iconName}
                    size={24}
                    color={isFocused ? Colors.text.primary : Colors.text.secondary}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    // Make it float slightly
    paddingHorizontal: Spacing.lg, 
  },
  blurContainer: {
    width: '100%',
    borderRadius: BorderRadius.lg * 2, // High border radius for the floating pill look
    overflow: 'hidden',
    // Glass effect border
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: Colors.glassmorphism.color,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60, // Fixed height
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  aiButtonWrapper: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    // Push it up slightly but not too much
    marginTop: -8, 
  },
  aiButtonContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    // Shadow for the glowing effect
    shadowColor: Colors.ai_chief.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  aiButton: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

