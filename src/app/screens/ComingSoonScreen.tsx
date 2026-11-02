import type { ReactNode } from 'react'
import { Koala } from '../../features/koala/Koala'
import './coming-soon.css'

interface ComingSoonScreenProps {
  title: string
  message: string
  /** An optional next step under the message, such as a button. */
  children?: ReactNode
}

/** A designed resting state with Koa: for empty screens and sections that arrive later. */
export function ComingSoonScreen({ title, message, children }: ComingSoonScreenProps) {
  return (
    <section className="soon" aria-labelledby="soon-title">
      <div className="soon__figure">
        <Koala width="clamp(140px, 36vw, 180px)" figureSizes="160px" />
      </div>
      <h1 id="soon-title" className="soon__title">
        {title}
      </h1>
      <p className="soon__message">{message}</p>
      {children && <div className="soon__action">{children}</div>}
    </section>
  )
}
