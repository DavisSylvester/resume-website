Bun.serve({
  port: process.env.PORT ?? 8080,

  fetch(req) {

    console.log(`Starting Bun server on port ${process.env.PORT ?? 8080}...`);
    
    const url = new URL(req.url);

    if (url.pathname === "/hello") {
      return Response.json({
        message: "Hello from Bun on Lambda! 🐇⚡",
        path: url.pathname,
        method: req.method,
        time: new Date().toISOString(),
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});