/*
 * Логотип сайта: НАЧАТЬ-ПЕЧАТЬ.РФ
 *
 * Цвета по частям:
 *   «НАЧАТЬ»  — чернильный (тёмно-синий);
 *   дефис     — чернильный;
 *   «ПЕЧАТЬ»  — голубой;
 *   точка     — чернильный;
 *   «рф»      — строчными, чернильный.
 *
 * Компонент один на весь сайт. Раньше название было вписано в семь файлов,
 * и любая правка требовала менять каждое — теперь достаточно этого.
 */

/* Чернильный: тёмно-синий, почти чёрный с синим отливом. */
export const INK_COLOR = "#12294d";

/* Голубой для второй половины названия. */
export const BRAND_BLUE_COLOR = "#2563eb";

/*
 * Начертание намеренно не самое жирное: прежний font-black (900) выглядел
 * слишком тяжело, здесь font-bold (700).
 *
 * Размеры подобраны так, чтобы в шапке на телефоне название не выталкивало
 * кнопку «Загрузить файл» и бургер: 13px на узких экранах, 18px с sm, 20px на lg.
 */
const SIZE_CLASSES = {
  header: "whitespace-nowrap text-[13px] sm:text-lg lg:text-xl",
  footer: "text-lg",
  page: "text-xl",
} as const;

export type BrandLogoSize = keyof typeof SIZE_CLASSES;

export function BrandLogo({
  size = "header",
  className = "",
}: {
  size?: BrandLogoSize;
  className?: string;
}) {
  return (
    <span className={`font-bold tracking-tight ${SIZE_CLASSES[size]} ${className}`.trim()}>
      <span style={{ color: INK_COLOR }}>НАЧАТЬ</span>
      <span style={{ color: INK_COLOR }}>-</span>
      <span style={{ color: BRAND_BLUE_COLOR }}>ПЕЧАТЬ</span>
      <span style={{ color: INK_COLOR }}>.рф</span>
    </span>
  );
}
