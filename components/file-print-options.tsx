"use client";

import { useId, useState } from "react";

/*
 * Тип печати — свойство конкретного файла, а не всего заказа: в корзине могут
 * одновременно лежать документы, фотографии и плакаты, и у каждого свои опции.
 *
 * Пока это только интерфейс: выбор никуда не отправляется и на цену не влияет.
 * Когда появится прайс, состояние переедет на сервер рядом с printSettings.
 */
export const PRINT_KINDS = [
  {
    id: "document",
    label: "Документ",
    description: "Тексты, таблицы, презентации",
  },
  {
    id: "photo",
    label: "Фото",
    description: "Снимки 10×15, A4",
  },
  {
    id: "poster",
    label: "Плакат",
    description: "Чертежи и постеры до A0",
  },
] as const;

export type PrintKindId = (typeof PRINT_KINDS)[number]["id"];

export type PrintExtraOptions = { paper: "80" | "120" | "250"; lamination: "none" | "matte" | "gloss"; laminationThickness: "80" | "120"; binding: boolean; frontCover: "transparent" | "leather"; backCover: "transparent" | "leather"; staple: "none" | "left" | "right"; };
export const DEFAULT_PRINT_EXTRA_OPTIONS: PrintExtraOptions = { paper: "80", lamination: "none", laminationThickness: "80", binding: false, frontCover: "transparent", backCover: "transparent", staple: "none" };

/*
 * Какие группы дополнительных опций относятся к типу печати. Пока цены нет,
 * наборы одинаковые по смыслу, но карта уже задаёт зависимость: когда появятся
 * форматы фотобумаги и плакатов, достаточно будет расширить именно её.
 */
const OPTION_GROUPS: Record<PrintKindId, readonly OptionGroupId[]> = {
  document: ["paper", "lamination", "binding", "staple"],
  photo: ["paper", "lamination"],
  poster: ["lamination"],
};

type OptionGroupId = "paper" | "lamination" | "binding" | "staple";

/* Кнопка «?» с подсказкой: работает по клику, поэтому годится и для телефона. */
function Hint({ text, label }: { text: string; label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverId = useId();

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        aria-label={`Подсказка: ${label}`}
        title={text}
        className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-black text-slate-500 transition hover:border-blue-500 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        ?
      </button>

      {isOpen && (
        <span
          id={popoverId}
          role="dialog"
          aria-label={`Подсказка: ${label}`}
          className="absolute left-0 top-6 z-30 block w-64 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-xl"
        >
          {text}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-2 block text-xs font-bold text-blue-700 hover:underline"
          >
            Понятно
          </button>
        </span>
      )}
    </span>
  );
}

/* Выбор типа печати для одного файла. */
export function PrintKindSelector({
  value,
  onChange,
}: {
  value: PrintKindId;
  onChange: (value: PrintKindId) => void;
}) {
  return (
    <div>
      <p className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
        Тип печати
        <Hint
          label="Тип печати"
          text="Выберите, что печатать из этого файла: обычный документ, фотографию или плакат. От этого зависят доступные опции, а позже — и цена. Тип задаётся для каждого файла отдельно."
        />
      </p>

      <div className="mt-1.5 grid gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-3" role="radiogroup" aria-label="Тип печати">
        {PRINT_KINDS.map((kind) => {
          const isSelected = kind.id === value;

          return (
            <button
              key={kind.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(kind.id)}
              className={`rounded-lg px-2 py-2 text-left transition ${
                isSelected
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="block text-sm font-bold">{kind.label}</span>
              <span className="mt-0.5 block text-[10px] font-medium leading-3 text-slate-500">
                {kind.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Группа кнопок «выбрать один из вариантов». */
function ChoiceRow<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
  columns,
}: {
  label: string;
  hint: string;
  options: { value: T; label: string; note?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  columns?: number;
}) {
  return (
    <div>
      <p className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
        <Hint text={hint} label={label} />
      </p>

      <div
        className="mt-1.5 grid gap-1 rounded-xl bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-2 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
              {option.note && (
                <span className="mt-0.5 block text-[10px] font-medium leading-3 text-slate-500">
                  {option.note}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/*
 * Дополнительные опции для одного файла. Набор зависит от типа печати,
 * но пока цены нет, выбор ни на что не влияет.
 */
export function PrintExtrasOptions({ kind, initialOptions = DEFAULT_PRINT_EXTRA_OPTIONS, onApplyToAll }: { kind: PrintKindId; initialOptions?: PrintExtraOptions; onApplyToAll: (options: PrintExtraOptions) => void }) {
  const [paper, setPaper] = useState<"80" | "120" | "250">(initialOptions.paper);
  const [lamination, setLamination] = useState<"none" | "matte" | "gloss">(initialOptions.lamination);
  const [laminationThickness, setLaminationThickness] = useState<"80" | "120">(initialOptions.laminationThickness);
  const [binding, setBinding] = useState(initialOptions.binding);
  const [frontCover, setFrontCover] = useState<"transparent" | "leather">(initialOptions.frontCover);
  const [backCover, setBackCover] = useState<"transparent" | "leather">(initialOptions.backCover);
  const [staple, setStaple] = useState<"none" | "left" | "right">(initialOptions.staple);

  const groups = OPTION_GROUPS[kind];
  const isLaminated = lamination !== "none";

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Дополнительные опции</p>
        <p className="text-xs font-semibold text-slate-500">Скоро появятся цены</p>
      </div>

      {kind !== "document" && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
          Для типа «{PRINT_KINDS.find((item) => item.id === kind)?.label}» форматы и цены появятся
          вместе с прайсом. Пока доступны только общие опции.
        </p>
      )}

      {groups.includes("paper") && (
        <div>
          <ChoiceRow
            label="Бумага"
            hint="Плотность бумаги влияет на то, как лист держит форму и просвечивает ли при двусторонней печати."
            value={paper}
            onChange={setPaper}
            options={[
              { value: "80", label: "80 г/м²", note: "офисная" },
              { value: "120", label: "120 г/м²", note: "плотнее" },
              { value: "250", label: "250 г/м²", note: "картон" },
            ]}
          />

          {paper === "80" && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              <strong>80 г/м² — обычная офисная бумага.</strong> Подходит для большинства документов,
              но при двусторонней печати текст может слегка просвечивать.
            </p>
          )}

          {paper === "120" && (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
              120 г/м² — плотнее офисной: лист меньше просвечивает при двусторонней печати
              и приятнее на ощупь.
            </p>
          )}

          {paper === "250" && (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
              250 г/м² — картон. Для обложек, грамот, визиток и приглашений.
              Двусторонняя печать на таком листе недоступна.
            </p>
          )}
        </div>
      )}

      {groups.includes("lamination") && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <ChoiceRow
            label="Ламинация"
            hint="Плёнка защищает лист от влаги, грязи и заломов. Матовая не бликует, глянцевая делает цвета ярче."
            value={lamination}
            onChange={setLamination}
            options={[
              { value: "none", label: "Без ламинации" },
              { value: "matte", label: "Матовая" },
              { value: "gloss", label: "Глянцевая" },
            ]}
          />

          <div className="mt-3">
            <ChoiceRow
              label="Плотность плёнки"
              hint="80 мкр — тонкая, для документов и справок. 120 мкр — жёстче, для удостоверений, меню и карточек."
              value={laminationThickness}
              onChange={setLaminationThickness}
              disabled={!isLaminated}
              options={[
                { value: "80", label: "80 мкр" },
                { value: "120", label: "120 мкр" },
              ]}
            />

            {!isLaminated && <p className="mt-1.5 text-xs text-slate-400">Сначала выберите ламинацию.</p>}
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Ламинируется каждая страница отдельно. Для двусторонних документов это удорожает заказ вдвое.
          </p>
        </div>
      )}

      {groups.includes("binding") && (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <div className="min-w-0">
              <p className="flex items-center text-sm font-bold text-slate-800">
                Переплёт на металлическую пружину
                <Hint
                  label="Переплёт на пружину"
                  text="Пружина позволяет раскрывать документ на 180° и добавлять листы. Подходит для курсовых, отчётов и инструкций."
                />
              </p>
              <p className="mt-0.5 text-xs leading-4 text-slate-500">Раскрывается полностью, листы не выпадают</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={binding}
              aria-label="Переплёт на металлическую пружину"
              onClick={() => setBinding((current) => !current)}
              className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${binding ? "bg-blue-600" : "bg-slate-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  binding ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          {binding && (
            <div className="ml-3 space-y-3 border-l-2 border-blue-100 pl-3">
              <ChoiceRow
                label="Передняя обложка"
                hint="Прозрачная показывает титульный лист. Тиснение под кожу выглядит строже и скрывает содержимое."
                value={frontCover}
                onChange={setFrontCover}
                options={[
                  { value: "transparent", label: "Прозрачная" },
                  { value: "leather", label: "Тиснение" },
                ]}
              />

              <ChoiceRow
                label="Задняя обложка"
                hint="Задняя обложка защищает последний лист. Тиснение под кожу даёт более аккуратный вид готовому документу."
                value={backCover}
                onChange={setBackCover}
                options={[
                  { value: "transparent", label: "Прозрачная" },
                  { value: "leather", label: "Тиснение" },
                ]}
              />

              <p className="text-xs leading-5 text-slate-500">
                «Тиснение под кожу» — плотная фактурная обложка тёмного цвета.
              </p>
            </div>
          )}
        </div>
      )}

      {groups.includes("staple") && (
        <div>
          <ChoiceRow
            label="Скрепление степлером в углу"
            hint="Самый простой и быстрый способ. Подходит для документов до 30 листов, которые не нужно раскрывать полностью."
            value={staple}
            onChange={setStaple}
            disabled={binding}
            options={[
              { value: "none", label: "Не нужно" },
              { value: "left", label: "Левый угол" },
              { value: "right", label: "Правый угол" },
            ]}
          />

          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            {binding
              ? "Недоступно: выбран переплёт на пружину."
              : "Для документов до 30 листов. Для больших документов лучше выбрать переплёт."}
          </p>
        </div>
      )}

      <button type="button" onClick={() => onApplyToAll({ paper, lamination, laminationThickness, binding, frontCover, backCover, staple })} className="w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50">
        Применить ко всем файлам заказа
      </button>
    </div>
  );
}
