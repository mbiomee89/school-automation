import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from './utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  maxWidthClassName?: string
}

/**
 * Canonical accessible dialog primitive shared by every section (create/edit
 * forms, delete/confirm dialogs, reject-note prompts, attachment lightbox).
 *
 * Built directly on `@radix-ui/react-dialog` (already a project dependency)
 * rather than the Design OS app's own themed `src/components/ui/dialog.tsx`,
 * so this stays a self-contained, portable piece of the exported product —
 * it doesn't pull in Design OS's own CSS variables/theme.
 *
 * Radix gives us, for free: focus trap, Escape-to-close, return focus to the
 * triggering element on close, and body scroll lock while open.
 *
 * `school-administration/components/Modal.tsx` and
 * `counselor-review/components/Modal.tsx` are thin re-exports of this file —
 * see the comment in each for why they were kept as separate files.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClassName = 'max-w-md',
}: ModalProps) {
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
            'fixed inset-0 z-50 bg-slate-900/50 print:hidden',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
            'motion-reduce:animate-none'
          )}
        />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            // Let the dialog itself receive focus first instead of an inner input,
            // so screen reader users hear the title before landing in a field.
            const target = e.currentTarget as HTMLElement
            if (!target.hasAttribute('tabindex')) {
              e.preventDefault()
              target.focus()
            }
          }}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.16)] outline-none dark:bg-slate-800',
            'sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-1/2 sm:max-h-[85vh] sm:-translate-y-1/2 sm:rounded-2xl',
            'ltr:sm:translate-x-[-50%] rtl:sm:translate-x-[50%]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150',
            'motion-reduce:transition-none motion-reduce:animate-none print:hidden',
            maxWidthClassName
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="إغلاق"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default Modal
