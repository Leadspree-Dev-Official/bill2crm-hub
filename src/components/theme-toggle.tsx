import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle colour theme"
        className={cn('size-8 text-muted-foreground hover:text-foreground', className)}
      >
        <span className="size-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'size-8 text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors',
        className,
      )}
    >
      {isDark ? (
        <Sun className="size-4 text-amber-400 transition-transform rotate-0 scale-100" />
      ) : (
        <Moon className="size-4 text-slate-700 transition-transform rotate-0 scale-100" />
      )}
    </Button>
  )
}

