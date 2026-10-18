import type { SendTextMessageCommand, SendTextMessageCommandOutput } from '@aws-sdk/client-pinpoint-sms-voice-v2';

/** The one call the SMS notifier makes on AWS End User Messaging SMS (`PinpointSMSVoiceV2Client`). */
export interface SmsClient {
  send(command: SendTextMessageCommand): Promise<SendTextMessageCommandOutput>;
}
