import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import {
  deleteExpiredPrintDraft,
  getExpiredPrintDrafts,
} from "@/lib/print-drafts";
import { deleteDiskFile } from "@/lib/yandex-disk";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLEANUP_LIMIT = 100;

export async function POST(request: Request) {
  const requestId = getRequestId();
  const cookieStore = await cookies();
  const isAdmin = await isAdminSession(
    cookieStore.get(getAdminCookieName())?.value
  );

  if (!isAdmin) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  try {
    const drafts = await getExpiredPrintDrafts(CLEANUP_LIMIT);
    let deleted = 0;
    let failed = 0;

    for (const draft of drafts) {
      try {
        // A database record is removed only after both private files are gone.
        // deleteDiskFile accepts a 404, making retries after partial failures safe.
        await deleteDiskFile(draft.originalDiskPath);
        await deleteDiskFile(draft.pdfDiskPath);

        if (await deleteExpiredPrintDraft(draft.id)) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        await logAppError({
          request,
          requestId,
          scope: "cleanup_print_draft_failed",
          error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      found: drafts.length,
      deleted,
      failed,
      hasMore: drafts.length === CLEANUP_LIMIT,
    });
  } catch (error) {
    await logAppError({
      request,
      requestId,
      scope: "cleanup_print_drafts_failed",
      error,
    });

    return NextResponse.json(
      {
        error: "Не удалось очистить просроченные черновики. Попробуйте ещё раз позже.",
        requestId,
      },
      { status: 500 }
    );
  }
}
