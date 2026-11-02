import { useState, useSyncExternalStore } from 'react'
import { isInProgress, type TimerMode } from '../../core/timer/engine'
import { modeLabels } from '../../config/timerDefaults'
import { KoaCompanion } from '../../features/koala/KoaCompanion'
import { settingsStore } from '../../features/settings/store'
import { wardrobeStore } from '../../features/shop/store'
import { CycleLeaves, SkipConfirm, TimerControls, TimerDisplay } from '../../features/timer/TimerFace'
import { useTimer } from '../../features/timer/useTimer'
import { ProgressRing } from '../../ui/ProgressRing'
import { SegmentedControl } from '../../ui/SegmentedControl'
import './home.css'

const modeOptions = (Object.keys(modeLabels) as TimerMode[]).map((value) => ({
  value,
  label: modeLabels[value],
}))

/** Home: Koa in the progress halo, with the timer below. */
export function HomeScreen() {
  const timer = useTimer()
  const { state } = timer
  const [confirmingSkip, setConfirmingSkip] = useState(false)
  const wardrobe = useSyncExternalStore(wardrobeStore.subscribe, wardrobeStore.getState)
  const { longBreakEvery } = useSyncExternalStore(settingsStore.subscribe, settingsStore.getState)
  const inProgress = isInProgress(state)

  const onSkip = () => {
    // Skipping a focus session that has started loses it, so ask first.
    if (state.mode === 'focus' && inProgress) setConfirmingSkip(true)
    else timer.skip()
  }

  return (
    <div className="home">
      <SegmentedControl
        className="home__modes"
        label="Timer mode"
        options={modeOptions}
        value={state.mode}
        onChange={timer.selectMode}
        disabled={inProgress}
      />

      <div className="home__stage" data-reward-origin>
        <ProgressRing
          className="home__ring"
          progress={timer.progress}
          label={`${modeLabels[state.mode]} progress`}
        />
        <KoaCompanion
          className="home__koala"
          width="calc(var(--stage) * 0.7)"
          figureSizes="(min-width: 960px) 308px, (min-width: 600px) 350px, 60vw"
          interactive
          speaks
          wearing={Object.values(wardrobe).filter((id): id is string => id !== null)}
        />
      </div>

      <div className="home__timer">
        <TimerDisplay seconds={timer.remainingMs / 1000} />
        <CycleLeaves
          mode={state.mode}
          completed={state.completedInCycle}
          total={longBreakEvery}
        />
      </div>

      <div className="home__controls">
        {confirmingSkip ? (
          <SkipConfirm
            onKeep={() => setConfirmingSkip(false)}
            onSkip={() => {
              setConfirmingSkip(false)
              timer.skip()
            }}
          />
        ) : (
          <TimerControls
            status={state.status}
            mode={state.mode}
            onPrimary={timer.toggle}
            onReset={timer.reset}
            onSkip={onSkip}
            canReset={inProgress}
          />
        )}
      </div>
    </div>
  )
}
