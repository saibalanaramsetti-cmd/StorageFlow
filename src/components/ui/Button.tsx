import { motion } from 'framer-motion'
import React, { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps {
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
  icon?: ReactNode
  title?: string
}

const variants = {
  primary: 'text-white shadow-md shadow-blue-500/20 hover:brightness-110 font-semibold',
  secondary: 'text-gray-800 dark:text-gray-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 border border-black/10 dark:border-white/10',
  danger: 'text-white bg-red-600/90 hover:bg-red-500 shadow-md shadow-red-500/20',
  ghost: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5',
}

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg',
  md: 'px-3.5 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-base rounded-xl',
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  className = '',
  icon,
  title,
}: ButtonProps) {
  const bgStyle =
    variant === 'primary'
      ? { background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }
      : undefined

  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all ${variants[variant]} ${sizes[size]} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
      } ${className}`}
      style={bgStyle}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </motion.button>
  )
}

