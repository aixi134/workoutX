import { NextRequest, NextResponse } from "next/server";
import { searchExercises } from "@/lib/exercises/service";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const result = await searchExercises({
      query: params.get("query"),
      bodyPart: params.get("bodyPart"),
      target: params.get("target"),
      equipment: params.get("equipment"),
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
      offset: params.get("offset") ? Number(params.get("offset")) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
