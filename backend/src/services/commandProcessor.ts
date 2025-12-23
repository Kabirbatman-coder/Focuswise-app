import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { getOAuthClient, insertEvent, listEvents, updateEvent, deleteEvent } from './googleCalendarService';
import { getTasksByUserId, createTask, updateTask, deleteTask, Task } from './taskService';
import { getEnergyProfile, getOptimalTimeSlots, TimePeriod } from './energyService';
import { generateSchedule } from './schedulerService';

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

console.log(`[CommandProcessor] Gemini API Key: ${GEMINI_API_KEY ? `SET (${GEMINI_API_KEY.length} chars)` : 'NOT SET'}`);

if (!GEMINI_API_KEY) {
  console.error('[CommandProcessor] ⚠️  WARNING: GEMINI_API_KEY is not set!');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Use a widely supported model ID for this library version
const model: GenerativeModel = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });

// Retry helper for rate limit errors
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || '';
      
      // Check if it's a rate limit error (429)
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Too Many Requests')) {
        const delay = baseDelayMs * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[CommandProcessor] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For non-rate-limit errors, throw immediately
      throw error;
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

// Wrapper for model.generateContent with retry logic
async function generateWithRetry(prompt: string): Promise<string> {
  return retryWithBackoff(async () => {
    const result = await model.generateContent(prompt);
    return result.response.text();
  });
}

// ==================== TYPES ====================

export type Intent = 
  | 'schedule_event'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'complete_task'
  | 'list_tasks'
  | 'list_events'
  | 'get_summary'
  | 'get_focus_suggestion'
  | 'reschedule_event'
  | 'create_goal'          // NEW: Multi-step goal
  | 'analyze_workload'     // NEW: Workload analysis
  | 'optimize_day'         // NEW: Day optimization
  | 'set_constraint'       // NEW: Set scheduling constraints
  | 'unknown';

export interface CommandResult {
  success: boolean;
  intent: Intent;
  response: string;
  data?: any;
  action?: string;
  reasoning?: ReasoningSummary | undefined;  // NEW: Structured reasoning
  followUp?: string | undefined;             // NEW: Suggested follow-up
}

export interface ParsedCommand {
  intent: Intent;
  entities: {
    title?: string;
    description?: string;
    date?: string;
    time?: string;
    dateTime?: string;
    endDateTime?: string;
    duration?: number;
    priority?: 'high' | 'medium' | 'low';
    taskId?: string;
    eventId?: string;
    query?: string;
    // NEW: Goal/project fields
    goalSteps?: string[];
    deadline?: string;
    constraints?: string[];
    energyPreference?: 'high' | 'medium' | 'low';
  };
  confidence: number;
  rawQuery: string;
}

// NEW: Structured reasoning summary
export interface ReasoningSummary {
  decision: string;           // What was decided
  factors: string[];          // Key factors considered
  energyContext?: string;     // How energy affected decision
  tradeoffs?: string;         // Any tradeoffs made
  confidence: number;         // 0-1 confidence in recommendation
}

// NEW: Goal decomposition
export interface Goal {
  id: string;
  title: string;
  deadline?: string | undefined;
  steps: GoalStep[];
  status: 'active' | 'completed' | 'paused';
  progress: number;
  createdAt: string;
}

export interface GoalStep {
  id: string;
  title: string;
  taskId?: string;
  status: 'pending' | 'in_progress' | 'completed';
  estimatedMinutes?: number;
  scheduledFor?: string;
  order: number;
}

// In-memory goal storage (would be DB in production)
const activeGoals: Map<string, Goal[]> = new Map();

// ==================== ENHANCED SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `You are FocusWise AI Chief of Staff — a premium productivity assistant for founders and high-performers.

YOUR ROLE: Help users maximize their impact by intelligently managing tasks, calendar, energy, and focus.

CORE CAPABILITIES:
1. schedule_event - Create calendar events with specific times (Google Calendar)
2. create_task - Add to-do items to task list
3. update_task - Modify existing tasks
4. delete_task - Remove tasks
5. complete_task - Mark a task as done
6. list_tasks - Show current tasks
7. list_events - Show calendar events
8. get_summary - Daily/weekly overview
9. get_focus_suggestion - What to work on NOW based on energy + priorities
10. reschedule_event - Move calendar events

PREMIUM CAPABILITIES:
11. create_goal - Break down big goals into actionable steps with deadlines
12. analyze_workload - Assess if user is overcommitted, suggest rebalancing
13. optimize_day - Reorganize today's schedule for maximum impact
14. set_constraint - Add scheduling rules (e.g., "no meetings before 10am")

INTELLIGENT SCHEDULING RULES:
- High-energy tasks → user's peak energy periods
- Creative work → morning (before decision fatigue)
- Admin/routine → low-energy periods
- Buffer time → before important meetings
- Batch similar tasks together

CONTEXT AWARENESS:
- Current time will be provided
- User's energy profile will be provided when available
- Recent tasks and events for context

RESPONSE FORMAT (JSON):
{
  "intent": "<intent_type>",
  "entities": {
    "title": "string",
    "description": "string (optional)",
    "date": "YYYY-MM-DD",
    "time": "HH:MM (24-hour)",
    "duration": number (minutes),
    "priority": "high|medium|low",
    "goalSteps": ["step1", "step2"] (for create_goal),
    "constraints": ["constraint1"] (for set_constraint),
    "energyPreference": "high|medium|low"
  },
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your decision"
}

KEYWORDS MAPPING:
- schedule/meeting/call/appointment/block → schedule_event
- task/remind/to-do/add → create_task
- done/complete/finished → complete_task
- goal/project/break down/plan → create_goal
- overloaded/too much/overwhelmed → analyze_workload
- optimize/reorganize/best order → optimize_day
- no meetings/block off/protect time → set_constraint

IMPORTANT: Be decisive and action-oriented. Founders need efficiency, not lengthy explanations.`;

// ==================== HELPER FUNCTIONS ====================

function parseDateTime(date?: string, time?: string): string | undefined {
  if (!date && !time) return undefined;
  
  const now = new Date();
  let targetDate = date ? new Date(date) : now;
  
  if (time) {
    const timeParts = time.split(':').map(Number);
    targetDate.setHours(timeParts[0] ?? 0, timeParts[1] ?? 0, 0, 0);
  }
  
  return targetDate.toISOString();
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Format time period for display
function formatTimePeriod(period: TimePeriod): string {
  const labels: Record<TimePeriod, string> = {
    early_morning: 'early morning (5-7 AM)',
    morning: 'morning (7-10 AM)',
    midday: 'midday (10 AM-1 PM)',
    afternoon: 'afternoon (1-5 PM)',
    evening: 'evening (5-8 PM)',
    night: 'night (8 PM+)',
  };
  return labels[period];
}

// ==================== PARSING ====================

export async function parseCommand(userQuery: string, context?: {
  energyProfile?: any;
  recentTasks?: Task[];
  upcomingEvents?: any[];
}): Promise<ParsedCommand> {
  const now = new Date();
  const currentDateTime = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = now.getHours();
  
  // Build context string
  let contextStr = '';
  if (context?.energyProfile?.peakPeriod) {
    contextStr += `\nUser's peak energy: ${context.energyProfile.peakPeriod}`;
    contextStr += `\nCurrent energy trend: ${context.energyProfile.weeklyTrend}`;
  }
  if (context?.recentTasks?.length) {
    const pendingCount = context.recentTasks.filter(t => t.status !== 'completed').length;
    const highPriority = context.recentTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;
    contextStr += `\nPending tasks: ${pendingCount} (${highPriority} high priority)`;
  }
  
  const prompt = `${SYSTEM_PROMPT}

Current date/time: ${currentDateTime}
Day: ${dayOfWeek}
Current hour: ${hour}:00
${contextStr}

User command: "${userQuery}"

Respond with ONLY the JSON object.`;

  try {
    const response = await generateWithRetry(prompt);
    
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      intent: parsed.intent || 'unknown',
      entities: parsed.entities || {},
      confidence: parsed.confidence || 0.5,
      rawQuery: userQuery,
    };
  } catch (error) {
    console.error('[CommandProcessor] Parse error:', error);
    return {
      intent: 'unknown',
      entities: {},
      confidence: 0,
      rawQuery: userQuery,
    };
  }
}

// ==================== RESPONSE GENERATION ====================

async function generateResponse(
  intent: Intent,
  success: boolean,
  data: any,
  userQuery: string,
  context?: { energyProfile?: any }
): Promise<{ response: string; reasoning?: ReasoningSummary; followUp?: string }> {
  const prompt = `You are FocusWise AI Chief of Staff. Generate a response for a founder.

User asked: "${userQuery}"
Action: ${intent}
Success: ${success}
Result: ${JSON.stringify(data)}
${context?.energyProfile ? `User energy profile: Peak at ${context.energyProfile.peakPeriod || 'unknown'}` : ''}

Generate a JSON response:
{
  "message": "Brief, action-oriented response (1-2 sentences max)",
  "reasoning": {
    "decision": "What you decided to do",
    "factors": ["factor1", "factor2"],
    "confidence": 0.0-1.0
  },
  "followUp": "Optional suggested next action (or null)"
}

Be concise. Founders value efficiency.`;

  try {
    const response = await generateWithRetry(prompt);
    let jsonStr = response.trim();
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      response: parsed.message || (success ? "Done!" : "I couldn't complete that."),
      reasoning: parsed.reasoning,
      followUp: parsed.followUp,
    };
  } catch (error: any) {
    // Check for quota/rate limit errors
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        response: "⏳ I'm getting too many requests right now. Please try again in a few seconds.",
      };
    }
    return {
      response: success 
        ? "✓ Done! I've taken care of that."
        : "I couldn't complete that action. Please try again.",
    };
  }
}

// ==================== GOAL DECOMPOSITION (NEW) ====================

async function decomposeGoal(
  title: string,
  deadline?: string,
  context?: { energyProfile?: any }
): Promise<{ steps: GoalStep[]; reasoning: ReasoningSummary }> {
  const prompt = `You are a productivity expert. Break down this goal into 3-7 actionable steps.

Goal: "${title}"
${deadline ? `Deadline: ${deadline}` : ''}
${context?.energyProfile?.peakPeriod ? `User peak energy: ${context.energyProfile.peakPeriod}` : ''}

Rules:
- Each step should be completable in 15-90 minutes
- Order steps logically (dependencies first)
- Mark cognitively demanding steps as "high" energy
- Include time estimates

Return JSON:
{
  "steps": [
    { "title": "Step name", "estimatedMinutes": 30, "energyRequired": "high|medium|low", "order": 1 }
  ],
  "reasoning": {
    "decision": "How you structured this goal",
    "factors": ["factor1", "factor2"],
    "confidence": 0.9
  }
}`;

  try {
    const response = await generateWithRetry(prompt);
    let jsonStr = response.trim();
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonStr);
    
    const steps: GoalStep[] = parsed.steps.map((s: any, idx: number) => ({
      id: generateId('step'),
      title: s.title,
      status: 'pending',
      estimatedMinutes: s.estimatedMinutes || 30,
      order: s.order || idx + 1,
    }));
    
    return {
      steps,
      reasoning: parsed.reasoning || {
        decision: 'Decomposed goal into actionable steps',
        factors: ['Logical ordering', 'Time-bounded tasks'],
        confidence: 0.8,
      },
    };
  } catch (error) {
    console.error('[CommandProcessor] Goal decomposition error:', error);
    // Fallback: create a simple 3-step plan
    return {
      steps: [
        { id: generateId('step'), title: `Plan: ${title}`, status: 'pending', estimatedMinutes: 30, order: 1 },
        { id: generateId('step'), title: `Execute: ${title}`, status: 'pending', estimatedMinutes: 60, order: 2 },
        { id: generateId('step'), title: `Review: ${title}`, status: 'pending', estimatedMinutes: 15, order: 3 },
      ],
      reasoning: {
        decision: 'Created basic plan-execute-review structure',
        factors: ['Fallback structure used'],
        confidence: 0.5,
      },
    };
  }
}

// ==================== WORKLOAD ANALYSIS (NEW) ====================

async function analyzeWorkload(
  userId: string,
  tasks: Task[],
  events: any[],
  energyProfile?: any
): Promise<{ analysis: string; recommendations: string[]; overloadScore: number; reasoning: ReasoningSummary }> {
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const highPriority = pendingTasks.filter(t => t.priority === 'high').length;
  const totalEstimatedMinutes = pendingTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 30), 0);
  const todayEvents = events.length;
  
  const prompt = `Analyze this founder's workload:

Pending tasks: ${pendingTasks.length} (${highPriority} high priority)
Total estimated work: ${Math.round(totalEstimatedMinutes / 60)} hours
Today's meetings: ${todayEvents}
${energyProfile?.weeklyTrend ? `Energy trend: ${energyProfile.weeklyTrend}` : ''}

High priority task titles:
${pendingTasks.filter(t => t.priority === 'high').map(t => `- ${t.title}`).join('\n') || 'None'}

Return JSON:
{
  "analysis": "Brief assessment (2-3 sentences)",
  "recommendations": ["rec1", "rec2", "rec3"],
  "overloadScore": 0.0-1.0 (0=manageable, 1=severely overloaded),
  "reasoning": {
    "decision": "Your assessment",
    "factors": ["factor1", "factor2"],
    "confidence": 0.8
  }
}`;

  try {
    const response = await generateWithRetry(prompt);
    let jsonStr = response.trim();
    
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    // Heuristic fallback
    const overloadScore = Math.min(1, (highPriority * 0.2 + pendingTasks.length * 0.05 + todayEvents * 0.1));
    return {
      analysis: `You have ${pendingTasks.length} pending tasks and ${todayEvents} events today.`,
      recommendations: [
        highPriority > 3 ? 'Consider delegating some high-priority items' : 'Prioritization looks manageable',
        totalEstimatedMinutes > 480 ? 'More than 8 hours of work planned - be selective' : 'Workload appears reasonable',
      ],
      overloadScore,
      reasoning: {
        decision: 'Heuristic analysis performed',
        factors: ['Task count', 'Priority distribution', 'Meeting load'],
        confidence: 0.6,
      },
    };
  }
}

// ==================== DAY OPTIMIZATION (NEW) ====================

async function optimizeDay(
  userId: string,
  tasks: Task[],
  events: any[],
  energyProfile?: any
): Promise<{ schedule: any[]; reasoning: ReasoningSummary }> {
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  
  // Use the scheduler service for optimization
  const schedule = await generateSchedule(userId, events);
  
  // Generate explanation
  const reasoning: ReasoningSummary = {
    decision: schedule.optimalSummary,
    factors: schedule.insights,
    energyContext: energyProfile?.peakPeriod 
      ? `Scheduled high-impact work during your ${formatTimePeriod(energyProfile.peakPeriod)}`
      : 'Log more energy check-ins for personalized optimization',
    confidence: energyProfile?.totalCheckIns > 10 ? 0.85 : 0.6,
  };
  
  return {
    schedule: schedule.scheduledTasks,
    reasoning,
  };
}

// ==================== COMMAND EXECUTION ====================

export async function executeCommand(
  parsed: ParsedCommand,
  userId: string,
  accessToken?: string,
  context?: { energyProfile?: any }
): Promise<CommandResult> {
  const { intent, entities, rawQuery } = parsed;
  
  console.log(`[CommandProcessor] Executing: ${intent}`, entities);
  
  try {
    switch (intent) {
      // ==================== CALENDAR EVENTS ====================
      case 'schedule_event': {
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "📅 I need calendar access. Please sign in with Google from the Calendar tab first!",
          };
        }
        
        const startDateTime = parseDateTime(entities.date, entities.time);
        if (!startDateTime) {
          return {
            success: false,
            intent,
            response: "🕐 Please specify a time, e.g., 'Schedule meeting at 3 PM tomorrow'",
          };
        }
        
        const duration = entities.duration || 60;
        const endDateTime = new Date(new Date(startDateTime).getTime() + duration * 60000).toISOString();
        const eventTitle = entities.title || 'Meeting';
        
        // Intelligent scheduling check
        let schedulingNote = '';
        if (context?.energyProfile?.peakPeriod) {
          const eventHour = new Date(startDateTime).getHours();
          const peakHours: Record<string, number[]> = {
            early_morning: [5, 7],
            morning: [7, 10],
            midday: [10, 13],
            afternoon: [13, 17],
            evening: [17, 20],
            night: [20, 24],
          };
          const peakPeriod = context.energyProfile.peakPeriod as string;
          const peak = peakHours[peakPeriod] || [9, 11];
          
          if (peak[0] !== undefined && peak[1] !== undefined && eventHour >= peak[0] && eventHour < peak[1]) {
            schedulingNote = ' Scheduled during your peak energy time! 🎯';
          }
        }
        
        const event = {
          summary: eventTitle,
          description: entities.description || 'Scheduled by FocusWise AI',
          start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        };
        
        const auth = getOAuthClient(accessToken);
        const createdEvent = await insertEvent(auth, event);
        
        const { response, reasoning, followUp } = await generateResponse(intent, true, createdEvent, rawQuery, context);
        
        return {
          success: true,
          intent,
          response: response + schedulingNote,
          data: createdEvent,
          action: 'calendar_event_created',
          reasoning,
          followUp,
        };
      }
      
      // ==================== TASKS ====================
      case 'create_task': {
        // Smart priority inference
        let priority = entities.priority || 'medium';
        const lowerQuery = rawQuery.toLowerCase();
        if (lowerQuery.includes('urgent') || lowerQuery.includes('asap') || lowerQuery.includes('critical')) {
          priority = 'high';
        } else if (lowerQuery.includes('sometime') || lowerQuery.includes('when possible') || lowerQuery.includes('low priority')) {
          priority = 'low';
        }
        
        // Estimate time if not provided
        let estimatedMinutes = entities.duration;
        if (!estimatedMinutes) {
          // Heuristic based on task type
          const title = (entities.title || '').toLowerCase();
          if (title.includes('email') || title.includes('reply') || title.includes('respond')) {
            estimatedMinutes = 15;
          } else if (title.includes('review') || title.includes('read') || title.includes('check')) {
            estimatedMinutes = 30;
          } else if (title.includes('write') || title.includes('create') || title.includes('build')) {
            estimatedMinutes = 60;
          } else if (title.includes('plan') || title.includes('design') || title.includes('strategy')) {
            estimatedMinutes = 90;
          } else {
            estimatedMinutes = 30;
          }
        }
        
        const task = await createTask({
          userId,
          title: entities.title || 'New Task',
          description: entities.description,
          priority,
          dueDate: entities.date,
          status: 'pending',
          estimatedMinutes,
        });
        
        const { response, reasoning, followUp } = await generateResponse(intent, true, task, rawQuery, context);
        
        return {
          success: true,
          intent,
          response,
          data: task,
          action: 'task_created',
          reasoning,
          followUp,
        };
      }
      
      case 'complete_task': {
        // Find task by title match
        const tasks = await getTasksByUserId(userId);
        const query = (entities.query || entities.title || rawQuery).toLowerCase();
        
        const matchingTask = tasks.find(t => 
          t.title.toLowerCase().includes(query) || 
          query.includes(t.title.toLowerCase())
        );
        
        if (!matchingTask) {
          return {
            success: false,
            intent,
            response: "I couldn't find that task. Try 'show my tasks' to see your list.",
          };
        }
        
        const completedTask = await updateTask(matchingTask.id, { status: 'completed' });
        
        // Check if this was part of a goal
        let goalProgress = '';
        const userGoals = activeGoals.get(userId) || [];
        for (const goal of userGoals) {
          const step = goal.steps.find(s => s.taskId === matchingTask.id);
          if (step) {
            step.status = 'completed';
            goal.progress = goal.steps.filter(s => s.status === 'completed').length / goal.steps.length * 100;
            goalProgress = ` 📈 Goal "${goal.title}" is ${Math.round(goal.progress)}% complete!`;
            break;
          }
        }
        
        return {
          success: true,
          intent,
          response: `✅ Marked "${matchingTask.title}" as complete!${goalProgress}`,
          data: completedTask,
          action: 'task_completed',
        };
      }
      
      case 'update_task': {
        if (!entities.taskId && !entities.query && !entities.title) {
          return {
            success: false,
            intent,
            response: "Which task should I update? Please specify.",
          };
        }
        
        // Find task
        const tasks = await getTasksByUserId(userId);
        const query = (entities.query || entities.title || '').toLowerCase();
        const task = entities.taskId 
          ? tasks.find(t => t.id === entities.taskId)
          : tasks.find(t => t.title.toLowerCase().includes(query));
        
        if (!task) {
          return {
            success: false,
            intent,
            response: "I couldn't find that task.",
          };
        }
        
        const updatedTask = await updateTask(task.id, {
          title: entities.title || undefined,
          description: entities.description || undefined,
          priority: entities.priority || undefined,
          dueDate: entities.date || undefined,
        });
        
        return {
          success: true,
          intent,
          response: `✓ Updated "${task.title}"`,
          data: updatedTask,
          action: 'task_updated',
        };
      }
      
      case 'delete_task': {
        const tasks = await getTasksByUserId(userId);
        const query = (entities.query || entities.title || '').toLowerCase();
        const task = tasks.find(t => t.title.toLowerCase().includes(query));
        
        if (!task) {
          return {
            success: false,
            intent,
            response: "I couldn't find that task to delete.",
          };
        }
        
        await deleteTask(task.id);
        
        return {
          success: true,
          intent,
          response: `🗑️ Deleted "${task.title}"`,
          action: 'task_deleted',
        };
      }
      
      case 'list_tasks': {
        const tasks = await getTasksByUserId(userId);
        const pending = tasks.filter(t => t.status !== 'completed');
        
        if (pending.length === 0) {
          return {
            success: true,
            intent,
            response: "🎉 No pending tasks! You're all caught up.",
            data: [],
            followUp: "Would you like me to help plan your next goal?",
          };
        }
        
        const { response, reasoning } = await generateResponse(intent, true, { count: pending.length, tasks: pending }, rawQuery, context);
        
        return {
          success: true,
          intent,
          response,
          data: pending,
          action: 'tasks_listed',
          reasoning,
        };
      }
      
      // ==================== CALENDAR ====================
      case 'list_events': {
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "I need calendar access. Please sign in with Google first.",
          };
        }
        
        const auth = getOAuthClient(accessToken);
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        
        const events = await listEvents(auth, now.toISOString(), endOfWeek.toISOString());
        const { response, reasoning } = await generateResponse(intent, true, events, rawQuery, context);
        
        return {
          success: true,
          intent,
          response,
          data: events,
          action: 'events_listed',
          reasoning,
        };
      }
      
      case 'reschedule_event': {
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "I need calendar access to reschedule events.",
          };
        }
        
        if (!entities.eventId) {
          return {
            success: false,
            intent,
            response: "Which event should I reschedule?",
          };
        }
        
        const newStartTime = parseDateTime(entities.date, entities.time);
        if (!newStartTime) {
          return {
            success: false,
            intent,
            response: "When should I move this to?",
          };
        }
        
        const duration = entities.duration || 60;
        const newEndTime = new Date(new Date(newStartTime).getTime() + duration * 60000).toISOString();
        
        const auth = getOAuthClient(accessToken);
        const updatedEvent = await updateEvent(auth, entities.eventId, {
          start: { dateTime: newStartTime, timeZone: 'UTC' },
          end: { dateTime: newEndTime, timeZone: 'UTC' },
        });
        
        return {
          success: true,
          intent,
          response: `📅 Rescheduled to ${new Date(newStartTime).toLocaleString()}`,
          data: updatedEvent,
          action: 'event_rescheduled',
        };
      }
      
      // ==================== SUMMARIES & SUGGESTIONS ====================
      case 'get_summary': {
        const tasks = await getTasksByUserId(userId);
        let events: any[] = [];
        
        if (accessToken) {
          try {
            const auth = getOAuthClient(accessToken);
            const now = new Date();
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            events = await listEvents(auth, now.toISOString(), endOfDay.toISOString()) || [];
          } catch (e) {
            console.warn('[CommandProcessor] Could not fetch events');
          }
        }
        
        const pending = tasks.filter(t => t.status !== 'completed');
        const highPriority = pending.filter(t => t.priority === 'high');
        
        const summaryPrompt = `Generate a brief executive summary for a founder:

Pending tasks: ${pending.length} (${highPriority.length} high priority)
Today's events: ${events.length}
${highPriority.length > 0 ? `\nHigh priority: ${highPriority.map(t => t.title).join(', ')}` : ''}
${context?.energyProfile?.peakPeriod ? `\nPeak energy time: ${context.energyProfile.peakPeriod}` : ''}
${context?.energyProfile?.weeklyTrend ? `\nEnergy trend: ${context.energyProfile.weeklyTrend}` : ''}

Keep it actionable. Max 4 sentences. Include one specific recommendation.`;

        const summary = await generateWithRetry(summaryPrompt);
        
        return {
          success: true,
          intent,
          response: summary,
          data: { tasks: pending, events },
          action: 'summary_generated',
        };
      }
      
      case 'get_focus_suggestion': {
        const tasks = await getTasksByUserId(userId);
        const pending = tasks.filter(t => t.status !== 'completed');
        
        let events: any[] = [];
        if (accessToken) {
          try {
            const auth = getOAuthClient(accessToken);
            const now = new Date();
            const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            events = await listEvents(auth, now.toISOString(), in2Hours.toISOString()) || [];
          } catch (e) { }
        }
        
        // Get optimal time slots based on energy
        const optimalSlots = context?.energyProfile 
          ? await getOptimalTimeSlots(userId, 'high')
          : [];
        
        const now = new Date();
        const hour = now.getHours();
        
        const focusPrompt = `You are a Chief of Staff. Recommend what to focus on RIGHT NOW.

Current time: ${hour}:00
Pending tasks (${pending.length}):
${pending.slice(0, 5).map(t => `- ${t.title} [${t.priority}]${t.dueDate ? ` (due: ${t.dueDate})` : ''}`).join('\n')}

Next 2 hours events: ${events.length > 0 ? events.map(e => e.summary).join(', ') : 'None'}

${optimalSlots.length > 0 ? `User's optimal time slots: ${optimalSlots.map(s => s.period).join(', ')}` : ''}
${context?.energyProfile?.peakPeriod ? `Current period vs peak: ${hour >= 7 && hour < 10 ? 'morning' : hour >= 10 && hour < 13 ? 'midday' : 'afternoon'} vs ${context.energyProfile.peakPeriod}` : ''}

Give ONE specific recommendation. Be direct. Max 2 sentences.`;

        const suggestion = await generateWithRetry(focusPrompt);
        
        return {
          success: true,
          intent,
          response: `🎯 ${suggestion}`,
          data: { tasks: pending, events, optimalSlots },
          action: 'focus_suggested',
          followUp: pending.length > 0 ? `Should I mark "${pending[0]?.title}" as in progress?` : undefined,
        };
      }
      
      // ==================== PREMIUM FEATURES ====================
      case 'create_goal': {
        const goalTitle = entities.title || rawQuery.replace(/goal|project|plan|create/gi, '').trim();
        
        if (!goalTitle) {
          return {
            success: false,
            intent,
            response: "What goal would you like to break down?",
          };
        }
        
        const { steps, reasoning } = await decomposeGoal(goalTitle, entities.deadline, context);
        
        // Create a Goal object
        const goal: Goal = {
          id: generateId('goal'),
          title: goalTitle,
          deadline: entities.deadline,
          steps,
          status: 'active',
          progress: 0,
          createdAt: new Date().toISOString(),
        };
        
        // Store goal
        const userGoals = activeGoals.get(userId) || [];
        userGoals.push(goal);
        activeGoals.set(userId, userGoals);
        
        // Create tasks for each step
        for (const step of steps) {
          const task = await createTask({
            userId,
            title: `${goalTitle}: ${step.title}`,
            description: `Step ${step.order} of goal: ${goalTitle}`,
            priority: step.order <= 2 ? 'high' : 'medium',
            estimatedMinutes: step.estimatedMinutes,
            status: 'pending',
          });
          step.taskId = task.id;
        }
        
        return {
          success: true,
          intent,
          response: `📋 Broke down "${goalTitle}" into ${steps.length} actionable steps. First up: "${steps[0]?.title}"`,
          data: goal,
          action: 'goal_created',
          reasoning,
          followUp: `Should I schedule time to work on step 1?`,
        };
      }
      
      case 'analyze_workload': {
        const tasks = await getTasksByUserId(userId);
        let events: any[] = [];
        
        if (accessToken) {
          try {
            const auth = getOAuthClient(accessToken);
            const now = new Date();
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            events = await listEvents(auth, now.toISOString(), endOfDay.toISOString()) || [];
          } catch (e) { }
        }
        
        const { analysis, recommendations, overloadScore, reasoning } = await analyzeWorkload(
          userId, tasks, events, context?.energyProfile
        );
        
        let statusEmoji = '✅';
        if (overloadScore > 0.7) statusEmoji = '🔴';
        else if (overloadScore > 0.4) statusEmoji = '🟡';
        
        const recStr = recommendations.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n');
        
        return {
          success: true,
          intent,
          response: `${statusEmoji} **Workload Analysis**\n\n${analysis}\n\n**Recommendations:**\n${recStr}`,
          data: { overloadScore, recommendations },
          action: 'workload_analyzed',
          reasoning,
        };
      }
      
      case 'optimize_day': {
        const tasks = await getTasksByUserId(userId);
        let events: any[] = [];
        
        if (accessToken) {
          try {
            const auth = getOAuthClient(accessToken);
            const now = new Date();
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            events = await listEvents(auth, now.toISOString(), endOfDay.toISOString()) || [];
          } catch (e) { }
        }
        
        const { schedule, reasoning } = await optimizeDay(userId, tasks, events, context?.energyProfile);
        
        if (schedule.length === 0) {
          return {
            success: true,
            intent,
            response: "No tasks to schedule today. Enjoy your free time! 🎉",
            data: [],
            reasoning,
          };
        }
        
        const scheduleStr = schedule.slice(0, 5).map(s => {
          const time = new Date(s.scheduledStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return `• ${time}: ${s.task.title} (${s.energyMatch} match)`;
        }).join('\n');
        
        return {
          success: true,
          intent,
          response: `📅 **Optimized Schedule**\n\n${scheduleStr}\n\n${reasoning.energyContext || ''}`,
          data: schedule,
          action: 'day_optimized',
          reasoning,
        };
      }
      
      case 'set_constraint': {
        // For now, just acknowledge - would need a constraints table
        const constraint = entities.constraints?.[0] || rawQuery;
        
        return {
          success: true,
          intent,
          response: `✓ I'll remember: "${constraint}". This preference will be considered in future scheduling.`,
          data: { constraint },
          action: 'constraint_set',
          followUp: "Want me to reoptimize today's schedule with this constraint?",
        };
      }
      
      // ==================== FALLBACK ====================
      default: {
        const fallbackPrompt = `You are FocusWise AI. User said: "${rawQuery}"

This doesn't match a known action. Generate a helpful response that:
1. Acknowledges their request
2. Offers relevant alternatives
3. Stays brief (2 sentences max)`;

        const fallbackResponse = await generateWithRetry(fallbackPrompt);
        
        return {
          success: false,
          intent: 'unknown',
          response: fallbackResponse.trim(),
        };
      }
    }
  } catch (error: any) {
    console.error('[CommandProcessor] Error:', error);
    return {
      success: false,
      intent,
      response: `I encountered an issue: ${error.message}. Please try again.`,
    };
  }
}

// ==================== MAIN ENTRY POINT ====================

export async function processCommand(
  userQuery: string,
  userId: string,
  accessToken?: string
): Promise<CommandResult> {
  console.log(`[CommandProcessor] Processing: "${userQuery}" for user: ${userId}`);
  
  // Gather context for better responses
  let context: { energyProfile?: any; recentTasks?: Task[] } = {};
  
  try {
    context.energyProfile = await getEnergyProfile(userId);
    context.recentTasks = await getTasksByUserId(userId);
  } catch (e) {
    console.warn('[CommandProcessor] Could not fetch context');
  }
  
  // Parse with context
  const parsed = await parseCommand(userQuery, context);
  console.log(`[CommandProcessor] Intent: ${parsed.intent} (confidence: ${parsed.confidence})`);
  
  // Execute with context
  const result = await executeCommand(parsed, userId, accessToken, context);
  
  return result;
}
