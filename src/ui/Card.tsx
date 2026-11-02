import type { HTMLAttributes } from 'react'
import './card.css'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card${className ? ` ${className}` : ''}`} {...rest} />
}
