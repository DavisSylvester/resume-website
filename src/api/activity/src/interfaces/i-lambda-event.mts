/** The API Gateway HTTP API (payload v2) event, or an EventBridge scheduled event. */
export interface LambdaEvent {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { http?: { method?: string } };
  /** Present on EventBridge events, e.g. `aws.events`. */
  source?: string;
  'detail-type'?: string;
}
