/**
 * FocusWise Retry Utility
 * Robust retry logic with exponential backoff for external API calls
 */

import { createLogger } from './logger';

const logger = createLogger('Retry');

interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;      // ms
  maxDelay?: number;          // ms
  backoffMultiplier?: number;
  retryOn?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryOn: (error) => {
    // Retry on network errors and 5xx status codes
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true;
    if (error?.status >= 500) return true;
    if (error?.message?.includes('rate limit')) return true;
    return false;
  },
  onRetry: () => {},
};

/**
 * Execute a function with automatic retry on failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === opts.maxAttempts || !opts.retryOn(error)) {
        throw error;
      }
      
      logger.warn(`Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      opts.onRetry(attempt, error, delay);
      
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }
  
  throw lastError;
}

/**
 * Create a retryable version of a function
 */
export function retryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * Retry with circuit breaker pattern
 */
interface CircuitBreakerOptions extends RetryOptions {
  failureThreshold?: number;
  resetTimeout?: number; // ms
}

class CircuitBreaker {
  private failures = 0;
  private lastFailure: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private options: Required<CircuitBreakerOptions>;
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      failureThreshold: 5,
      resetTimeout: 30000,
      ...options,
    };
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.options.resetTimeout) {
        this.state = 'half-open';
        logger.info('Circuit breaker: half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await withRetry(fn, this.options);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      logger.info('Circuit breaker: closed');
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
      logger.warn('Circuit breaker: open', { failures: this.failures });
    }
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailure = 0;
  }
}

export { CircuitBreaker };

/**
 * Rate limiter for API calls
 */
interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: number[] = [];
  private options: RateLimitOptions;
  
  constructor(options: RateLimitOptions) {
    this.options = options;
  }
  
  async acquire(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.options.windowMs);
    
    if (this.requests.length >= this.options.maxRequests) {
      const oldestRequest = this.requests[0]!;
      const waitTime = this.options.windowMs - (now - oldestRequest);
      logger.debug(`Rate limit reached, waiting ${waitTime}ms`);
      await sleep(waitTime);
      return this.acquire();
    }
    
    this.requests.push(now);
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    return fn();
  }
}

export { RateLimiter };

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper for promises
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}

/**
 * Batch multiple operations with concurrency control
 */
export async function batchExecute<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  
  for (const item of items) {
    const promise = fn(item).then(result => {
      results.push(result);
    });
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

