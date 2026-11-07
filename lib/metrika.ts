// TEST ONLY: set to false before opening the service to real users.
// In test mode analytics runs even after a previous refusal.
export const TEST_ANALYTICS_WITHOUT_CONSENT = true;
export const VK_PIXEL_ID = "3812476";

export const YANDEX_METRIKA_ID = 112328966;

declare global {
  interface Window {
    dataLayer?: Array<{ event: string }>;
    _tmr?: Array<{ id: string; type: string; start?: number; url?: string }>;
    ym?: {
      (...args: unknown[]): void;
      a?: unknown[][];
    };
  }
}

export function reachMetrikaGoal(goalName: string) {
  if (typeof window === "undefined" || !window.ym) return;
  // Explicit allowlist: never send customer data or uploaded file metadata.
  if (["file_selected", "order_form_submit", "payment_started"].includes(goalName)) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: goalName });
  }
  if (window.ym) window.ym(YANDEX_METRIKA_ID, "reachGoal", goalName);
}