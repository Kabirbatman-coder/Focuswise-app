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
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAIOverlay, ChatMessage } from '@/context/AIOverlayContext';
import { useAuth } from '@/context/AuthContext';

import { getApiUrl } from '@/constants/config';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Simplified typing indicator - less animation for better performance
function TypingIndicator() {
  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <View style={[styles.typingDot, { opacity: 0.4 }]} />
        <View style={[styles.typingDot, { opacity: 0.7 }]} />
        <View style={[styles.typingDot, { opacity: 1 }]} />
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
            <Ionicons name="sparkles" size={12} color="#FFF" />
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
              size={10}
              color={Colors.ai_chief.active_ring}
            />
            <Text style={styles.actionText}>{formatAction(message.action)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Helper functions
function getActionIcon(action: string): keyof typeof Ionicons.glyphMap {
  switch (action) {
    case 'task_created': return 'checkmark-circle';
    case 'calendar_event_created':
    case 'event_rescheduled': return 'calendar';
    case 'summary_generated': return 'document-text';
    case 'focus_suggested': return 'bulb';
    case 'tasks_listed':
    case 'events_listed': return 'list';
    default: return 'flash';
  }
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Simple slide animation - no complex pulse animations for better performance
  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
          toValue: 0,
        damping: 20,
        stiffness: 200,
          useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
      }).start();
    }
  }, [isVisible, slideAnim]);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages, isProcessing]);

  // Send command to backend
  const sendCommand = async (query: string) => {
    if (!query.trim()) return;

    Keyboard.dismiss();
    
    // Add user message
    addMessage({ role: 'user', content: query.trim() });
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await fetch(getApiUrl('/api/ai/command'), {
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
      console.error('[AIOverlay] API URL used:', getApiUrl('/api/ai/command'));
      
      // Better error message based on error type
      let errorMessage = "I'm having trouble connecting to the server.";
      if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorMessage = "Can't reach the backend server. Check your internet connection or verify the backend URL is correct.";
      } else if (error.message?.includes('429')) {
        errorMessage = "The AI service is rate-limited. Please try again in a few seconds.";
      } else {
        errorMessage = `Connection error: ${error.message || 'Unknown error'}`;
      }
      
      addMessage({
        role: 'assistant',
        content: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle submit
  const handleSubmit = () => {
    if (inputText.trim()) {
      sendCommand(inputText);
    }
  };

  const userName = user?.given_name || user?.name?.split(' ')[0] || 'there';

  if (!isVisible) return null;

  return (
    <Modal transparent visible={isVisible} animationType="none" onRequestClose={close}>
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={close}
        />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={0}
          >
            <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
              {/* Handle bar */}
              <View style={styles.handleContainer}>
                <View style={styles.handle} />
            </View>

              {/* Header */}
              <View style={styles.header}>
                <LinearGradient
                  colors={[Colors.ai_chief.glow, Colors.ai_chief.active_ring]}
                  style={styles.orbCore}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="sparkles" size={20} color="#FFF" />
                </LinearGradient>
                <Text style={styles.headerTitle}>Hey {userName}, how can I help?</Text>
                <Text style={styles.headerSubtitle}>
                  Schedule events, create tasks, or ask for focus suggestions
              </Text>
            </View>

              {/* Messages area */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messagesContainer}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {messages.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>Try saying:</Text>
                    {[
                      'Create a task to review proposal',
                      'What should I focus on today?',
                      'Schedule meeting at 3 PM tomorrow',
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
                      editable={!isProcessing}
                      multiline={false}
                      maxLength={500}
                />
              </View>

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
                        size={14}
                        color={Colors.ai_chief.active_ring}
                      />
                      <Text style={styles.quickActionText}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheetContainer: {
    height: SCREEN_HEIGHT * 0.7,
    width: '100%',
    backgroundColor: Colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.text.tertiary,
    borderRadius: 2,
  },

  // Header styles
  header: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  orbCore: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
  },
  headerSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 4,
    textAlign: 'center',
  },

  // Messages styles
  messagesContainer: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 150,
  },
  messagesContent: {
    paddingVertical: Spacing.sm,
    flexGrow: 1,
    minHeight: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  emptyStateText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    marginBottom: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionText: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body - 1,
  },

  // Message bubble styles
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    alignItems: 'flex-end',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 24,
    height: 24,
    marginRight: Spacing.xs,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  aiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.ai_chief.glow,
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body - 1,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFF',
  },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionText: {
    color: Colors.ai_chief.active_ring,
    fontSize: 10,
    marginLeft: 4,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.md,
    borderBottomLeftRadius: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginLeft: 28,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.ai_chief.active_ring,
    marginHorizontal: 2,
  },

  // Input area styles
  inputArea: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  input: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
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
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.pill,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 199, 252, 0.2)',
  },
  quickActionText: {
    color: Colors.text.secondary,
    fontSize: 11,
    marginLeft: 4,
  },
});
