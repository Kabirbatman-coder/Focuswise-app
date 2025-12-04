import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { getOAuthClient, insertEvent, listEvents, updateEvent, deleteEvent } from './googleCalendarService';
import { getTasksByUserId, createTask, updateTask, deleteTask, Task } from './taskService';

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Debug: Log API key status (not the actual key for security)
console.log(`[CommandProcessor] Gemini API Key: ${GEMINI_API_KEY ? `SET (${GEMINI_API_KEY.length} chars, starts with ${GEMINI_API_KEY.substring(0, 8)}...)` : 'NOT SET'}`);

if (!GEMINI_API_KEY) {
  console.error('[CommandProcessor] ⚠️  WARNING: GEMINI_API_KEY is not set in .env file!');
  console.error('[CommandProcessor] Get your free API key from: https://aistudio.google.com/app/apikey');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// Use gemini-1.5-flash-latest or gemini-pro as fallback
const model: GenerativeModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Intent types that the AI can recognize
export type Intent = 
  | 'schedule_event'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'list_tasks'
  | 'list_events'
  | 'get_summary'
  | 'get_focus_suggestion'
  | 'reschedule_event'
  | 'unknown';

export interface CommandResult {
  success: boolean;
  intent: Intent;
  response: string;
  data?: any;
  action?: string;
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
  };
  confidence: number;
  rawQuery: string;
}

// System prompt for Gemini to understand commands
const SYSTEM_PROMPT = `You are FocusWise AI Chief of Staff, a helpful assistant that manages tasks and calendar events. 
You help users stay productive and organized.

IMPORTANT DISTINCTION:
- Use "schedule_event" for: meetings, appointments, calls, events WITH A SPECIFIC TIME (goes to Google Calendar)
- Use "create_task" for: to-do items, reminders, things to do WITHOUT a specific meeting time (stored locally)

Keywords for schedule_event: "schedule", "meeting", "appointment", "call at", "event at", "block time"
Keywords for create_task: "task", "remind", "to-do", "add to list", "need to do"

Your capabilities:
1. Schedule calendar events (schedule_event) - Creates event in Google Calendar with specific time
2. Create tasks (create_task) - Creates a to-do item in the task list
3. Update existing tasks (update_task)
4. Delete tasks (delete_task)
5. List tasks (list_tasks)
6. List calendar events (list_events)
7. Provide daily/weekly summaries (get_summary)
8. Suggest what to focus on (get_focus_suggestion)
9. Reschedule events (reschedule_event)

When the user gives a command, analyze it and respond with a JSON object:
{
  "intent": "<one of the intent types above>",
  "entities": {
    "title": "event or task title if mentioned",
    "description": "any description mentioned",
    "date": "date mentioned in YYYY-MM-DD format",
    "time": "time mentioned in HH:MM format (24-hour)",
    "duration": "duration in minutes if mentioned",
    "priority": "high/medium/low if mentioned for tasks",
    "query": "the search query if looking for something specific"
  },
  "confidence": 0.0-1.0
}

Important:
- Convert relative times like "5 PM" to 24-hour format "17:00"
- Convert relative dates like "today", "tomorrow" to actual dates
- If the time zone matters, assume the user's local time
- Current date/time will be provided for context
- If you can't determine something, leave it out of entities
- Be friendly and helpful in your understanding`;

// Parse the user's command using Gemini
export async function parseCommand(userQuery: string): Promise<ParsedCommand> {
  const now = new Date();
  const currentDateTime = now.toISOString();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  const prompt = `${SYSTEM_PROMPT}

Current date/time: ${currentDateTime}
Day of week: ${dayOfWeek}

User command: "${userQuery}"

Respond with ONLY the JSON object, no additional text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response (handle markdown code blocks)
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
    console.error('[CommandProcessor] Error parsing command:', error);
    return {
      intent: 'unknown',
      entities: {},
      confidence: 0,
      rawQuery: userQuery,
    };
  }
}

// Generate a natural language response using Gemini
async function generateResponse(
  intent: Intent,
  success: boolean,
  data: any,
  userQuery: string
): Promise<string> {
  const prompt = `You are FocusWise AI Chief of Staff. Generate a friendly, concise response.

User asked: "${userQuery}"
Action taken: ${intent}
Success: ${success}
Result data: ${JSON.stringify(data)}

Guidelines:
- Be warm and professional
- Keep it brief (1-2 sentences)
- If success, confirm what was done
- If failed, explain why and suggest alternatives
- Use the user's name if available

Respond with ONLY the message text, no quotes or formatting.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('[CommandProcessor] Error generating response:', error);
    return success 
      ? "Done! I've taken care of that for you."
      : "I couldn't complete that action. Please try again.";
  }
}

// Helper: Parse date and time to ISO string
function parseDateTime(date?: string, time?: string): string | undefined {
  if (!date && !time) return undefined;
  
  const now = new Date();
  let targetDate = date ? new Date(date) : now;
  
  if (time) {
    const timeParts = time.split(':').map(Number);
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;
    targetDate.setHours(hours, minutes, 0, 0);
  }
  
  return targetDate.toISOString();
}

// Execute the parsed command
export async function executeCommand(
  parsed: ParsedCommand,
  userId: string,
  accessToken?: string
): Promise<CommandResult> {
  const { intent, entities, rawQuery } = parsed;
  
  console.log(`[CommandProcessor] Executing intent: ${intent}`, entities);
  
  try {
    switch (intent) {
      case 'schedule_event': {
        console.log('[CommandProcessor] Schedule event - accessToken:', accessToken ? 'PROVIDED' : 'MISSING');
        console.log('[CommandProcessor] Schedule event - entities:', JSON.stringify(entities));
        
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "📅 I need calendar access to schedule events. Please sign in with Google from the Calendar tab first, then try again!",
          };
        }
        
        const startDateTime = parseDateTime(entities.date, entities.time);
        console.log('[CommandProcessor] Parsed startDateTime:', startDateTime);
        
        if (!startDateTime) {
          // Try to be helpful about the time format
          return {
            success: false,
            intent,
            response: "🕐 I couldn't understand the time. Please try something like 'Schedule a meeting at 3 PM tomorrow' or 'Schedule call at 15:00 on December 5th'",
          };
        }
        
        const duration = entities.duration || 60; // Default 1 hour
        const endDateTime = new Date(new Date(startDateTime).getTime() + duration * 60000).toISOString();
        
        const eventTitle = entities.title || 'Meeting';
        const event = {
          summary: eventTitle,
          description: entities.description || 'Scheduled by FocusWise AI',
          start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
          end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
        };
        
        console.log('[CommandProcessor] Creating calendar event:', JSON.stringify(event));
        
        try {
          const auth = getOAuthClient(accessToken);
          const createdEvent = await insertEvent(auth, event);
          
          console.log('[CommandProcessor] ✅ Calendar event created:', createdEvent.id);
          
          const response = await generateResponse(intent, true, createdEvent, rawQuery);
          return {
            success: true,
            intent,
            response,
            data: createdEvent,
            action: 'calendar_event_created',
          };
        } catch (calendarError: any) {
          console.error('[CommandProcessor] Calendar API error:', calendarError.message);
          return {
            success: false,
            intent,
            response: `📅 I couldn't add this to your calendar. Error: ${calendarError.message}. Try signing out and back in from the Calendar tab.`,
          };
        }
      }
      
      case 'create_task': {
        const task = await createTask({
          userId,
          title: entities.title || 'New Task',
          description: entities.description,
          priority: entities.priority || 'medium',
          dueDate: entities.date,
          status: 'pending',
        });
        
        const response = await generateResponse(intent, true, task, rawQuery);
        return {
          success: true,
          intent,
          response,
          data: task,
          action: 'task_created',
        };
      }
      
      case 'update_task': {
        if (!entities.taskId) {
          return {
            success: false,
            intent,
            response: "Which task would you like me to update? Please specify the task.",
          };
        }
        
        const updatedTask = await updateTask(entities.taskId, {
          title: entities.title,
          description: entities.description,
          priority: entities.priority,
          dueDate: entities.date,
        });
        
        const response = await generateResponse(intent, true, updatedTask, rawQuery);
        return {
          success: true,
          intent,
          response,
          data: updatedTask,
          action: 'task_updated',
        };
      }
      
      case 'delete_task': {
        if (!entities.taskId) {
          return {
            success: false,
            intent,
            response: "Which task should I delete? Please specify the task.",
          };
        }
        
        await deleteTask(entities.taskId);
        const response = await generateResponse(intent, true, { deleted: true }, rawQuery);
        return {
          success: true,
          intent,
          response,
          action: 'task_deleted',
        };
      }
      
      case 'list_tasks': {
        const tasks = await getTasksByUserId(userId);
        const response = await generateResponse(intent, true, tasks, rawQuery);
        return {
          success: true,
          intent,
          response,
          data: tasks,
          action: 'tasks_listed',
        };
      }
      
      case 'list_events': {
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "I need calendar access to show your events. Please sign in with Google first.",
          };
        }
        
        const auth = getOAuthClient(accessToken);
        const now = new Date();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        
        const events = await listEvents(auth, now.toISOString(), endOfWeek.toISOString());
        const response = await generateResponse(intent, true, events, rawQuery);
        return {
          success: true,
          intent,
          response,
          data: events,
          action: 'events_listed',
        };
      }
      
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
            console.warn('[CommandProcessor] Could not fetch events for summary');
          }
        }
        
        // Generate a comprehensive summary using Gemini
        const summaryPrompt = `You are FocusWise AI. Generate a helpful daily summary.

Tasks: ${JSON.stringify(tasks)}
Today's Events: ${JSON.stringify(events)}
Current time: ${new Date().toISOString()}

Create a brief, friendly summary of:
1. Pending tasks and their priorities
2. Upcoming events today
3. A motivational productivity tip

Keep it concise and actionable.`;

        const summaryResult = await model.generateContent(summaryPrompt);
        const summary = summaryResult.response.text();
        
        return {
          success: true,
          intent,
          response: summary,
          data: { tasks, events },
          action: 'summary_generated',
        };
      }
      
      case 'get_focus_suggestion': {
        const tasks = await getTasksByUserId(userId);
        let events: any[] = [];
        
        if (accessToken) {
          try {
            const auth = getOAuthClient(accessToken);
            const now = new Date();
            const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
            events = await listEvents(auth, now.toISOString(), in2Hours.toISOString()) || [];
          } catch (e) {
            console.warn('[CommandProcessor] Could not fetch events for focus suggestion');
          }
        }
        
        const focusPrompt = `You are FocusWise AI Chief of Staff. Help the user focus.

Current tasks: ${JSON.stringify(tasks)}
Upcoming events (next 2 hours): ${JSON.stringify(events)}
Current time: ${new Date().toISOString()}

Based on task priorities and upcoming commitments, suggest what the user should focus on right now.
Consider:
- High priority tasks
- Upcoming deadlines
- Time until next meeting
- Task complexity

Be specific and actionable. Keep response brief (2-3 sentences).`;

        const focusResult = await model.generateContent(focusPrompt);
        const suggestion = focusResult.response.text();
        
        return {
          success: true,
          intent,
          response: suggestion,
          data: { tasks, events },
          action: 'focus_suggested',
        };
      }
      
      case 'reschedule_event': {
        if (!accessToken) {
          return {
            success: false,
            intent,
            response: "I need calendar access to reschedule events. Please sign in with Google first.",
          };
        }
        
        if (!entities.eventId) {
          return {
            success: false,
            intent,
            response: "Which event would you like me to reschedule? Please specify the event.",
          };
        }
        
        const newStartTime = parseDateTime(entities.date, entities.time);
        if (!newStartTime) {
          return {
            success: false,
            intent,
            response: "When would you like to reschedule this to? Please specify a new date and time.",
          };
        }
        
        const duration = entities.duration || 60;
        const newEndTime = new Date(new Date(newStartTime).getTime() + duration * 60000).toISOString();
        
        const auth = getOAuthClient(accessToken);
        const updatedEvent = await updateEvent(auth, entities.eventId, {
          start: { dateTime: newStartTime, timeZone: 'UTC' },
          end: { dateTime: newEndTime, timeZone: 'UTC' },
        });
        
        const response = await generateResponse(intent, true, updatedEvent, rawQuery);
        return {
          success: true,
          intent,
          response,
          data: updatedEvent,
          action: 'event_rescheduled',
        };
      }
      
      default: {
        // Use Gemini to generate a helpful response for unknown intents
        const fallbackPrompt = `You are FocusWise AI Chief of Staff. The user said: "${rawQuery}"

You couldn't classify this as a specific action. Generate a helpful response that:
1. Acknowledges what they said
2. Offers to help with something you can do (schedule events, create tasks, give summaries)
3. Stays friendly and brief`;

        const fallbackResult = await model.generateContent(fallbackPrompt);
        return {
          success: false,
          intent: 'unknown',
          response: fallbackResult.response.text(),
        };
      }
    }
  } catch (error: any) {
    console.error('[CommandProcessor] Error executing command:', error);
    return {
      success: false,
      intent,
      response: `I encountered an issue: ${error.message}. Let me try again or you can rephrase your request.`,
    };
  }
}

// Main entry point: process a user command
export async function processCommand(
  userQuery: string,
  userId: string,
  accessToken?: string
): Promise<CommandResult> {
  console.log(`[CommandProcessor] Processing: "${userQuery}" for user: ${userId}`);
  
  // Parse the command to understand intent
  const parsed = await parseCommand(userQuery);
  console.log(`[CommandProcessor] Parsed intent: ${parsed.intent} (confidence: ${parsed.confidence})`);
  
  // Execute the command
  const result = await executeCommand(parsed, userId, accessToken);
  
  return result;
}

