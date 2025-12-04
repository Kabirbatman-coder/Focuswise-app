import React, { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  action?: string;
  data?: any;
}

type AIOverlayContextValue = {
  isVisible: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  
  // Chat state
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  
  // Loading state
  isProcessing: boolean;
  setIsProcessing: (loading: boolean) => void;
  
  // Voice state
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
  
  // Input state
  inputText: string;
  setInputText: (text: string) => void;
};

const AIOverlayContext = createContext<AIOverlayContextValue | undefined>(undefined);

export function AIOverlayProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');

  const open = useCallback(() => setIsVisible(true), []);
  const close = useCallback(() => {
    setIsVisible(false);
    setIsListening(false);
  }, []);
  const toggle = useCallback(() => setIsVisible((prev) => !prev), []);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <AIOverlayContext.Provider
      value={{
        isVisible,
        open,
        close,
        toggle,
        messages,
        addMessage,
        clearMessages,
        isProcessing,
        setIsProcessing,
        isListening,
        setIsListening,
        inputText,
        setInputText,
      }}
    >
      {children}
    </AIOverlayContext.Provider>
  );
}

export function useAIOverlay() {
  const ctx = useContext(AIOverlayContext);
  if (!ctx) {
    throw new Error('useAIOverlay must be used within an AIOverlayProvider');
  }
  return ctx;
}
