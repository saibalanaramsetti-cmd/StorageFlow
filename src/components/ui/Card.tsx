import { motion } from 'framer-motion'
import React, { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  style?: React.CSSProperties
}

export function Card({ children, className = '', onClick, hover = false, style }: CardProps) {
  return (
    <motion.div
      whileHover={hover ? { scale: 1.01, y: -2 } : {}}
      onClick={onClick}
      className={`glass-card p-4 transition-shadow ${hover ? 'cursor-pointer hover:shadow-lg hover:shadow-black/20' : ''} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  )
}

