// The app version shown in Settings (Phase 9, Step 4; decision D6). Used by vite.config.ts at
// build time (`__APP_VERSION__`). Never fails the build: without a usable commit hash the
// caption is the package version alone.

const COMMIT = /^[0-9a-f]{7,40}$/i

export interface AppVersionInput {
  /** `version` from package.json. */
  packageVersion: string
  /** `CF_PAGES_COMMIT_SHA`, set by Cloudflare Pages builds. Preferred when valid. */
  cloudflareSha?: string | undefined
  /** `git rev-parse --short HEAD` locally, or undefined when git isn't available. */
  gitSha?: string | undefined
}

/** The short (7-character) commit hash, or null when the value isn't a commit hash. */
export function shortCommit(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return COMMIT.test(trimmed) ? trimmed.slice(0, 7).toLowerCase() : null
}

/** "0.0.0 (abc1234)", or "0.0.0" when no commit is known. */
export function appVersion({ packageVersion, cloudflareSha, gitSha }: AppVersionInput): string {
  const version = packageVersion.trim() || '0.0.0'
  const commit = shortCommit(cloudflareSha) ?? shortCommit(gitSha)
  return commit ? `${version} (${commit})` : version
}
