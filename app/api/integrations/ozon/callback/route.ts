import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Kept solely for stale bookmarks from the former Seller OAuth setup. Ozon
// Delivery uses client_credentials and never redirects a browser here.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin/ozon-delivery", request.url));
}
