import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "node:fs";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "tiktok";
  const path = `output/report-${platform}.json`;
  if (!existsSync(path)) return NextResponse.json({ error: "No report found", platform }, { status: 404 });
  const data = JSON.parse(readFileSync(path, "utf8"));
  return NextResponse.json(data);
}
