import { NextResponse } from "next/server";
import { getCurrentPlan, replaceCurrentPlanFromPayload } from "@/lib/plans/generator";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const plan = await getCurrentPlan();
    return NextResponse.json({ plan });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const plan = await replaceCurrentPlanFromPayload(body);
    return NextResponse.json({ plan });
  } catch (error) {
    return jsonError(error);
  }
}
