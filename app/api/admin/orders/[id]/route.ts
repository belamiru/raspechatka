import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const allowedStatuses = ["new", "in_progress", "ready", "completed", "cancelled"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();

  const isAdmin = await isAdminSession(
    cookieStore.get(getAdminCookieName())?.value
  );

  if (!isAdmin) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json(
      { error: "Некорректный идентификатор заказа." },
      { status: 400 }
    );
  }

  const { status } = await request.json();

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { error: "Некорректный статус." },
      { status: 400 }
    );
  }

  const result = await getDb().query(
    `
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, status;
    `,
    [status, orderId]
  );

  if (result.rowCount === 0) {
    return NextResponse.json(
      { error: "Заказ не найден." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    status: result.rows[0].status,
  });
}