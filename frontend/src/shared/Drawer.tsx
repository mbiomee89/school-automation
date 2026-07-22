import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from './utils'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Visually-hidden accessible name when no visible heading is rendered inside children. */
  title: string
  children: ReactNode
  widthClassName?: string
  /** Extra classes merged in last (e.g. to override the default white surface for a dark-themed drawer). */
  className?: string
}

/**
 * Shared inline-start-anchored panel (mobile nav drawer, student detail
 * panel, etc). Built on `@radix-ui/react-dialog` for the same reasons as
 * `Modal` — focus trap, Escape-to-close, scroll lock, and focus return come
 * for free instead of being re-implemented per section.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  widthClassName = 'max-w-md',
  className,
}: DrawerProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-40 bg-slate-900/50 print:hidden',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
            'motion-reduce:animate-none'
          )}
        />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 start-0 z-50 flex h-full w-full flex-col border-e border-slate-200 bg-white shadow-xl outline-none dark:border-slate-700 dark:bg-slate-800 print:hidden',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
            'motion-reduce:transition-none motion-reduce:animate-none',
            widthClassName,
            className
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Drawer
