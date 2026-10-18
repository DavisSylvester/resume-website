import type { ContactConfig } from './i-contact-config.mjs';

export interface AppConfig {
  login: string;
  tableName: string;
  allowedOrigins: string[];
  timezone: string;
  liveEventTtlDays: number;
  refreshDebounceSeconds: number;
  logLevel: string;
  secretArn: string | null;
  /** This Lambda's own name in AWS; null locally. */
  functionName: string | null;
  contact: ContactConfig;
}
