import { useCallback, useEffect, useRef, type ReactNode } from 'react'

export interface InfoOverlayProps {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
}

/**
 * Simple modal used for small, touch-friendly "what does this setting do?" help.
 *
 * - Desktop: typically opened by clicking a small `?` button
 * - Mobile: tap-safe, bottom-sheet-ish via CSS
 */
export function InfoOverlay({ isOpen, title, children, onClose }: InfoOverlayProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus the close button on open
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return

    const closeButton = dialogRef.current.querySelector<HTMLButtonElement>('.infoCloseButton')
    closeButton?.focus()
  }, [isOpen])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (!isOpen) return null

  return (
    <div className="infoBackdrop" onClick={handleBackdropClick} role="presentation">
      <div ref={dialogRef} className="infoDialog" role="dialog" aria-modal="true" aria-labelledby="info-title">
        <div className="infoHeader">
          <h2 id="info-title" className="infoTitle">
            {title}
          </h2>
          <button className="infoCloseButton" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>
        <div className="infoContent">{children}</div>
      </div>
    </div>
  )
}
