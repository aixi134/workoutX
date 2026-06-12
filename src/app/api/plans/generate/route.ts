import { NextResponse } from "next/server";
import { generateAndSaveWeeklyPlan } from "@/lib/plans/generator";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = await generateAndSaveWeeklyPlan(body);
    return NextResponse.json({ plan });
  } catch (error) {
    return jsonError(error);
  }
}
