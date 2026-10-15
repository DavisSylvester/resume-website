export interface WebhookRequest {
  event: string;
  deliveryId: string;
  signature: string;
  rawBody: string;
}
