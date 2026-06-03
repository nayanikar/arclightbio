export const SESSIONS_UPDATED_EVENT = "arclight:sessions-updated";
export const OPPORTUNITIES_UPDATED_EVENT = "arclight:opportunities-updated";

export function notifyOpportunitiesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPPORTUNITIES_UPDATED_EVENT));
}
