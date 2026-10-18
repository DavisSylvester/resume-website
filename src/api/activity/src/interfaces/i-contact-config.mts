/** Where contact requests go and how hard the endpoint is throttled. */
export interface ContactConfig {
  /** Secrets Manager ARN for the channel credentials; null locally (env vars are used). */
  secretArn: string | null;
  emailTo: string;
  /** E.164 number that receives SMS and WhatsApp notifications. */
  phoneTo: string;
  rateLimitPerHour: number;
}
