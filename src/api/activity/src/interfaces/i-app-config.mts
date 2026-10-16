export interface AppConfig {
  login: string;
  tableName: string;
  allowedOrigins: string[];
  timezone: string;
  liveEventTtlDays: number;
  refreshDebounceSeconds: number;
  logLevel: string;
  secretArn: string | null;
}
