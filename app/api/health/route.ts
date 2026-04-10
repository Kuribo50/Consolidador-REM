import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "consolidador",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
