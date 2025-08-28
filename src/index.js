import { serve, env } from "bun";
import index from "./index.html";
import { userRoutes } from "./data/user-routes";

const server = serve({
  hostname: env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1",
  port: 3000,
  routes: {
    ...userRoutes,
    "/api/*": new Response("Not Found", { status: 404 }),
    "/*": index
  },
  development: env.NODE_ENV !== "production" && {
    hmr: true,
    console: true
  }
});

console.log(`🚀 Server running at ${server.url}`);
