import Elysia from "elysia";

const app = new Elysia();

app.get("/chat", () => {
  return "Hello, World!";
});

export async function handle(event: any) {
  try {
    console.log("Event received:", JSON.stringify(event, null, 2));

    const method = event.requestContext.http.method;
    const path = event.rawPath;

    console.log(`Processing ${method} ${path}`);

    // Don't include body for GET/HEAD requests
    const requestInit: RequestInit = {
      method,
      headers: new Headers(event.headers ?? {}),
    };

    if (method !== "GET" && method !== "HEAD" && event.body) {
      requestInit.body = event.body;
    }

    const req = new Request("https://lambda.local" + path, requestInit);

    const res = await app.handle(req);

    console.log(`Response status: ${res.status}`);

    const headers: any = {};
    res.headers.forEach((v, k) => (headers[k] = v));

    const body = await res.text();
    console.log(`Response body: ${body}`);

    return {
      statusCode: res.status,
      headers,
      body,
    };
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
