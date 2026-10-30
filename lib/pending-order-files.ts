import type { FilePrintSettings } from "@/lib/print-settings";

/*
 * Мост между виджетом на главной и страницей заказа.
 *
 * Файл из hero-виджета уже подготовлен: документ лежит на сервере как print
 * draft и опознаётся по draftId, изображение передаём тем же File. Повторный
 * анализ на /order создал бы второй черновик и осиротил первый, поэтому
 * переносим готовые данные как есть.
 *
 * Хранилище живёт в памяти вкладки: клиентский переход <Link> не перезагружает
 * страницу, поэтому File и draftId остаются валидными. Обычная перезагрузка
 * сбрасывает хранилище — восстанавливать File из ничего нельзя, и в этом случае
 * пользователь просто загрузит файл заново на самой странице заказа.
 */
export type PendingOrderFile = {
  id: string;
  file: File;
  kind: "document" | "image";
  pageCount: number;
  draftId: string | null;
  previewUrl: string | null;
  printSettings: FilePrintSettings;
};

let pendingFiles: PendingOrderFile[] = [];

export function setPendingOrderFiles(files: PendingOrderFile[]) {
  pendingFiles = files;
}

/* Забирает файлы и очищает хранилище, чтобы не задвоить их при повторном монтировании. */
export function takePendingOrderFiles(): PendingOrderFile[] {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}
