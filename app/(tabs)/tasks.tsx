import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Platform } from 'react-native';
const API_URL = Platform.OS === 'web' ? 'http://localhost:3000' : 'http://192.168.1.6:3000';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  dueDate?: string;
  createdAt: string;
}

const priorityColors = {
  high: ['#FF453A', '#FF6B6B'],
  medium: ['#FFD60A', '#FF9F0A'],
  low: ['#30D158', '#34C759'],
};

const priorityIcons = {
  high: 'flame',
  medium: 'time',
  low: 'leaf',
};

function TaskCard({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const isCompleted = task.status === 'completed';
  const colors = priorityColors[task.priority];

  return (
    <TouchableOpacity
      style={[styles.taskCard, isCompleted && styles.taskCardCompleted]}
      onPress={() => onToggle(task.id)}
      activeOpacity={0.7}
    >
      <View style={styles.taskLeft}>
        <TouchableOpacity
          style={[styles.checkbox, isCompleted && styles.checkboxCompleted]}
          onPress={() => onToggle(task.id)}
        >
          {isCompleted && (
            <Ionicons name="checkmark" size={16} color="#FFF" />
          )}
        </TouchableOpacity>
        <View style={styles.taskInfo}>
          <Text style={[styles.taskTitle, isCompleted && styles.taskTitleCompleted]}>
            {task.title}
          </Text>
          {task.description && (
            <Text style={styles.taskDescription} numberOfLines={1}>
              {task.description}
            </Text>
          )}
          {task.dueDate && (
            <View style={styles.dueDateContainer}>
              <Ionicons name="calendar-outline" size={12} color={Colors.text.tertiary} />
              <Text style={styles.dueDate}>
                {new Date(task.dueDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.taskRight}>
        <LinearGradient
          colors={colors as [string, string]}
          style={styles.priorityBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons
            name={priorityIcons[task.priority] as keyof typeof Ionicons.glyphMap}
            size={12}
            color="#FFF"
          />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ai/tasks`);
      const data = await response.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTasks();
  }, []);

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    
    // Optimistic update
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
    );

    try {
      await fetch(`${API_URL}/api/ai/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert on error
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId ? { ...t, status: task.status } : t
        )
      );
    }
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.ai_chief.active_ring} />
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tasks</Text>
          <Text style={styles.headerSubtitle}>
            {pendingTasks.length} pending · {completedTasks.length} completed
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkbox-outline" size={48} color={Colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptySubtitle}>
            Ask the AI to create tasks for you!{'\n'}
            Try: "Create a task to review the proposal"
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...pendingTasks, ...completedTasks]}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard task={item} onToggle={toggleTask} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.ai_chief.active_ring}
            />
          }
          ListHeaderComponent={
            pendingTasks.length > 0 ? (
              <Text style={styles.sectionTitle}>To Do</Text>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    fontSize: Typography.sizes.body,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h1,
    fontWeight: Typography.weights.bold,
  },
  headerSubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  sectionTitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background.secondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  taskCardCompleted: {
    opacity: 0.6,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.text.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  checkboxCompleted: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.body,
    fontWeight: Typography.weights.medium,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.text.tertiary,
  },
  taskDescription: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.caption,
    marginTop: 2,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dueDate: {
    color: Colors.text.tertiary,
    fontSize: Typography.sizes.caption,
    marginLeft: 4,
  },
  taskRight: {
    marginLeft: Spacing.md,
  },
  priorityBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separator: {
    height: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: Typography.sizes.h3,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.text.secondary,
    fontSize: Typography.sizes.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
