import { Env, HttpError, errorResponse } from "../server/http";
import { handleApi } from "../server/router";

interface WorkerEnv extends Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    // /api/* всегда приходит сюда (run_worker_first в wrangler.jsonc); остальное отдаёт статика.
    if (pathname === "/api" || pathname.startsWith("/api/")) return handleApi(request, env);
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return errorResponse(e instanceof HttpError ? e : new Error("assets"));
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
