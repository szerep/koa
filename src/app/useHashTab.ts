import { useCallback, useSyncExternalStore } from 'react'

/** Current tab mirrored in `location.hash` (#/shop), so refresh and back work. */
export function useHashTab<T extends string>(tabs: readonly T[], fallback: T) {
  const read = useCallback((): T => {
    const id = window.location.hash.replace(/^#\/?/, '')
    return (tabs as readonly string[]).includes(id) ? (id as T) : fallback
  }, [tabs, fallback])

  const tab = useSyncExternalStore(
    (notify) => {
      window.addEventListener('hashchange', notify)
      return () => window.removeEventListener('hashchange', notify)
    },
    read,
    () => fallback,
  )

  const setTab = useCallback((next: T) => {
    if (next === read()) return
    window.location.hash = `/${next}`
  }, [read])

  return [tab, setTab] as const
}
