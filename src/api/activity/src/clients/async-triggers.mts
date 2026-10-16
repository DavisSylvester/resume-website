import { InvokeCommand } from '@aws-sdk/client-lambda';
import type { LambdaClient } from '@aws-sdk/client-lambda';
import type { Logger } from 'winston';
import type { ActivityService, AsyncTrigger } from '../interfaces/index.mjs';
import type { ActivitySnapshot, Result } from '../types/index.mjs';

/** The event the handler recognises as "process queued pushes". */
export const PUSH_EVENT_SOURCE: string = 'activity.push';

/** In AWS: invoke this same function asynchronously, so the webhook can answer immediately. */
export class LambdaSelfTrigger implements AsyncTrigger {

  private readonly client: LambdaClient;
  private readonly functionName: string;
  private readonly logger: Logger;

  public constructor(client: LambdaClient, functionName: string, logger: Logger) {
    this.client = client;
    this.functionName = functionName;
    this.logger = logger;
  }

  public async trigger(): Promise<void> {
    try {
      await this.client.send(
        new InvokeCommand({
          FunctionName: this.functionName,
          InvocationType: 'Event',
          Payload: new TextEncoder().encode(JSON.stringify({ source: PUSH_EVENT_SOURCE })),
        }),
      );
    } catch (error: unknown) {
      // Not fatal: the hourly schedule classifies anything still queued.
      this.logger.warn('async self-invoke failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/** Locally and in tests: process the queue in-line. */
export class InlineTrigger implements AsyncTrigger {

  private readonly activity: () => ActivityService;
  private readonly logger: Logger;

  public constructor(activity: () => ActivityService, logger: Logger) {
    this.activity = activity;
    this.logger = logger;
  }

  public async trigger(): Promise<void> {
    const res: Result<ActivitySnapshot | null> = await this.activity().processPush();
    if (!res.ok) this.logger.warn('inline push processing failed', { error: res.error.message });
  }
}
