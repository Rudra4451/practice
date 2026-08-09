type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  category?: 'dom' | 'supabase' | 'api' | 'auth' | 'general';
  metadata?: Record<string, unknown>;
  error?: Error | unknown;
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const categoryStr = context?.category ? ` [${context.category.toUpperCase()}]` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${categoryStr} ${message}`;
  }

  info(message: string, context?: LogContext) {
    if (this.isProduction) {
      console.info(this.formatMessage('info', message, context));
      return;
    }
    console.info(
      `%c${this.formatMessage('info', message, context)}`,
      'color: #757575; font-weight: bold;',
      context?.metadata || ''
    );
  }

  warn(message: string, context?: LogContext) {
    console.warn(
      this.formatMessage('warn', message, context),
      context?.metadata || '',
      context?.error || ''
    );
  }

  error(message: string, context?: LogContext) {
    console.error(
      this.formatMessage('error', message, context),
      context?.metadata || '',
      context?.error || ''
    );
  }

  debug(message: string, context?: LogContext) {
    if (this.isProduction) return;

    console.debug(
      `%c${this.formatMessage('debug', message, context)}`,
      'color: #757575; font-style: italic;',
      context?.metadata || ''
    );
  }
}

export const logger = new Logger();
