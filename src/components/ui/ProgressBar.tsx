import { motion } from 'framer-motion'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = '#3b82f6',
  height = 6,
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percent = Math.min(Math.max(max > 0 ? (value / max) * 100 : 0, 0), 100)

  return (
    <div className={`relative ${className}`}>
      <div className="w-full rounded-full overflow-hidden bg-white/10" style={{ height }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ background: `linear-gradient(90deg, ${color}cc, ${color})` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs mt-1 block" style={{ color: 'var(--text-muted)' }}>
          {percent.toFixed(1)}%
        </span>
      )}
    </div>
  )
}

