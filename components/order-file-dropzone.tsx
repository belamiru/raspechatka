"use client";

import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";

export function OrderFileDropzone({
  disabled,
  onFilesSelected,
}: {
  disabled?: boolean;
  onFilesSelected: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    onFilesSelected(Array.from(fileList));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);

    /*
     * Очищаем поле, чтобы пользователь мог повторно выбрать файл,
     * который ранее удалил из списка.
     */
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!disabled) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (disabled) {
      return;
    }

    addFiles(event.dataTransfer.files);
  }

  function openFilePicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        "mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
          : isDragging
            ? "border-blue-700 bg-blue-100"
            : "cursor-pointer border-blue-300 bg-blue-50 hover:border-blue-600 hover:bg-blue-100",
      ].join(" ")}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={openFilePicker}
      onKeyDown={(event) => {
        if (
          !disabled &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          openFilePicker();
        }
      }}
      aria-disabled={disabled}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white">
        ↑
      </div>

      <p className="text-lg font-bold text-slate-800">
        Перетащите файлы сюда
      </p>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Или нажмите, чтобы выбрать файлы на компьютере. Можно добавить до
        8 файлов за один заказ.
      </p>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS, RTF, JPG, JPEG и PNG.
        До 50 МБ на файл, до 200 МБ суммарно.
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.jpg,.jpeg,.png"
        onChange={handleInputChange}
        disabled={disabled}
        className="hidden"
      />
    </div>
  );
}