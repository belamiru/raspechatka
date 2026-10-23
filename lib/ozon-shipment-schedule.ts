/**
 * График сдачи посылок в пункт приёма Ozon.
 *
 * cutoff_at в Ozon Delivery API — плановый момент отгрузки, то есть когда магазин
 * сдаст посылку. Его задаёт магазин, и от него Ozon считает срок доставки.
 * Раньше мы его не передавали, поэтому Ozon подставлял момент расчёта.
 *
 * Значения по умолчанию: понедельник–суббота в 19:30 по Москве.
 * Их можно изменить переменными окружения без правки кода:
 *   OZON_SHIPMENT_DAYS          — дни недели через запятую, 1 = понедельник … 7 = воскресенье
 *   OZON_SHIPMENT_TIME          — время сдачи, ЧЧ:ММ по Москве
 *   OZON_SHIPMENT_LEAD_MINUTES  — сколько минут нужно на изготовление и упаковку
 */

/** Москва и Воронеж живут в UTC+3 круглый год, перехода на летнее время нет. */
const MOSCOW_OFFSET_MINUTES = 3 * 60;
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6];
const DEFAULT_TIME = { hours: 19, minutes: 30 };
const DEFAULT_LEAD_MINUTES = 120;
/** Больше двух недель вперёд не ищем: такой график почти наверняка ошибочен. */
const SEARCH_DAYS = 14;

export type OzonShipmentSchedule = {
  days: number[];
  hours: number;
  minutes: number;
  leadMinutes: number;
};

function parseDays(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_DAYS;
  const days = value.split(",").map((part) => Number(part.trim()));
  if (!days.length || !days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) {
    throw new Error("OZON_SHIPMENT_DAYS: укажите дни через запятую, от 1 (понедельник) до 7 (воскресенье).");
  }
  return [...new Set(days)];
}

function parseTime(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_TIME;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const hours = Number(match?.[1]);
  const minutes = Number(match?.[2]);
  if (!match || hours > 23 || minutes > 59) {
    throw new Error("OZON_SHIPMENT_TIME: укажите время в формате ЧЧ:ММ, например 19:30.");
  }
  return { hours, minutes };
}

function parseLead(value: string | undefined) {
  if (!value?.trim()) return DEFAULT_LEAD_MINUTES;
  const lead = Number(value.trim());
  if (!Number.isInteger(lead) || lead < 0 || lead > 7 * 24 * 60) {
    throw new Error("OZON_SHIPMENT_LEAD_MINUTES: укажите целое число минут от 0 до 10080.");
  }
  return lead;
}

export function getOzonShipmentSchedule(): OzonShipmentSchedule {
  const time = parseTime(process.env.OZON_SHIPMENT_TIME);
  return {
    days: parseDays(process.env.OZON_SHIPMENT_DAYS),
    hours: time.hours,
    minutes: time.minutes,
    leadMinutes: parseLead(process.env.OZON_SHIPMENT_LEAD_MINUTES),
  };
}

/**
 * Ближайшая отгрузка, к которой заказ успеют подготовить.
 * Пример при графике пн–сб 19:30 и запасе 2 часа:
 *   оплата в пятницу в 15:00 → пятница 19:30;
 *   оплата в пятницу в 18:00 → суббота 19:30;
 *   оплата в субботу в 18:00 → понедельник 19:30.
 */
export function nextOzonShipmentSlot(
  now: Date = new Date(),
  schedule: OzonShipmentSchedule = getOzonShipmentSchedule(),
): Date {
  const earliest = now.getTime() + schedule.leadMinutes * 60_000;
  // Календарная дата по Москве: сдвигаем время и читаем UTC-поля.
  const local = new Date(now.getTime() + MOSCOW_OFFSET_MINUTES * 60_000);
  for (let offset = 0; offset <= SEARCH_DAYS; offset += 1) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset));
    const weekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
    if (!schedule.days.includes(weekday)) continue;
    const slot = Date.UTC(
      day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(),
      schedule.hours, schedule.minutes,
    ) - MOSCOW_OFFSET_MINUTES * 60_000;
    if (slot >= earliest) return new Date(slot);
  }
  throw new Error("Не удалось найти ближайшую отгрузку Ozon: проверьте график OZON_SHIPMENT_DAYS.");
}

/** Формат, как в примерах документации Ozon: 2026-07-16T12:00:00Z. */
export function toOzonCutoff(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
