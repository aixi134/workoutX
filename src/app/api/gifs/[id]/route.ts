import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exerciseId = id.replace(/\.gif$/i, "");

  if (!/^\d{1,8}$/.test(exerciseId)) {
    return NextResponse.json({ error: "ValidationError", message: "GIF id 不合法。" }, { status: 400 });
  }

  const apiKey = process.env.WORKOUTX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ConfigurationError", message: "缺少 WORKOUTX_API_KEY。" }, { status: 500 });
  }

  const baseUrl = (process.env.WORKOUTX_API_BASE_URL ?? "https://api.workoutxapp.com/v1").replace(/\/$/, "");
  const upstream = await fetch(`${baseUrl}/gifs/${exerciseId}.gif`, {
    headers: { "X-WorkoutX-Key": apiKey, Accept: "image/gif" },
    cache: "force-cache",
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!upstream.ok || !upstream.body) {
    const message = upstream.status === 404 ? "动作 GIF 不存在。" : `WorkoutX GIF 请求失败：HTTP ${upstream.status}`;
    return NextResponse.json({ error: "WorkoutXGifError", message }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/gif",
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
    },
  });
}
