/**
 * FocusWise Logger Utility
 * Centralized logging with structured output and performance tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  service?: string;
  userId?: string;
  action?: string;
  duration?: number;
  [key: string]: any;
}

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

const LOG_ICONS = {
  debug: '🔍',
  info: '✓',
  warn: '⚠️',
  error: '✗',
};

class Logger {
  private serviceName: string;
  private minLevel: LogLevel;
  
  constructor(serviceName: string, minLevel: LogLevel = 'debug') {
    this.serviceName = serviceName;
    this.minLevel = process.env.LOG_LEVEL as LogLevel || minLevel;
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }
  
  private formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').split('.')[0]!;
  }
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const color = LOG_COLORS[level];
    const icon = LOG_ICONS[level];
    const reset = LOG_COLORS.reset;
    
    let output = `${color}[${timestamp}] ${icon} [${this.serviceName}] ${message}${reset}`;
    
    if (context) {
      const contextStr = Object.entries(context)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' | ');
      if (contextStr) {
        output += ` { ${contextStr} }`;
      }
    }
    
    return output;
  }
  
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context));
    }
  }
  
  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context));
    }
  }
  
  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context));
    }
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context));
      if (error instanceof Error) {
        console.error(`  └─ ${error.message}`);
        if (process.env.NODE_ENV === 'development' && error.stack) {
          console.error(`  └─ ${error.stack.split('\n').slice(1, 4).join('\n     ')}`);
        }
      }
    }
  }
  
  // Performance tracking
  time(label: string): () => number {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed`, { duration: `${duration}ms` });
      return duration;
    };
  }
  
  // API request logging
  request(method: string, path: string, context?: LogContext): void {
    this.info(`→ ${method} ${path}`, context);
  }
  
  response(method: string, path: string, status: number, duration: number): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this[level](`← ${method} ${path}`, { status, duration: `${duration}ms` });
  }
}

// Create loggers for different services
export const createLogger = (serviceName: string): Logger => new Logger(serviceName);

// Pre-configured loggers
export const loggers = {
  api: createLogger('API'),
  ai: createLogger('AI'),
  scheduler: createLogger('Scheduler'),
  energy: createLogger('Energy'),
  tasks: createLogger('Tasks'),
  focus: createLogger('Focus'),
  calendar: createLogger('Calendar'),
};

export default Logger;

