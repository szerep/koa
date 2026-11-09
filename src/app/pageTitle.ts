/**
 * The document title: the countdown while a session runs ("24:59 Focus · Koa"), otherwise the
 * tab's own title: "Koa" on Home (the first tab), "Shop · Koa" elsewhere.
 */
export function pageTitle<T extends string>(
  tab: T,
  tabs: readonly { id: T; label: string }[],
  countdown: string | null = null,
): string {
  if (countdown) return `${countdown} · Koa`
  const index = tabs.findIndex((t) => t.id === tab)
  return index <= 0 ? 'Koa' : `${tabs[index].label} · Koa`
}
