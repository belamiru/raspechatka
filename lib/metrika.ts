export const YANDEX_METRIKA_ID = 112328966;

declare global {
  interface Window {
    ym?: {
      (...args: unknown[]): void;
      a?: unknown[][];
    };
  }
}

export function reachMetrikaGoal(goalName: string) {
  if (typeof window === "undefined" || !window.ym) {
    return;
  }

  window.ym(YANDEX_METRIKA_ID, "reachGoal", goalName);
}