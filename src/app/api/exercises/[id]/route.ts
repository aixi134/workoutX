import { NextResponse } from "next/server";
import { getExerciseById } from "@/lib/exercises/service";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await getExerciseById(id);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
