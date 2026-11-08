const format = new Intl.NumberFormat()

/** A coin amount as words for screen readers and announcements: "1 coin", "1,250 coins". */
export function coinText(coins: number): string {
  return `${format.format(coins)} ${coins === 1 ? 'coin' : 'coins'}`
}
