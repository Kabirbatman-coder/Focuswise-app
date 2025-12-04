import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAIOverlay, ChatMessage } from '@/context/AIOverlayContext';
import { useAuth } from '@/context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Use your computer's IP for mobile testing, localhost for web
const API_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://192.168.1.6:3000';

// Typing indicator component
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    };

    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 200);
    const anim3 = animateDot(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
  });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
        <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
        <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
      </View>
    </View>
  );
}

// Chat message bubble component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      {!isUser && (
        <View style={styles.avatarContainer}>
          <LinearGradient
            colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="sparkles" size={14} color="#FFF" />
          </LinearGradient>
        </View>
      )}
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, isUser && styles.userMessageText]}>
          {message.content}
        </Text>
        {message.action && (
          <View style={styles.actionBadge}>
            <Ionicons
              name={getActionIcon(message.action)}
              size={12}
              color={Colors.ai_chief.active_ring}
            />
            <Text style={styles.actionText}>{formatAction(message.action)}</Text>
          </View>
        )}
      </View>
      {isUser && (
        <View style={styles.avatarContainer}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={14} color={Colors.text.primary} />
          </View>
        </View>
      )}
    </View>
  );
}

// Helper functions
function getActionIcon(action: string): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'task_created':
      return 'checkmark-circle';
    case 'calendar_event_created':
    case 'event_rescheduled':
      return 'calendar';
    case 'summary_generated':
      return 'document-text';
    case 'focus_suggested':
      return 'bulb';
    case 'tasks_listed':
    case 'events_listed':
      return 'list';
    default:
      return 'flash';
  }
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// Voice visualizer component
function VoiceVisualizer({ isListening }: { isListening: boolean }) {
  const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.5)).current, useRef(new Animated.Value(0.4)).current, useRef(new Animated.Value(0.6)).current, useRef(new Animated.Value(0.35)).current];

  useEffect(() => {
    if (isListening) {
      bars.forEach((bar, index) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: Math.random() * 0.7 + 0.3,
              duration: 150 + index * 50,
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: Math.random() * 0.5 + 0.2,
              duration: 150 + index * 50,
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    } else {
      bars.forEach((bar) => {
        Animated.timing(bar, { toValue: 0.3, duration: 200, useNativeDriver: true }).start();
      });
    }
  }, [isListening, bars]);

  return (
    <View style={styles.voiceVisualizer}>
      {bars.map((bar, index) => (
        <Animated.View
          key={index}
          style={[
            styles.voiceBar,
            {
              transform: [{ scaleY: bar }],
              backgroundColor: isListening ? Colors.ai_chief.active_ring : Colors.text.tertiary,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function AICommandOverlay() {
  const {
    isVisible,
    close,
    messages,
    addMessage,
    isProcessing,
    setIsProcessing,
    isListening,
    setIsListening,
    inputText,
    setInputText,
  } = useAIOverlay();
  
  const { accessToken, user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Animation for opening/closing
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 25,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, backdropOpacity, sheetTranslateY]);

  // Pulse animation for AI orb
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Glow animation when listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 500, useNativeDriver: false }),
        ])
      ).start();
    } else {
      Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  }, [isListening, glowAnim]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isProcessing]);

  // Send command to backend
  const sendCommand = async (query: string) => {
    if (!query.trim()) return;

    // Add user message
    addMessage({ role: 'user', content: query.trim() });
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          accessToken: accessToken,
          userId: user?.id || 'default_user',
        }),
      });

      const result = await response.json();

      addMessage({
        role: 'assistant',
        content: result.response || "I couldn't process that request.",
        intent: result.intent,
        action: result.action,
        data: result.data,
      });
    } catch (error: any) {
      console.error('[AIOverlay] Error sending command:', error);
      addMessage({
        role: 'assistant',
        content: "I'm having trouble connecting to the server. Please check if the backend is running.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle voice input toggle
  const toggleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      // In a real implementation, this would stop speech recognition
      // and send the transcribed text
    } else {
      setIsListening(true);
      // In a real implementation, this would start speech recognition
      // For now, we'll show a placeholder message
      setTimeout(() => {
        if (isListening) {
          addMessage({
            role: 'assistant',
            content: "Voice input requires native build. For now, please type your command or install expo-speech for voice support.",
          });
          setIsListening(false);
        }
      }, 3000);
    }
  };

  // Handle submit
  const handleSubmit = () => {
    if (inputText.trim()) {
      sendCommand(inputText);
    }
  };

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  const userName = user?.given_name || user?.name?.split(' ')[0] || 'there';

  return (
    <Modal transparent visible={isVisible} animationType="none" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.fullScreen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={close} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslateY }] }]}
        >
          <BlurView intensity={40} tint="dark" style={styles.sheet}>
            {/* Header with AI Orb */}
            <View style={styles.header}>
              <View style={styles.orbContainer}>
                {/* Glow effect when listening */}
                <Animated.View
                  style={[
                    styles.orbGlow,
                    {
                      opacity: glowOpacity,
                      transform: [{ scale: 1.5 }],
                    },
                  ]}
                />
                {/* Pulse ring */}
                <Animated.View
                  style={[
                    styles.orbPulse,
                    {
                      transform: [{ scale: pulseScale }],
                      opacity: pulseAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 0.1],
                      }),
                    },
                  ]}
                />
                {/* Core orb */}
                <LinearGradient
                  colors={
                    isListening
                      ? [Colors.ai_chief.active_ring, '#00E5FF']
                      : [Colors.ai_chief.glow, Colors.ai_chief.active_ring]
                  }
                  style={styles.orbCore}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={isListening ? 'mic' : 'sparkles'}
                    size={22}
                    color="#FFF"
                  />
                </LinearGradient>
              </View>

              {/* Voice visualizer when listening */}
              {isListening && <VoiceVisualizer isListening={isListening} />}

              <Text style={styles.headerTitle}>
                {isListening ? 'Listening...' : `Hey ${userName}, how can I help?`}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isListening
                  ? 'Speak your command'
                  : 'Schedule events, create tasks, or ask for focus suggestions'}
              </Text>
            </View>

            {/* Messages area */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Try saying things like:
                  </Text>
                  <View style={styles.suggestionsList}>
                    {[
                      'Schedule a meeting at 3 PM tomorrow',
                      'What should I focus on today?',
                      'Create a task to review the proposal',
                      'Show me my next meeting',
                    ].map((suggestion, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionChip}
                        onPress={() => sendCommand(suggestion)}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}

              {isProcessing && <TypingIndicator />}
            </ScrollView>

            {/* Input area */}
            <View style={styles.inputArea}>
              <View style={styles.inputRow}>
                <View style={styles.inputContainer}>
                  <TextInput
                    ref={inputRef}
                    placeholder="Ask FocusWise..."
                    placeholderTextColor={Colors.text.tertiary}
                    style={styles.input}
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="send"
                    editable={!isProcessing && !isListening}
                    multiline
                    maxLength={500}
                  />
                </View>

                {/* Voice button */}
                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    isListening && styles.voiceButtonActive,
                  ]}
                  onPress={toggleVoiceInput}
                  activeOpacity={0.7}
                  disabled={isProcessing}
                >
                  {isListening ? (
                    <Animated.View
                      style={[
                        styles.voiceButtonGlow,
                        { opacity: glowAnim },
                      ]}
                    />
                  ) : null}
                  <Ionicons
                    name={isListening ? 'stop' : 'mic'}
                    size={20}
                    color={isListening ? '#FFF' : Colors.text.primary}
                  />
                </TouchableOpacity>

                {/* Send button */}
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!inputText.trim() || isProcessing) && styles.sendButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.7}
                  disabled={!inputText.trim() || isProcessing}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="send" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Quick actions */}
              <View style={styles.quickActions}>
                {[
                  { icon: 'today', label: 'Today', query: "What's on my schedule today?" },
                  { icon: 'bulb', label: 'Focus', query: 'What should I focus on right now?' },
                  { icon: 'list', label: 'Tasks', query: 'Show me my tasks' },
                ].map((action, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickAction}
                    onPress={() => sendCommand(action.query)}
                    disabled={isProcessing}
                  >
                    <Ionicons
                      name={action.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={Colors.ai_chief.active_ring}
                    />
                    <Text style={styles.quickActionText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  backdropTouchable: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  sheet: {
    backgroundColor: 'rgba(18, 18, 20, 0.95)',
    borderTopLeftRadius: BorderRadius.lg * 2,
    borderTopRightRadius: BorderRadius.lg * 2,
    overflow: 'hidden',
    flex: 1,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Header styles
  header: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  orbContainer: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  orbGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.ai_chief.active_ring,
  },
  orbPulse: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.ai_chief.glow,
  },
  orbCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.ai_chief.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.sm,
  },
  headerSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },

  // Voice visualizer
  voiceVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
    marginTop: Spacing.sm,
  },
  voiceBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginHorizontal: 2,
  },

  // Messages styles
  messagesContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  messagesContent: {
    paddingVertical: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyStateText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginBottom: Spacing.md,
  },
  suggestionsList: {
    width: '100%',
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
  },

  // Message bubble styles
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    marginHorizontal: Spacing.xs,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  aiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: BorderRadius.sm,
  },
  userBubble: {
    backgroundColor: Colors.ai_chief.glow,
    borderBottomRightRadius: BorderRadius.sm,
  },
  messageText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFF',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    color: Colors.ai_chief.active_ring,
    fontSize: Typography.sizes.caption,
    marginLeft: Spacing.xs,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginLeft: 36,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.ai_chief.active_ring,
    marginHorizontal: 2,
  },

  // Input area styles
  inputArea: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm : Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: 100,
  },
  input: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    maxHeight: 80,
  },
  voiceButton: {
    marginLeft: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  },
  voiceButtonActive: {
    backgroundColor: Colors.ai_chief.active_ring,
    borderColor: Colors.ai_chief.active_ring,
  },
  voiceButtonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.ai_chief.active_ring,
  },
  sendButton: {
    marginLeft: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ai_chief.glow,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 199, 252, 0.2)',
  },
  quickActionText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginLeft: Spacing.xs,
  },
});
