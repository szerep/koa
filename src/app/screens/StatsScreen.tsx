import { useMemo, useSyncExternalStore, type CSSProperties } from 'react'
import { rewardRules } from '../../config/rewards'
import { computeStats, type DayStats } from '../../core/stats/stats'
import { walletStore } from '../../features/rewards/store'
import { settingsStore } from '../../features/settings/store'
import {
  chartMax,
  dateLong,
  dayCount,
  formatDuration,
  sessionCount,
  spokenDuration,
  weekdayShort,
} from '../../features/stats/format'
import { useNow } from '../../features/stats/useNow'
import { Button } from '../../ui/Button'
import { LeafGlyph } from '../../ui/glyphs'
import { ProgressRing } from '../../ui/ProgressRing'
import { ComingSoonScreen } from './ComingSoonScreen'
import './stats.css'

/** Stats: a study journal read straight from the reward ledger (src/core/stats). */
export function StatsScreen() {
  const wallet = useSyncExternalStore(walletStore.subscribe, walletStore.getState)
  const { dailyGoalMinutes: goal } = useSyncExternalStore(settingsStore.subscribe, settingsStore.getState)
  const now = useNow()
  const stats = useMemo(
    () => computeStats(wallet.ledger, now, { coinsPerFocusMinute: rewardRules.coinsPerFocusMinute }),
    [wallet.ledger, now],
  )

  if (stats.allTime.sessions === 0) {
    return (
      <ComingSoonScreen
        title="Your study journal"
        message="Finish your first focus session and Koa will keep track of your study time, streak and week here."
      >
        <Button
          onClick={() => {
            window.location.hash = '/home'
          }}
        >
          Start focusing
        </Button>
      </ComingSoonScreen>
    )
  }

  const { today, window: week, allTime, streak } = stats
  const weekMinutes = week.reduce((sum, d) => sum + d.minutes, 0)

  return (
    <div className="stats">
      <h1 className="stats__title">Stats</h1>

      <section className="stats-card stats-today" aria-labelledby="stats-today">
        <ProgressRing
          className="stats-today__ring"
          progress={goal > 0 ? today.minutes / goal : 0}
          thickness={0.075}
          label="Daily goal"
        >
          <div className="stats-today__figure" aria-hidden="true">
            <span className="stats-today__minutes">{Math.round(today.minutes)}</span>
            <span className="stats-today__of">of {goal} min</span>
          </div>
        </ProgressRing>
        <div className="stats-today__text">
          <h2 id="stats-today" className="stats-card__title">
            Today
          </h2>
          <p className="visually-hidden">
            {spokenDuration(today.minutes)} of your {goal}-minute daily goal.
          </p>
          <p className="stats-today__sessions">{sessionCount(today.sessions)}</p>
          <p className="stats-today__status" data-done={today.minutes >= goal || undefined}>
            {goalStatus(today, goal)}
          </p>
        </div>
      </section>

      <div className="stats__figures">
        <section className="stats-card stats-figure" aria-labelledby="stats-streak">
          <h2 id="stats-streak" className="stats-figure__label">
            Current streak
          </h2>
          <p className="stats-figure__value">{dayCount(streak.current)}</p>
          <p className="stats-figure__note">{streakNote(streak.current, streak.activeToday)}</p>
          <p className="stats-figure__note">Best: {dayCount(streak.best)}</p>
        </section>

        <section className="stats-card stats-figure" aria-labelledby="stats-total">
          <h2 id="stats-total" className="stats-figure__label">
            All-time focus
          </h2>
          <p className="stats-figure__value">
            <span aria-hidden="true">{formatDuration(allTime.minutes)}</span>
            <span className="visually-hidden">{spokenDuration(allTime.minutes)}</span>
          </p>
          <p className="stats-figure__note">{sessionCount(allTime.sessions)}</p>
          <p className="stats-figure__note">on {dayCount(allTime.activeDays)}</p>
        </section>
      </div>

      <WeekChart week={week} goal={goal} total={weekMinutes} />
    </div>
  )
}

function goalStatus(today: DayStats, goal: number): string {
  if (today.goalReached) return `Daily goal reached. You earned ${rewardRules.dailyGoalBonus} bonus coins.`
  // The goal was lowered below today's minutes: the bonus is paid when the next session ends.
  if (today.minutes >= goal) return 'Goal met. The bonus comes with your next focus session.'
  if (today.minutes === 0) return 'Start a focus session to fill the ring.'
  return `${formatDuration(goal - today.minutes)} to go.`
}

function streakNote(current: number, activeToday: boolean): string {
  if (current === 0) return 'Focus today to start a new one.'
  return activeToday ? 'You focused today.' : 'Focus today to keep it going.'
}

interface WeekChartProps {
  week: readonly DayStats[]
  goal: number
  total: number
}

/** The rolling 7 days as CSS bars. The list carries the full text for screen readers. */
function WeekChart({ week, goal, total }: WeekChartProps) {
  const max = chartMax(
    week.map((d) => d.minutes),
    goal,
  )
  const todayKey = week[week.length - 1]?.day

  return (
    <section className="stats-card week" aria-labelledby="stats-week">
      <div className="week__head">
        <h2 id="stats-week" className="stats-card__title">
          Last 7 days
        </h2>
        <p className="week__total">
          <span aria-hidden="true">{formatDuration(total)}</span>
          <span className="visually-hidden">{spokenDuration(total)} in total</span>
        </p>
      </div>
      <p className="week__legend" aria-hidden="true">
        <span className="week__legend-line" />
        Daily goal, {goal} min
      </p>

      <div className="week__plot" style={{ '--goal': goal / max } as CSSProperties}>
        <div className="week__goal" aria-hidden="true" />
        <ol className="week__bars" aria-label={`Focus time per day. Daily goal: ${goal} minutes.`}>
          {week.map((day, i) => {
            const isToday = day.day === todayKey
            const minutes = Math.round(day.minutes)
            return (
              <li
                key={day.day}
                className="week__day"
                data-today={isToday || undefined}
                data-goal={day.goalReached || undefined}
                style={{ '--h': day.minutes / max, '--i': i } as CSSProperties}
              >
                <span className="visually-hidden">
                  {dateLong(day.day)}
                  {isToday ? ' (today)' : ''}: {spokenDuration(day.minutes)}, {sessionCount(day.sessions)}
                  {day.goalReached ? ', goal reached' : ''}.
                </span>
                <span className="week__column" aria-hidden="true">
                  <span className="week__value">
                    {day.goalReached && <LeafGlyph size={12} className="week__leaf" />}
                    {minutes > 0 ? minutes : ''}
                  </span>
                  <span className="week__bar" data-empty={minutes === 0 || undefined} />
                </span>
                <span className="week__label" aria-hidden="true">
                  {isToday ? 'Today' : weekdayShort(day.day)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
