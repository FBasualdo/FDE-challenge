'use client'

import { Monitor, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from './ThemeProvider'

const OPTIONS: { value: ThemeMode; label: string; Icon: typeof Monitor }[] = [
  { value: 'system', label: 'Sistema', Icon: Monitor },
  { value: 'light',  label: 'Claro',   Icon: Sun },
  { value: 'dark',   label: 'Oscuro',  Icon: Moon },
]

function CurrentIcon({ theme }: { theme: ThemeMode }) {
  const option = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0]!
  return <option.Icon aria-hidden="true" />
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tema"
        >
          <CurrentIcon theme={theme} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {OPTIONS.map(({ value, label, Icon }) => {
          const isActive = theme === value
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => setTheme(value)}
              className={cn(isActive && 'text-accent')}
            >
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
