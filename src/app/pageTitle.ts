/** The document title for a tab: "Koa" on Home (the first tab), "Shop · Koa" elsewhere. */
export function pageTitle<T extends string>(tab: T, tabs: readonly { id: T; label: string }[]): string {
  const index = tabs.findIndex((t) => t.id === tab)
  return index <= 0 ? 'Koa' : `${tabs[index].label} · Koa`
}
