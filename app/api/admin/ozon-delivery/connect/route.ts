import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ozon Delivery uses client_credentials. This endpoint is deliberately kept as
// a harmless redirect for old bookmarks instead of starting the obsolete OAuth
// authorization_code flow.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/ozon-delivery", request.url));
}
