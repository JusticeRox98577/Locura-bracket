export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Simple test route
    if (url.pathname === "/test") {
      return new Response("Worker is running ✅", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    // Otherwise, fall back to static assets (Pages will serve index.html, css, js, etc.)
    return env.ASSETS.fetch(request);
  },
};
