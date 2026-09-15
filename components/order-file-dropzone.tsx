"use client";

import { DragEvent, useRef, useState } from "react";

type OrderFileDropzoneProps = {
  disabled?: boolean;
  isProcessing?: boolean;
  onFilesSelected: (files: File[]) => void;
};

export function OrderFileDropzone({
  disabled,
  isProcessing = false,
  onFilesSelected,
}: OrderFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = "order-file-input";

  function addFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];

    if (files.length > 0) {
      onFilesSelected(files);
    }
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    /*
     * На мобильных браузерах FileList может быть очищен вместе с input.
     * Поэтому сначала создаём независимый массив File, затем очищаем поле.
     * Атрибут multiple и нативный label дают iOS/Android возможность передать
     * все файлы, выбранные в системном файловом менеджере, одним действием.
     */
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (!disabled) {
      addFiles(event.dataTransfer.files);
    }
  }

  return (
    <label
      htmlFor={inputId}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "relative mt-6 flex min-h-56 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
          : isDragging
            ? "cursor-copy border-blue-700 bg-blue-100"
            : "cursor-pointer border-blue-300 bg-blue-50 hover:border-blue-600 hover:bg-blue-100",
      ].join(" ")}
      aria-disabled={disabled}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white">
        ↑
      </div>

      <p className="text-lg font-bold text-slate-800">
        Перетащите файлы сюда
      </p>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Или нажмите, чтобы выбрать файлы. Можно добавить до 8 файлов за один
        заказ.
      </p>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS, RTF, JPG, JPEG и PNG.
        До 50 МБ на файл, до 200 МБ суммарно.
      </p>

      {isProcessing && (
        <div
          className="mt-5 flex items-center gap-3 rounded-xl bg-white/90 px-4 py-3 text-left shadow-sm ring-1 ring-blue-200"
          role="status"
          aria-live="polite"
        >
          <svg
            className="h-5 w-5 shrink-0 animate-spin text-blue-700"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-90"
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <span>
            <strong className="block text-sm text-slate-800">
              Подготавливаем файлы…
            </strong>
            <span className="block text-xs text-slate-500">
              Пожалуйста, дождитесь завершения проверки.
            </span>
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.jpg,.jpeg,.png"
        onChange={handleInputChange}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  );
}
