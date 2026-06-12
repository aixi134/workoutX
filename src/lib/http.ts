import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { WorkoutXApiError } from "@/lib/workoutx/client";

export function jsonError(error: unknown, fallbackStatus = 500) {
  if (error instanceof WorkoutXApiError) {
    return NextResponse.json(
      { error: "WorkoutXApiError", message: error.message, status: error.status, usage: error.usage },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "ValidationError", message: "请求参数不合法。", issues: error.issues },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "服务器内部错误。";
  return NextResponse.json({ error: "InternalServerError", message }, { status: fallbackStatus });
}
