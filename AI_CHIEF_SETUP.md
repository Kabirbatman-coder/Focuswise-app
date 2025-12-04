# AI Chief of Staff Setup Guide

This guide will help you set up the AI Chief of Staff feature for FocusWise.

## Overview

The AI Chief of Staff is your intelligent assistant that can:
- 📅 Schedule calendar events
- ✅ Create and manage tasks
- 🎯 Suggest what to focus on
- 📊 Provide daily summaries
- 🗣️ Accept voice or text commands

## Prerequisites

1. Node.js 18+ installed
2. Backend server running
3. Google OAuth configured (from Phase 1)

## Setup Steps

### Step 1: Get Gemini API Key (Free)

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### Step 2: Configure Backend Environment

1. Navigate to the backend folder:
   ```bash
   cd FocusWise/backend
   ```

2. Create or update your `.env` file:
   ```env
   # Add this line to your existing .env file
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

### Step 3: Install Backend Dependencies

```bash
cd FocusWise/backend
npm install
```

This will install the new `@google/generative-ai` package.

### Step 4: Start the Backend

```bash
npm start
```

You should see the new AI endpoints listed:
```
[Server]   POST /api/ai/command
[Server]   GET  /api/ai/tasks
[Server]   POST /api/ai/tasks
[Server]   PUT  /api/ai/tasks/:taskId
[Server]   DELETE /api/ai/tasks/:taskId
```

### Step 5: Start the Frontend

```bash
cd FocusWise
npx expo start
```

## How to Use

### Opening the AI Assistant

Tap the glowing center button in the navigation bar to open the AI assistant.

### Text Commands

Type any of these commands:
- "Schedule a meeting with John at 3 PM tomorrow"
- "Create a task to review the proposal"
- "What should I focus on today?"
- "Show me my schedule for today"
- "What's my next meeting?"

### Voice Commands (Coming Soon)

The voice button will glow when listening. Speak your command and it will be transcribed and processed.

> Note: Voice input requires a native build (not Expo Go) with expo-speech installed.

### Quick Actions

Use the quick action buttons at the bottom for common commands:
- **Today**: View your schedule
- **Focus**: Get a focus suggestion
- **Tasks**: List your tasks

## Example Commands

| Command | What it does |
|---------|--------------|
| "Schedule review of sales pipeline at 5 PM" | Creates a calendar event |
| "Add task: prepare presentation, high priority" | Creates a high priority task |
| "What should I focus on today?" | AI analyzes your tasks and calendar |
| "Show me my next meeting" | Lists upcoming calendar events |
| "Create a task to call mom tomorrow" | Creates a task with a due date |

## Troubleshooting

### "Failed to communicate with the AI"

1. Make sure the backend is running on port 3000
2. Check that GEMINI_API_KEY is set in .env
3. Verify the API key is valid at [AI Studio](https://aistudio.google.com/)

### "I need calendar access"

Sign in with Google from the calendar tab to enable calendar-related commands.

### Commands not understood

Try being more specific. For example:
- ❌ "Meeting tomorrow" 
- ✅ "Schedule a team meeting tomorrow at 2 PM"

## API Endpoints

### POST /api/ai/command

Send natural language commands to the AI.

**Request:**
```json
{
  "query": "Create a task to review the proposal",
  "accessToken": "optional-google-access-token",
  "userId": "user-id"
}
```

**Response:**
```json
{
  "success": true,
  "intent": "create_task",
  "response": "I've created a new task 'Review the proposal' for you!",
  "action": "task_created",
  "data": { "id": "task_123", "title": "Review the proposal", ... }
}
```

### Task CRUD Endpoints

- `GET /api/ai/tasks` - List all tasks
- `POST /api/ai/tasks` - Create a task
- `PUT /api/ai/tasks/:taskId` - Update a task
- `DELETE /api/ai/tasks/:taskId` - Delete a task

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Native   │────▶│  Express API    │────▶│  Gemini AI      │
│  (Frontend)     │     │  (Backend)      │     │  (Processing)   │
│                 │◀────│                 │◀────│                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ SQLite   │ │ Google   │ │ Supabase │
              │ (Tasks)  │ │ Calendar │ │ (Cloud)  │
              └──────────┘ └──────────┘ └──────────┘
```

## What's Next?

Phase 3 will add:
- Productivity Energy Score (PES) integration
- Smart scheduling based on energy levels
- Focus mode with distraction blocking
- Weekly productivity reports

