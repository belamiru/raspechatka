"use client";

import { useEffect, useState } from "react";

type ImageFileThumbnailProps = {
  file: File;
};

export function ImageFileThumbnail({
  file,
}: ImageFileThumbnailProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    const nextObjectUrl = URL.createObjectURL(file);

    setObjectUrl(nextObjectUrl);

    return () => {
      URL.revokeObjectURL(nextObjectUrl);
    };
  }, [file]);

  if (!objectUrl) {
    return (
      <div
        className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-[9px] font-black text-violet-700 shadow-sm"
        role="img"
        aria-label="Изображение"
      >
        IMG
      </div>
    );
  }

  return (
    <>
      <div className="group relative h-12 w-10 shrink-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setIsPreviewOpen(true);
          }}
          className="block h-12 w-10 overflow-hidden rounded-lg border border-violet-200 bg-violet-50 shadow-sm outline-none transition hover:border-violet-500 focus:ring-4 focus:ring-violet-100"
          aria-label={`Открыть увеличенный просмотр: ${file.name}`}
          title="Нажмите, чтобы увеличить изображение"
        >
          <img
            src={objectUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </button>

        <div className="pointer-events-none absolute left-0 top-full z-30 mt-3 hidden w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl group-hover:block">
          <img
            src={objectUrl}
            alt={`Предпросмотр: ${file.name}`}
            className="max-h-64 w-full rounded-xl object-contain"
          />

          <p
            className="mt-2 truncate px-1 text-xs font-medium text-slate-600"
            title={file.name}
          >
            {file.name}
          </p>
        </div>
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Предпросмотр изображения: ${file.name}`}
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative max-h-full w-full max-w-4xl rounded-2xl bg-white p-3 shadow-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/80 text-2xl leading-none text-white transition hover:bg-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-300"
              aria-label="Закрыть предпросмотр"
            >
              ×
            </button>

            <img
              src={objectUrl}
              alt={`Предпросмотр: ${file.name}`}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />

            <p
              className="mt-3 truncate px-1 text-sm font-medium text-slate-700"
              title={file.name}
            >
              {file.name}
            </p>
          </div>
        </div>
      )}
    </>
  );
}