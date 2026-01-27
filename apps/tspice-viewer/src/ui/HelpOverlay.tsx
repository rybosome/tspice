import { useCallback, useEffect, useRef } from 'react'

export interface HelpOverlayProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap and auto-focus on open
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return

    const closeButton = dialogRef.current.querySelector<HTMLButtonElement>('.helpCloseButton')
    closeButton?.focus()
  }, [isOpen])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  return (
    <div
      className="helpBackdrop"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="helpDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="helpHeader">
          <h2 id="help-title" className="helpTitle">What is this?</h2>
          <button
            className="helpCloseButton"
            onClick={onClose}
            type="button"
            aria-label="Close help"
          >
            ×
          </button>
        </div>

        <div className="helpContent">
          <section className="helpSection">
            <h3 className="helpSectionTitle">About tspice viewer</h3>
            <p>
              This is a 3D solar system visualization tool built with{' '}
              <a href="https://github.com/rybosome/tspice" target="_blank" rel="noopener noreferrer">
                tspice
              </a>
              , a TypeScript wrapper for NASA's SPICE toolkit. SPICE is the system NASA uses to
              calculate precise positions of planets, moons, and spacecraft.
            </p>
            <p>
              This viewer is a demo interface and testbed for the tspice library—it shows what's
              possible when you bring accurate space mission data to the web.
            </p>
          </section>

          <section className="helpSection">
            <h3 className="helpSectionTitle">Controls</h3>
            <div className="helpControls">
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Camera</h4>
                <ul className="helpControlList">
                  <li><strong>Orbit:</strong> Click and drag (or 1-finger drag when in Orbit mode)</li>
                  <li><strong>Pan:</strong> Right-click and drag, Shift+drag, or 2-finger drag</li>
                  <li><strong>Zoom:</strong> Scroll wheel, pinch gesture, or use the +/− buttons</li>
                </ul>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Touch devices</h4>
                <p>
                  Use the <strong>Drag: Pan/Orbit</strong> toggle to switch whether single-finger
                  drag orbits the camera or pans it. Two-finger drag always pans.
                </p>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Selection</h4>
                <p>
                  Click or tap any planet to select it and center the view. Use the <strong>Focus</strong>{' '}
                  dropdown to jump to a specific body.
                </p>
              </div>
            </div>
          </section>

          <section className="helpSection">
            <h3 className="helpSectionTitle">Data &amp; limitations</h3>
            <p>
              This demo uses a bundled set of SPICE kernel data (ephemeris files). The available
              bodies and time ranges are limited to what's included in these pre-packaged kernels—you
              can't upload custom data or access the full SPICE catalog.
            </p>
            <p>
              For full flexibility with SPICE data, check out the{' '}
              <a href="https://github.com/rybosome/tspice" target="_blank" rel="noopener noreferrer">
                tspice library on GitHub
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
