// services/hello-get/runtime.ts
import { handle } from "./index.mts";

const runtimeApi = process.env.AWS_LAMBDA_RUNTIME_API!;
const base = `http://${runtimeApi}/2018-06-01/runtime`;

async function nextInvocation() {
  const res = await fetch(`${base}/invocation/next`);
  const requestId = res.headers.get("lambda-runtime-aws-request-id")!;
  const event = await res.json();
  return { requestId, event };
}

async function postResponse(requestId: string, payload: any) {
  await fetch(`${base}/invocation/${requestId}/response`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function postError(requestId: string, err: any) {
  await fetch(`${base}/invocation/${requestId}/error`, {
    method: "POST",
    body: JSON.stringify({
      errorMessage: err?.message ?? String(err),
      errorType: err?.name ?? "Error",
      stackTrace: (err?.stack ?? "").split("\n"),
    }),
  });
}

while (true) {
  const { requestId, event } = await nextInvocation();
  try {
    const result = await handle(event);
    await postResponse(requestId, result);
  } catch (err) {
    await postError(requestId, err);
  }
}
