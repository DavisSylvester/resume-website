// Minimal AWS Lambda custom-runtime loop for Bun. Mirrors src/api/chat2/runtime.mts.
import { handle } from './index.mjs';
import type { LambdaEvent, LambdaResult } from './src/interfaces/index.mjs';

const runtimeApi: string = process.env['AWS_LAMBDA_RUNTIME_API'] ?? '';
const base: string = `http://${runtimeApi}/2018-06-01/runtime`;

interface Invocation {
  requestId: string;
  event: LambdaEvent;
}

const nextInvocation = async (): Promise<Invocation> => {
  const res: Response = await fetch(`${base}/invocation/next`);
  const requestId: string = res.headers.get('lambda-runtime-aws-request-id') ?? '';
  const event: LambdaEvent = (await res.json()) as LambdaEvent;
  return { requestId, event };
};

const postResponse = async (requestId: string, payload: LambdaResult): Promise<void> => {
  await fetch(`${base}/invocation/${requestId}/response`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

const postError = async (requestId: string, err: unknown): Promise<void> => {
  const error: Error = err instanceof Error ? err : new Error(String(err));
  await fetch(`${base}/invocation/${requestId}/error`, {
    method: 'POST',
    body: JSON.stringify({
      errorMessage: error.message,
      errorType: error.name,
      stackTrace: (error.stack ?? '').split('\n'),
    }),
  });
};

while (true) {
  const { requestId, event }: Invocation = await nextInvocation();
  try {
    const result: LambdaResult = await handle(event);
    await postResponse(requestId, result);
  } catch (err: unknown) {
    await postError(requestId, err);
  }
}
