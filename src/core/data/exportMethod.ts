/**
 * How the export file reaches the user (Phase 9, Step 8, decision D11). Pure.
 *
 * In an installed app a download link is unreliable (iOS Home Screen apps especially), so the
 * file goes to the system share sheet, but only where the browser says it can share that exact
 * file. Everywhere else, including every browser tab, the Phase 8 download is kept.
 */

export type ExportMethod = 'share' | 'download'

export interface ExportEnvironment {
  /** Running as an installed app (`isStandalone`). */
  standalone: boolean
  /** `navigator.canShare({ files: [file] })` for the export file; false without the Web Share API. */
  canShareFiles: boolean
}

export function exportMethod({ standalone, canShareFiles }: ExportEnvironment): ExportMethod {
  return standalone && canShareFiles ? 'share' : 'download'
}

/**
 * True when a rejected `navigator.share()` means the user closed the sheet (`AbortError`).
 * That's a choice, not a failure: no message and no fallback download.
 */
export function isShareCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}
