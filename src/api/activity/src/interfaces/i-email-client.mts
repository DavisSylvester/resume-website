import type { SendEmailCommand, SendEmailCommandOutput } from '@aws-sdk/client-sesv2';

/** The one call the email notifier makes on Amazon SES (`SESv2Client`). */
export interface EmailClient {
  send(command: SendEmailCommand): Promise<SendEmailCommandOutput>;
}
