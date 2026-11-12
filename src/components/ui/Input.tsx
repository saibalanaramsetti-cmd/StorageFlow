import { ReactNode, InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
  className?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full rounded-xl border text-sm px-3.5 py-2 outline-none transition-all placeholder:text-gray-500 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 ${
              icon ? 'pl-9' : ''
            } ${className}`}
            style={{
              background: 'var(--bg-secondary)',
              borderColor: error ? '#ef4444' : 'rgba(128, 128, 128, 0.2)',
              color: 'var(--text-primary)',
            }}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'

