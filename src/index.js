import { serve } from "bun";
import index from "./index.html";

const server = serve({
  hostname: Bun.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  port: 3000,
  routes: {
    "/api": Response.json({ ok: true, data: "Musalup API" }),
    "/api/*": new Response("Not Found", { status: 404 }),
    "/*": index
  },
  development: Bun.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true
  }
});

console.log(`🚀 Server running at ${server.url}`);
