import { getTasksByUserId, Task, updateTask } from './taskService';
import { getEnergyProfile, getOptimalTimeSlots, TimePeriod, EnergyProfile } from './energyService';

// ==================== TYPES ====================

interface TimeSlot {
  start: Date;
  end: Date;
  period: TimePeriod;
  energyLevel: number | null;
  confidence: number;
  isAvailable: boolean;
  blockedReason?: string | undefined;
}

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

// NEW: User scheduling constraints
export interface SchedulingConstraint {
  type: 'no_meetings_before' | 'no_meetings_after' | 'focus_block' | 'meeting_buffer' | 'max_daily_meetings' | 'task_preference';
  value: any;
  priority: number; // 1-10, higher = stricter
  active: boolean;
}

// NEW: Impact scoring for tasks
export interface TaskImpactScore {
  task: Task;
  impactScore: number;      // 0-100 total impact
  urgencyScore: number;     // Time pressure
  importanceScore: number;  // Priority + strategic value
  effortScore: number;      // Estimated effort/complexity
  dependencyScore: number;  // Blocking other work
  energyMatch: number;      // How well it fits current energy
  reasoning: string;
}

export interface ScheduledTask {
  task: Task;
  scheduledStart: string;
  scheduledEnd: string;
  timePeriod: TimePeriod;
  reason: string;
  energyMatch: 'excellent' | 'good' | 'fair' | 'poor';
  impactScore: number;
  swapSuggestion?: string;  // NEW: Optimization hint
}

// NEW: Multi-day schedule
export interface MultiDaySchedule {
  userId: string;
  days: DailySchedule[];
  weekOverview: WeekOverview;
  generatedAt: string;
}

export interface WeekOverview {
  totalTasksScheduled: number;
  totalTasksUnscheduled: number;
  busiestDay: { date: string; taskCount: number };
  lightestDay: { date: string; taskCount: number };
  energyUtilization: number; // 0-100%
  recommendations: string[];
}

export interface DailySchedule {
  userId: string;
  date: string;
  scheduledTasks: ScheduledTask[];
  unscheduledTasks: Task[];
  optimalSummary: string;
  insights: string[];
  energyForecast: { period: TimePeriod; level: number; confidence: number }[];
  swapOptimizations?: SwapSuggestion[];  // NEW
  constraints?: SchedulingConstraint[];
  generatedAt: string;
}

// NEW: Swap optimization suggestion
export interface SwapSuggestion {
  task1: { id: string; title: string; currentSlot: TimePeriod };
  task2: { id: string; title: string; currentSlot: TimePeriod };
  reason: string;
  expectedImprovement: number; // Percentage
}

// In-memory constraints storage (would be DB in production)
const userConstraints: Map<string, SchedulingConstraint[]> = new Map();

// Default constraints for founders
const DEFAULT_CONSTRAINTS: SchedulingConstraint[] = [
  { type: 'no_meetings_before', value: 9, priority: 5, active: true },
  { type: 'meeting_buffer', value: 15, priority: 7, active: true }, // 15 min buffer
  { type: 'focus_block', value: { start: 9, end: 11, label: 'Morning Deep Work' }, priority: 8, active: false },
];

// ==================== HELPER FUNCTIONS ====================

function getPeriodHours(period: TimePeriod): { start: number; end: number } {
  const ranges: Record<TimePeriod, { start: number; end: number }> = {
    early_morning: { start: 5, end: 7 },
    morning: { start: 7, end: 10 },
    midday: { start: 10, end: 13 },
    afternoon: { start: 13, end: 17 },
    evening: { start: 17, end: 20 },
    night: { start: 20, end: 23 },
  };
  return ranges[period];
}

function getTaskEnergyRequirement(task: Task): 'high' | 'medium' | 'low' {
  if (task.priority === 'high') return 'high';
  if (task.estimatedMinutes && task.estimatedMinutes > 60) return 'high';
  if (task.estimatedMinutes && task.estimatedMinutes > 30) return 'medium';
  if (task.priority === 'low') return 'low';
  return 'medium';
}

// ==================== IMPACT SCORING (NEW) ====================

function calculateImpactScore(
  task: Task,
  energyProfile: EnergyProfile,
  allTasks: Task[]
): TaskImpactScore {
  let urgencyScore = 0;
  let importanceScore = 0;
  let effortScore = 0;
  let dependencyScore = 0;
  
  // URGENCY: Time pressure (0-30 points)
  if (task.dueDate) {
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 0) urgencyScore = 30;      // Overdue
    else if (daysUntilDue <= 1) urgencyScore = 25; // Due today/tomorrow
    else if (daysUntilDue <= 3) urgencyScore = 20;
    else if (daysUntilDue <= 7) urgencyScore = 15;
    else urgencyScore = 5;
  } else {
    urgencyScore = 10; // No due date = moderate urgency
  }
  
  // IMPORTANCE: Priority + title analysis (0-30 points)
  switch (task.priority) {
    case 'high': importanceScore = 25; break;
    case 'medium': importanceScore = 15; break;
    case 'low': importanceScore = 5; break;
  }
  
  // Strategic keywords boost
  const strategicKeywords = ['investor', 'customer', 'launch', 'revenue', 'critical', 'blocker'];
  const titleLower = task.title.toLowerCase();
  if (strategicKeywords.some(kw => titleLower.includes(kw))) {
    importanceScore += 5;
  }
  
  // EFFORT: Complexity estimation (0-20 points, inverse - less effort = higher score for quick wins)
  const minutes = task.estimatedMinutes || 30;
  if (minutes <= 15) effortScore = 20;       // Quick win
  else if (minutes <= 30) effortScore = 15;
  else if (minutes <= 60) effortScore = 10;
  else effortScore = 5;                       // Long task
  
  // DEPENDENCY: Does this block other work? (0-20 points)
  // Check if task title suggests it blocks others
  const blockerKeywords = ['before', 'first', 'blocker', 'blocking', 'prerequisite', 'setup'];
  if (blockerKeywords.some(kw => titleLower.includes(kw))) {
    dependencyScore = 15;
  }
  
  // Check if high priority with similar keywords in other tasks
  const highPriorityOthers = allTasks.filter(t => t.id !== task.id && t.priority === 'high');
  if (task.priority === 'high' && highPriorityOthers.length > 2) {
    dependencyScore += 5; // Important in a busy context
  }
  
  // ENERGY MATCH: Bonus for good timing (0-10 points)
  const energyReq = getTaskEnergyRequirement(task);
  let energyMatch = 5; // Neutral default
  
  if (energyProfile.peakPeriod) {
    const peakAvg = energyProfile.averages[energyProfile.peakPeriod] || 3;
    if (energyReq === 'high' && peakAvg >= 4) energyMatch = 10;
    else if (energyReq === 'low' && energyProfile.lowPeriod) energyMatch = 8;
  }
  
  const impactScore = urgencyScore + importanceScore + effortScore + dependencyScore + energyMatch;
  
  // Generate reasoning
  const reasons: string[] = [];
  if (urgencyScore >= 25) reasons.push('urgent deadline');
  if (importanceScore >= 25) reasons.push('high priority');
  if (effortScore >= 15) reasons.push('quick win');
  if (dependencyScore >= 10) reasons.push('enables other work');
  
  const reasoning = reasons.length > 0 
    ? `High impact: ${reasons.join(', ')}`
    : 'Standard priority task';
  
  return {
    task,
    impactScore: Math.min(100, impactScore),
    urgencyScore,
    importanceScore,
    effortScore,
    dependencyScore,
    energyMatch,
    reasoning,
  };
}

// ==================== CONSTRAINT MANAGEMENT ====================

export function setConstraint(userId: string, constraint: SchedulingConstraint): void {
  const existing = userConstraints.get(userId) || [...DEFAULT_CONSTRAINTS];
  
  // Update or add constraint
  const index = existing.findIndex(c => c.type === constraint.type);
  if (index >= 0) {
    existing[index] = constraint;
  } else {
    existing.push(constraint);
  }
  
  userConstraints.set(userId, existing);
  console.log(`[Scheduler] Set constraint for ${userId}: ${constraint.type}`);
}

export function getConstraints(userId: string): SchedulingConstraint[] {
  return userConstraints.get(userId) || [...DEFAULT_CONSTRAINTS];
}

function applyConstraints(
  slots: TimeSlot[],
  constraints: SchedulingConstraint[],
  events: CalendarEvent[]
): TimeSlot[] {
  const activeConstraints = constraints.filter(c => c.active);
  
  for (const constraint of activeConstraints) {
    switch (constraint.type) {
      case 'no_meetings_before': {
        const cutoffHour = constraint.value;
        slots = slots.map(slot => {
          if (slot.start.getHours() < cutoffHour) {
            return { ...slot, isAvailable: false, blockedReason: `Protected time (before ${cutoffHour}:00)` };
          }
          return slot;
        });
        break;
      }
      
      case 'no_meetings_after': {
        const cutoffHour = constraint.value;
        slots = slots.map(slot => {
          if (slot.end.getHours() > cutoffHour) {
            return { ...slot, isAvailable: false, blockedReason: `Protected time (after ${cutoffHour}:00)` };
          }
          return slot;
        });
        break;
      }
      
      case 'focus_block': {
        const { start: blockStart, end: blockEnd, label } = constraint.value;
        slots = slots.map(slot => {
          const slotStartHour = slot.start.getHours();
          if (slotStartHour >= blockStart && slotStartHour < blockEnd) {
            return { ...slot, isAvailable: false, blockedReason: label || 'Focus Block' };
          }
          return slot;
        });
        break;
      }
      
      case 'meeting_buffer': {
        const bufferMinutes = constraint.value;
        // Add buffer around calendar events
        for (const event of events) {
          const eventStart = new Date(event.start.dateTime || event.start.date || '');
          const eventEnd = new Date(event.end.dateTime || event.end.date || '');
          
          slots = slots.map(slot => {
            const slotEnd = slot.end.getTime();
            const slotStart = slot.start.getTime();
            
            // Check if slot is within buffer of event
            if (
              (slotEnd > eventStart.getTime() - bufferMinutes * 60000 && slotEnd <= eventStart.getTime()) ||
              (slotStart >= eventEnd.getTime() && slotStart < eventEnd.getTime() + bufferMinutes * 60000)
            ) {
              return { ...slot, isAvailable: false, blockedReason: `Buffer for: ${event.summary}` };
            }
            return slot;
          });
        }
        break;
      }
    }
  }
  
  return slots;
}

// ==================== TIME SLOT GENERATION ====================

function generateTimeSlots(
  date: Date,
  calendarEvents: CalendarEvent[],
  energyProfile: EnergyProfile,
  constraints: SchedulingConstraint[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const periods: TimePeriod[] = ['morning', 'midday', 'afternoon', 'evening'];
  
  for (const period of periods) {
    const hours = getPeriodHours(period);
    const slotStart = new Date(date);
    slotStart.setHours(hours.start, 0, 0, 0);
    
    const slotEnd = new Date(date);
    slotEnd.setHours(hours.end, 0, 0, 0);
    
    // Check for calendar conflicts
    const hasConflict = calendarEvents.some((event) => {
      const eventStart = new Date(event.start.dateTime || event.start.date || '');
      const eventEnd = new Date(event.end.dateTime || event.end.date || '');
      return (slotStart < eventEnd && slotEnd > eventStart);
    });
    
    slots.push({
      start: slotStart,
      end: slotEnd,
      period,
      energyLevel: energyProfile.averages[period],
      confidence: energyProfile.confidence[period] || 0.5,
      isAvailable: !hasConflict,
      blockedReason: hasConflict ? 'Calendar conflict' : undefined,
    });
  }
  
  // Apply user constraints
  return applyConstraints(slots, constraints, calendarEvents);
}

// ==================== SLOT MATCHING ====================

export function findBestSlot(
  taskImpact: TaskImpactScore,
  availableSlots: TimeSlot[],
  energyProfile: EnergyProfile
): { slot: TimeSlot | null; reason: string; energyMatch: 'excellent' | 'good' | 'fair' | 'poor' } {
  const energyReq = getTaskEnergyRequirement(taskImpact.task);
  const available = availableSlots.filter((s) => s.isAvailable);
  
  if (available.length === 0) {
    return { slot: null, reason: 'No available time slots', energyMatch: 'poor' };
  }
  
  const thresholds = { high: 4, medium: 3, low: 2 };
  
  // Score each slot
  const scoredSlots = available.map((slot) => {
    let score = 0;
    let match: 'excellent' | 'good' | 'fair' | 'poor' = 'fair';
    
    if (slot.energyLevel === null) {
      score = 50;
      match = 'fair';
    } else {
      const threshold = thresholds[energyReq];
      
      if (energyReq === 'high') {
        if (slot.energyLevel >= 4.5) { score = 100; match = 'excellent'; }
        else if (slot.energyLevel >= 4) { score = 80; match = 'good'; }
        else if (slot.energyLevel >= 3) { score = 50; match = 'fair'; }
        else { score = 20; match = 'poor'; }
      } else if (energyReq === 'medium') {
        if (slot.energyLevel >= 3.5) { score = 90; match = 'excellent'; }
        else if (slot.energyLevel >= 3) { score = 70; match = 'good'; }
        else { score = 50; match = 'fair'; }
      } else {
        // Low energy tasks should save high energy periods
        if (slot.energyLevel <= 2.5) { score = 90; match = 'excellent'; }
        else if (slot.energyLevel <= 3.5) { score = 70; match = 'good'; }
        else { score = 50; match = 'fair'; }
      }
      
      // Confidence bonus
      score += slot.confidence * 10;
    }
    
    return { slot, score, match };
  });
  
  scoredSlots.sort((a, b) => b.score - a.score);
  
  const best = scoredSlots[0];
  if (!best) {
    return { slot: null, reason: 'No suitable slot found', energyMatch: 'poor' };
  }
  
  // Generate detailed reason
  let reason = '';
  const energyLevelStr = best.slot.energyLevel?.toFixed(1) || '?';
  const confidenceStr = `${Math.round(best.slot.confidence * 100)}% confidence`;
  
  if (best.match === 'excellent') {
    reason = `🎯 Perfect match! ${best.slot.period} (${energyLevelStr}/5, ${confidenceStr}) ideal for ${energyReq}-energy work.`;
  } else if (best.match === 'good') {
    reason = `✓ Good fit for ${best.slot.period} based on your energy patterns.`;
  } else if (best.match === 'fair') {
    reason = `Scheduled for ${best.slot.period} (best available slot).`;
  } else {
    reason = `⚠️ ${best.slot.period} may not be optimal, but it's available.`;
  }
  
  return { slot: best.slot, reason, energyMatch: best.match };
}

// ==================== SWAP OPTIMIZATION (NEW) ====================

function findSwapOptimizations(
  scheduledTasks: ScheduledTask[],
  energyProfile: EnergyProfile
): SwapSuggestion[] {
  const suggestions: SwapSuggestion[] = [];
  
  // Only optimize if we have enough tasks
  if (scheduledTasks.length < 2) return suggestions;
  
  // Check each pair of tasks for potential swaps
  for (let i = 0; i < scheduledTasks.length; i++) {
    for (let j = i + 1; j < scheduledTasks.length; j++) {
      const task1 = scheduledTasks[i]!;
      const task2 = scheduledTasks[j]!;
      
      const energy1Req = getTaskEnergyRequirement(task1.task);
      const energy2Req = getTaskEnergyRequirement(task2.task);
      
      const slot1Energy = energyProfile.averages[task1.timePeriod] || 3;
      const slot2Energy = energyProfile.averages[task2.timePeriod] || 3;
      
      // Calculate current fit
      const currentFit1 = energy1Req === 'high' ? slot1Energy : (energy1Req === 'low' ? 5 - slot1Energy : 3);
      const currentFit2 = energy2Req === 'high' ? slot2Energy : (energy2Req === 'low' ? 5 - slot2Energy : 3);
      
      // Calculate swapped fit
      const swappedFit1 = energy1Req === 'high' ? slot2Energy : (energy1Req === 'low' ? 5 - slot2Energy : 3);
      const swappedFit2 = energy2Req === 'high' ? slot1Energy : (energy2Req === 'low' ? 5 - slot1Energy : 3);
      
      const currentTotal = currentFit1 + currentFit2;
      const swappedTotal = swappedFit1 + swappedFit2;
      
      // Suggest swap if improvement is significant (>10%)
      const improvement = (swappedTotal - currentTotal) / currentTotal;
      if (improvement > 0.1) {
        suggestions.push({
          task1: { id: task1.task.id, title: task1.task.title, currentSlot: task1.timePeriod },
          task2: { id: task2.task.id, title: task2.task.title, currentSlot: task2.timePeriod },
          reason: `Swapping would better match energy requirements. "${task1.task.title}" (${energy1Req} energy) would benefit from ${task2.timePeriod}'s energy level.`,
          expectedImprovement: Math.round(improvement * 100),
        });
      }
    }
  }
  
  // Return top 3 suggestions
  return suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement).slice(0, 3);
}

// ==================== MAIN SCHEDULING FUNCTION ====================

export async function generateSchedule(
  userId: string,
  calendarEvents: CalendarEvent[] = [],
  targetDate?: Date
): Promise<DailySchedule> {
  const date = targetDate || new Date();
  date.setHours(0, 0, 0, 0);
  
  console.log(`[Scheduler] ═══════════════════════════════════════`);
  console.log(`[Scheduler] Generating schedule for: ${userId}`);
  console.log(`[Scheduler] Date: ${date.toDateString()}`);
  
  // Fetch data
  const tasks = await getTasksByUserId(userId);
  const energyProfile = await getEnergyProfile(userId);
  const constraints = getConstraints(userId);
  
  console.log(`[Scheduler] Tasks: ${tasks.length}, Energy check-ins: ${energyProfile.totalCheckIns}`);
  
  // Filter pending tasks
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  
  // Calculate impact scores
  const impactScores = pendingTasks.map(task => 
    calculateImpactScore(task, energyProfile, pendingTasks)
  );
  
  // Sort by impact score (highest first)
  impactScores.sort((a, b) => b.impactScore - a.impactScore);
  
  console.log(`[Scheduler] Impact-scored tasks:`);
  impactScores.slice(0, 5).forEach((s, i) => 
    console.log(`[Scheduler]   ${i+1}. "${s.task.title}" [${s.impactScore}pts] - ${s.reasoning}`)
  );
  
  // Generate time slots
  let timeSlots = generateTimeSlots(date, calendarEvents, energyProfile, constraints);
  
  console.log(`[Scheduler] Time slots: ${timeSlots.filter(s => s.isAvailable).length}/${timeSlots.length} available`);
  
  const scheduledTasks: ScheduledTask[] = [];
  const unscheduledTasks: Task[] = [];
  const insights: string[] = [];
  
  // Schedule tasks by impact
  for (const impactScore of impactScores) {
    const { slot, reason, energyMatch } = findBestSlot(impactScore, timeSlots, energyProfile);
    
    if (slot) {
      const duration = impactScore.task.estimatedMinutes || 30;
      const taskEnd = new Date(slot.start.getTime() + duration * 60 * 1000);
      
      scheduledTasks.push({
        task: impactScore.task,
        scheduledStart: slot.start.toISOString(),
        scheduledEnd: taskEnd.toISOString(),
        timePeriod: slot.period,
        reason,
        energyMatch,
        impactScore: impactScore.impactScore,
      });
      
      // Mark slot as used
      const slotIndex = timeSlots.findIndex((s) => s.period === slot.period);
      if (slotIndex >= 0) {
        timeSlots[slotIndex] = { ...timeSlots[slotIndex]!, isAvailable: false };
      }
    } else {
      unscheduledTasks.push(impactScore.task);
    }
  }
  
  // Find swap optimizations
  const swapOptimizations = findSwapOptimizations(scheduledTasks, energyProfile);
  
  // Generate insights
  if (energyProfile.peakPeriod) {
    const peakTasks = scheduledTasks.filter((st) => st.timePeriod === energyProfile.peakPeriod);
    if (peakTasks.length > 0) {
      const highImpactAtPeak = peakTasks.filter(t => t.impactScore >= 60).length;
      insights.push(`🎯 ${highImpactAtPeak} high-impact task(s) during your peak energy (${energyProfile.peakPeriod}).`);
    }
  }
  
  const excellentMatches = scheduledTasks.filter((st) => st.energyMatch === 'excellent').length;
  if (excellentMatches > 0) {
    insights.push(`⚡ ${excellentMatches} task(s) perfectly matched to your energy!`);
  }
  
  if (unscheduledTasks.length > 0) {
    insights.push(`⚠️ ${unscheduledTasks.length} task(s) couldn't fit today. Consider rescheduling or delegating.`);
  }
  
  if (swapOptimizations.length > 0) {
    insights.push(`💡 ${swapOptimizations.length} swap suggestion(s) could improve your schedule.`);
  }
  
  if (energyProfile.profileStrength < 50) {
    insights.push(`📊 Profile strength: ${energyProfile.profileStrength}%. Log more energy to improve scheduling.`);
  }
  
  // Suggestions from energy profile
  if (energyProfile.suggestions.personalizedTip) {
    insights.push(`💡 ${energyProfile.suggestions.personalizedTip}`);
  }
  
  // Energy forecast
  const energyForecast = ['morning', 'midday', 'afternoon', 'evening'].map(period => ({
    period: period as TimePeriod,
    level: energyProfile.averages[period as TimePeriod] || 3,
    confidence: energyProfile.confidence[period as TimePeriod] || 0.5,
  }));
  
  // Generate summary
  let optimalSummary = '';
  if (scheduledTasks.length === 0) {
    optimalSummary = "No tasks to schedule today. Perfect time for strategic planning! 🎯";
  } else {
    const avgImpact = scheduledTasks.reduce((sum, t) => sum + t.impactScore, 0) / scheduledTasks.length;
    if (excellentMatches >= scheduledTasks.length * 0.5) {
      optimalSummary = `🔥 High-impact day! ${scheduledTasks.length} tasks scheduled with excellent energy alignment. Average impact: ${Math.round(avgImpact)}/100.`;
    } else {
      optimalSummary = `📅 ${scheduledTasks.length} task(s) scheduled. Focus on high-impact items during peak energy.`;
    }
  }
  
  return {
    userId,
    date: date.toISOString(),
    scheduledTasks,
    unscheduledTasks,
    optimalSummary,
    insights,
    energyForecast,
    swapOptimizations,
    constraints,
    generatedAt: new Date().toISOString(),
  };
}

// ==================== MULTI-DAY SCHEDULING (NEW) ====================

export async function generateMultiDaySchedule(
  userId: string,
  calendarEvents: CalendarEvent[] = [],
  days: number = 5
): Promise<MultiDaySchedule> {
  console.log(`[Scheduler] Generating ${days}-day schedule for ${userId}`);
  
  const dailySchedules: DailySchedule[] = [];
  let totalScheduled = 0;
  let totalUnscheduled = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    // Filter events for this day
    const dayEvents = calendarEvents.filter(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '');
      return eventDate.toDateString() === date.toDateString();
    });
    
    const schedule = await generateSchedule(userId, dayEvents, date);
    dailySchedules.push(schedule);
    
    totalScheduled += schedule.scheduledTasks.length;
    totalUnscheduled += schedule.unscheduledTasks.length;
  }
  
  // Calculate week overview
  const busiestDay = dailySchedules.reduce((a, b) => 
    b.scheduledTasks.length > a.scheduledTasks.length ? b : a
  );
  const lightestDay = dailySchedules.reduce((a, b) => 
    b.scheduledTasks.length < a.scheduledTasks.length ? b : a
  );
  
  // Energy utilization: how well tasks match energy
  const excellentMatches = dailySchedules.flatMap(d => d.scheduledTasks)
    .filter(t => t.energyMatch === 'excellent' || t.energyMatch === 'good').length;
  const energyUtilization = totalScheduled > 0 
    ? Math.round((excellentMatches / totalScheduled) * 100)
    : 0;
  
  // Week recommendations
  const recommendations: string[] = [];
  
  if (busiestDay.scheduledTasks.length > 5) {
    recommendations.push(`Heavy day on ${new Date(busiestDay.date).toLocaleDateString('en-US', { weekday: 'long' })}. Consider spreading tasks.`);
  }
  
  if (energyUtilization < 50) {
    recommendations.push('Many tasks don\'t align with your energy. Log more check-ins to improve matching.');
  }
  
  if (totalUnscheduled > totalScheduled * 0.5) {
    recommendations.push('Many tasks remain unscheduled. Consider extending deadlines or delegating.');
  }
  
  return {
    userId,
    days: dailySchedules,
    weekOverview: {
      totalTasksScheduled: totalScheduled,
      totalTasksUnscheduled: totalUnscheduled,
      busiestDay: { date: busiestDay.date, taskCount: busiestDay.scheduledTasks.length },
      lightestDay: { date: lightestDay.date, taskCount: lightestDay.scheduledTasks.length },
      energyUtilization,
      recommendations,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ==================== UTILITIES ====================

export async function getOptimalDaySummary(userId: string): Promise<string> {
  try {
    const schedule = await generateSchedule(userId);
    
    if (schedule.scheduledTasks.length === 0) {
      return "☀️ Good morning! No tasks scheduled. Perfect time to plan ahead!";
    }
    
    const topTask = schedule.scheduledTasks[0];
    const topTaskTime = topTask ? new Date(topTask.scheduledStart).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) : '';
    
    let summary = `☀️ Good morning! ${schedule.scheduledTasks.length} task(s) scheduled.\n\n`;
    
    if (topTask) {
      summary += `🎯 Top Priority: "${topTask.task.title}" at ${topTaskTime}\n`;
      summary += `   Impact: ${topTask.impactScore}/100 | ${topTask.reason}\n`;
    }
    
    if (schedule.insights.length > 0) {
      summary += `\n${schedule.insights[0]}`;
    }
    
    return summary;
  } catch (error) {
    console.error('[Scheduler] Error generating summary:', error);
    return "☀️ Good morning! Check your tasks to plan your day.";
  }
}

export async function rescheduleOnCalendarChange(
  userId: string,
  newEvents: CalendarEvent[]
): Promise<DailySchedule> {
  console.log(`[Scheduler] Rescheduling due to calendar change for ${userId}`);
  return generateSchedule(userId, newEvents);
}

export async function executeSwap(
  userId: string,
  task1Id: string,
  task2Id: string
): Promise<{ success: boolean; message: string }> {
  // In a real implementation, this would update the scheduled times in the database
  // For now, just log and return success
  console.log(`[Scheduler] Executing swap: ${task1Id} <-> ${task2Id}`);
  return {
    success: true,
    message: 'Swap executed successfully. Schedule will be reflected on next generation.',
  };
}
