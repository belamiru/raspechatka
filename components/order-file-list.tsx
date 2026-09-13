"use client";

import {
  formatFileSize,
  type ClientFileKind,
} from "@/lib/client-file-analysis";

export type OrderFileStatus = "analyzing" | "ready" | "error";

export type OrderFileListItem = {
  id: string;
  file: File;
  kind: ClientFileKind | null;
  pageCount: number | null;
  status: OrderFileStatus;
  error: string | null;
};

function getKindLabel(kind: ClientFileKind | null) {
  if (kind === "image") {
    return "Изображение";
  }

  if (kind === "document") {
    return "Документ";
  }

  return "Файл";
}

function getStatusContent(item: OrderFileListItem) {
  if (item.status === "analyzing") {
    return {
      className: "bg-blue-100 text-blue-800",
      label: "Проверяется…",
    };
  }

  if (item.status === "error") {
    return {
      className: "bg-red-100 text-red-800",
      label: "Ошибка проверки",
    };
  }

  return {
    className: "bg-emerald-100 text-emerald-800",
    label: `${item.pageCount ?? 0} стр.`,
  };
}

export function OrderFileList({
  items,
  onRemove,
}: {
  items: OrderFileListItem[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-slate-800">
          Выбранные файлы: {items.length}
        </p>

        <p className="text-sm text-slate-500">
          Удалите файл, если он добавлен по ошибке
        </p>
      </div>

      <ul className="divide-y divide-slate-200">
        {items.map((item) => {
          const status = getStatusContent(item);

          return (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className="max-w-full truncate font-semibold text-slate-800"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>

                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {getKindLabel(item.kind)}
                  </span>

                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {formatFileSize(item.file.size)}
                  {item.status === "ready" && item.kind === "image"
                    ? " · 1 страница"
                    : ""}
                </p>

                {item.error && (
                  <p className="mt-2 text-sm font-medium text-red-700">
                    {item.error}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                aria-label={`Удалить файл ${item.file.name}`}
              >
                Удалить
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}