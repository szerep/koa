import { Koala } from '../../features/koala/Koala'
import './coming-soon.css'

interface ComingSoonScreenProps {
  title: string
  message: string
}

/** A designed resting state for sections that arrive in later phases. */
export function ComingSoonScreen({ title, message }: ComingSoonScreenProps) {
  return (
    <section className="soon" aria-labelledby="soon-title">
      <div className="soon__figure">
        <Koala width="clamp(140px, 36vw, 180px)" figureSizes="160px" />
      </div>
      <h1 id="soon-title" className="soon__title">
        {title}
      </h1>
      <p className="soon__message">{message}</p>
    </section>
  )
}

export function StatsScreen() {
  return (
    <ComingSoonScreen
      title="Your study journal"
      message="Finish focus sessions and your study time, streak and weekly progress will show up here."
    />
  )
}

export function SettingsScreen() {
  return (
    <ComingSoonScreen
      title="Settings"
      message="Timer lengths, your daily goal, sounds and notifications will live here."
    />
  )
}
