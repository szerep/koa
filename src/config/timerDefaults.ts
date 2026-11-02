import type { TimerConfig, TimerMode } from '../core/timer/engine'

export type { TimerMode }

export const timerDefaults: TimerConfig = {
  durations: { focus: 25, shortBreak: 5, longBreak: 20 },
  sessionsPerCycle: 4,
}

export const modeLabels: Record<TimerMode, string> = {
  focus: 'Focus',
  shortBreak: 'Short break',
  longBreak: 'Long break',
}
