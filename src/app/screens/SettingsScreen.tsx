import { useId, useSyncExternalStore } from 'react'
import { rewardRules } from '../../config/rewards'
import { focusPresets, settingsSpec } from '../../config/settings'
import { sessionsForGoal, type NumericSetting } from '../../core/settings/settings'
import { isInProgress } from '../../core/timer/engine'
import { settingsStore } from '../../features/settings/store'
import { timerStore } from '../../features/timer/store'
import { wakeLock } from '../../features/wakeLock/store'
import type { WakeLockStatus } from '../../features/wakeLock/wakeLock'
import { Stepper } from '../../ui/Stepper'
import { Switch } from '../../ui/Switch'
import './settings.css'

const minutes = (n: number) => `${n} ${n === 1 ? 'minute' : 'minutes'}`
const sessions = (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`

interface RowProps {
  setting: NumericSetting
  label: string
  value: number
  unit: string
  valueText: (n: number) => string
  hint: string
  decreaseLabel: string
  increaseLabel: string
  children?: React.ReactNode
}

/** One settings row: what it is and its range on the left, the stepper on the right. */
function StepperRow({ setting, label, value, unit, valueText, hint, decreaseLabel, increaseLabel, children }: RowProps) {
  const hintId = useId()
  return (
    <div className="settings-row">
      <div className="settings-row__main">
        <div className="settings-row__text">
          <span className="settings-row__label">{label}</span>
          <span id={hintId} className="settings-row__hint">
            {hint}
          </span>
        </div>
        <Stepper
          label={label}
          value={value}
          range={settingsSpec.ranges[setting]}
          onChange={(next) => settingsStore.setNumber(setting, next)}
          unit={unit}
          valueText={valueText}
          decreaseLabel={decreaseLabel}
          increaseLabel={increaseLabel}
          describedBy={hintId}
        />
      </div>
      {children}
    </div>
  )
}

const rangeHint = (setting: NumericSetting, unit: string) => {
  const { min, max } = settingsSpec.ranges[setting]
  return `${min} to ${max} ${unit}`
}

export function SettingsScreen() {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.getState)
  const timer = useSyncExternalStore(timerStore.subscribe, timerStore.getState)
  const { focus, shortBreak, longBreak } = settings.durations
  const goal = settings.dailyGoalMinutes
  const goalSessions = sessionsForGoal(goal, focus)

  return (
    <div className="settings">
      <h1 className="settings__title">Settings</h1>

      <section className="settings-card" aria-labelledby="settings-timer">
        <h2 id="settings-timer" className="settings-card__title">
          Timer
        </h2>
        {isInProgress(timer) && (
          <p className="settings-card__note">Your current session keeps its length. Changes start with the next one.</p>
        )}

        <StepperRow
          setting="focus"
          label="Focus"
          value={focus}
          unit="min"
          valueText={minutes}
          hint={rangeHint('focus', 'minutes')}
          decreaseLabel="Shorter focus"
          increaseLabel="Longer focus"
        >
          <div className="presets" role="group" aria-label="Focus presets">
            {focusPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                className="presets__chip"
                aria-pressed={focus === preset}
                onClick={() => settingsStore.setNumber('focus', preset)}
              >
                {preset} min
              </button>
            ))}
          </div>
        </StepperRow>

        <StepperRow
          setting="shortBreak"
          label="Short break"
          value={shortBreak}
          unit="min"
          valueText={minutes}
          hint={rangeHint('shortBreak', 'minutes')}
          decreaseLabel="Shorter short break"
          increaseLabel="Longer short break"
        />

        <StepperRow
          setting="longBreak"
          label="Long break"
          value={longBreak}
          unit="min"
          valueText={minutes}
          hint={rangeHint('longBreak', 'minutes')}
          decreaseLabel="Shorter long break"
          increaseLabel="Longer long break"
        />

        <StepperRow
          setting="longBreakEvery"
          label="Long break after"
          value={settings.longBreakEvery}
          unit={settings.longBreakEvery === 1 ? 'session' : 'sessions'}
          valueText={(n) => `${sessions(n)} of focus`}
          hint={rangeHint('longBreakEvery', 'focus sessions')}
          decreaseLabel="Fewer sessions before a long break"
          increaseLabel="More sessions before a long break"
        />
      </section>

      <section className="settings-card" aria-labelledby="settings-goal">
        <h2 id="settings-goal" className="settings-card__title">
          Daily goal
        </h2>
        <p className="settings-card__lead">
          Focus this long in a day to earn {rewardRules.dailyGoalBonus} bonus coins. Pick anything from{' '}
          {rangeHint('dailyGoalMinutes', 'minutes')}.
        </p>

        <StepperRow
          setting="dailyGoalMinutes"
          label="Focus per day"
          value={goal}
          unit="min"
          valueText={minutes}
          hint={`About ${sessions(goalSessions)} of ${focus} min`}
          decreaseLabel="Lower daily goal"
          increaseLabel="Higher daily goal"
        />
      </section>

      <section className="settings-card" aria-labelledby="settings-focus">
        <h2 id="settings-focus" className="settings-card__title">
          While you focus
        </h2>
        <KeepScreenOnRow enabled={settings.keepScreenOn} />
      </section>
    </div>
  )
}

const keepScreenOnHints: Record<WakeLockStatus, string> = {
  unsupported: "This browser can't keep the screen on, so your device's own screen timeout applies.",
  off: 'Stops your screen from dimming or locking while a focus session runs. Breaks and paused sessions are left alone.',
  active: 'Your screen is staying on for this focus session.',
  failed: "Your browser didn't allow it just now (low battery mode can do this). Koa will try again.",
}

function KeepScreenOnRow({ enabled }: { enabled: boolean }) {
  const status = useSyncExternalStore(wakeLock.subscribe, wakeLock.getStatus)
  const labelId = useId()
  const hintId = useId()
  const unsupported = status === 'unsupported'
  return (
    <div className="settings-row">
      <div className="settings-row__main">
        <div className="settings-row__text">
          <span id={labelId} className="settings-row__label">
            Keep screen on
          </span>
          <span id={hintId} className="settings-row__hint">
            {keepScreenOnHints[status]}
          </span>
        </div>
        <Switch
          checked={enabled && !unsupported}
          onChange={(on) => settingsStore.setFlag('keepScreenOn', on)}
          labelledBy={labelId}
          describedBy={hintId}
          disabled={unsupported}
        />
      </div>
    </div>
  )
}
