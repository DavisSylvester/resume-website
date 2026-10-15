import { InjectionToken } from '@angular/core';

export interface ActivityApiConfig {
  /** Base URL of the activity API, or '' to use only the bundled sample snapshot. */
  baseUrl: string;
  /** Bundled fallback, so the page still renders if the API is unreachable. */
  sampleUrl: string;
  /** How often the live feed polls while the tab is visible. */
  pollMs: number;
}

/**
 * Production API origin. Set this to the `ActivityApiUrl` output printed by `cdk deploy`
 * (for example https://abc123.execute-api.us-east-1.amazonaws.com).
 */
export const ACTIVITY_API_PROD_URL: string = 'https://etgzi1pkz8.execute-api.us-east-1.amazonaws.com';

const isLocalhost = (): boolean =>
  typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);

export const ACTIVITY_API_CONFIG: InjectionToken<ActivityApiConfig> = new InjectionToken<ActivityApiConfig>(
  'ACTIVITY_API_CONFIG',
  {
    providedIn: 'root',
    factory: (): ActivityApiConfig => ({
      baseUrl: isLocalhost() ? 'http://localhost:3100' : ACTIVITY_API_PROD_URL,
      sampleUrl: '/data/activity-sample.json',
      pollMs: 15_000,
    }),
  },
);
