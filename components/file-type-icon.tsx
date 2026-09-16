import { getFileExtension } from "@/lib/client-file-analysis";

type FileTypeIconProps = {
  fileName: string;
  className?: string;
};

type FileIconVariant =
  | "pdf"
  | "word"
  | "excel"
  | "powerpoint"
  | "image"
  | "file";

function getFileIconVariant(fileName: string): FileIconVariant {
  const extension = getFileExtension(fileName);

  if (extension === "pdf") {
    return "pdf";
  }

  if (["doc", "docx", "odt", "rtf"].includes(extension)) {
    return "word";
  }

  if (["xls", "xlsx", "ods"].includes(extension)) {
    return "excel";
  }

  if (["ppt", "pptx"].includes(extension)) {
    return "powerpoint";
  }

  if (["jpg", "jpeg", "png"].includes(extension)) {
    return "image";
  }

  return "file";
}

const ICON_CONFIG: Record<
  FileIconVariant,
  {
    abbreviation: string;
    label: string;
    className: string;
  }
> = {
  pdf: {
    abbreviation: "PDF",
    label: "PDF-документ",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  word: {
    abbreviation: "DOCX",
    label: "Документ Word",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  excel: {
    abbreviation: "XLSX",
    label: "Таблица Excel",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  powerpoint: {
    abbreviation: "PPTX",
    label: "Презентация PowerPoint",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  image: {
    abbreviation: "IMG",
    label: "Изображение",
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  file: {
    abbreviation: "FILE",
    label: "Файл",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export function FileTypeIcon({
  fileName,
  className = "",
}: FileTypeIconProps) {
  const variant = getFileIconVariant(fileName);
  const config = ICON_CONFIG[variant];

  return (
    <div
      className={[
        "relative flex h-12 w-10 shrink-0 items-end justify-center overflow-hidden rounded-lg border pb-1.5 shadow-sm",
        config.className,
        className,
      ].join(" ")}
      role="img"
      aria-label={config.label}
      title={config.label}
    >
      <svg
        className="absolute inset-x-0 top-0 h-5 w-full"
        viewBox="0 0 40 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M5 0h20l10 10v10H5V0Z"
          fill="currentColor"
          opacity="0.14"
        />
        <path
          d="M25 0v10h10"
          fill="currentColor"
          opacity="0.24"
        />
      </svg>

      <span className="relative text-[9px] font-black leading-none tracking-[-0.04em]">
        {config.abbreviation}
      </span>
    </div>
  );
}