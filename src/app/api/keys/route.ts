import { NextRequest, NextResponse } from "next/server";
import { checkKeys } from "@/mastra/tools/check-keys";
export const runtime = "nodejs";
export async function POST(_req: NextRequest) {
  const result = await checkKeys();
  return NextResponse.json(result);
}
export async function GET() {
  const result = await checkKeys();
  return NextResponse.json(result);
}
