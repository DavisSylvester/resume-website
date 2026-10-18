import type { SendWhatsAppMessageCommand, SendWhatsAppMessageCommandOutput } from '@aws-sdk/client-socialmessaging';

/** The one call the WhatsApp notifier makes on AWS End User Messaging Social (`SocialMessagingClient`). */
export interface WhatsAppClient {
  send(command: SendWhatsAppMessageCommand): Promise<SendWhatsAppMessageCommandOutput>;
}
