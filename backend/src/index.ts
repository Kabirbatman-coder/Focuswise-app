import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import calendarRoutes from './routes/calendar';
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import { testConnection } from './services/supabaseService';
import { startSupabaseTokenQueueWorker, getQueueStatus } from './services/supabaseTokenService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Startup banner
console.log('═'.repeat(60));
console.log('  FocusWise Backend Starting...');
console.log('═'.repeat(60));
console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`[Startup] Port: ${PORT}`);
console.log(`[Startup] Supabase URL: ${process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 40) + '...' : 'NOT SET'}`);
console.log(`[Startup] Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'NOT SET'}`);
console.log('─'.repeat(60));

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/ai', aiRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('FocusWise Backend is running');
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  const queueStatus = getQueueStatus();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    tokenQueue: {
      size: queueStatus.size,
      note: queueStatus.size > 0 ? 'Items pending Supabase write' : 'Empty',
    },
  });
});

// Initialize Supabase and start queue worker
const initializeServices = async () => {
  console.log('[Startup] Initializing services...');
  
  // Test Supabase connection
  console.log('[Startup] Testing Supabase connection...');
  const connected = await testConnection();
  
  if (connected) {
    console.log('[Startup] ✅ Supabase connection successful');
  } else {
    console.warn('[Startup] ⚠️  Supabase connection test failed');
    console.warn('[Startup] This may be due to slow network. Tokens will be queued and retried.');
    console.warn('[Startup] Troubleshooting:');
    console.warn('[Startup]   1. Check SUPABASE_URL in .env is correct');
    console.warn('[Startup]   2. Check SUPABASE_SERVICE_ROLE_KEY in .env is correct');
    console.warn('[Startup]   3. Verify internet connection');
    console.warn('[Startup]   4. Ensure Supabase project is active');
  }
  
  // Start the token queue worker regardless of connection status
  // It will keep retrying until Supabase is reachable
  console.log('[Startup] Starting Supabase token queue worker...');
  startSupabaseTokenQueueWorker();
  
  // Check if there are any pending items in queue
  const queueStatus = getQueueStatus();
  if (queueStatus.size > 0) {
    console.log(`[Startup] ⚠️  ${queueStatus.size} token(s) pending in queue from previous session`);
    console.log('[Startup] They will be processed automatically every 5 seconds');
  }
  
  console.log('─'.repeat(60));
  console.log('[Startup] ✅ All services initialized');
  console.log('═'.repeat(60));
};

app.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] API endpoints:`);
  console.log(`[Server]   GET  /health`);
  console.log(`[Server]   GET  /api/auth/google/login`);
  console.log(`[Server]   GET  /api/auth/google/callback`);
  console.log(`[Server]   GET  /api/auth/google/me`);
  console.log(`[Server]   GET  /api/auth/debug/oauth`);
  console.log(`[Server]   GET  /api/auth/debug/supabase`);
  console.log(`[Server]   GET  /api/auth/debug/supabase-sync`);
  console.log(`[Server]   GET  /api/auth/debug/queue-status`);
  console.log(`[Server]   GET  /api/calendar/events`);
  console.log(`[Server]   POST /api/ai/command`);
  console.log(`[Server]   GET  /api/ai/tasks`);
  console.log(`[Server]   POST /api/ai/tasks`);
  console.log(`[Server]   PUT  /api/ai/tasks/:taskId`);
  console.log(`[Server]   DELETE /api/ai/tasks/:taskId`);
  console.log('─'.repeat(60));
  
  // Initialize services after server starts
  initializeServices().catch(err => {
    console.error('[Startup] Service initialization failed:', err);
  });
});
