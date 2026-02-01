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
    [onClose],
  )

  if (!isOpen) return null

  return (
    <div className="helpBackdrop" onClick={handleBackdropClick} role="presentation">
      <div ref={dialogRef} className="helpDialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <div className="helpHeader">
          <h2 id="help-title" className="helpTitle">
            What is this?
          </h2>
          <button className="helpCloseButton" onClick={onClose} type="button" aria-label="Close help">
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
              , a TypeScript wrapper for NASA's SPICE toolkit. SPICE is the system NASA uses to calculate precise
              positions of planets, moons, and spacecraft.
            </p>
            <p>
              This viewer is a demo interface and testbed for the tspice library—it shows what's possible when you bring
              accurate space mission data to the web.
            </p>
          </section>

          <section className="helpSection">
            <h3 className="helpSectionTitle">Controls</h3>
            <div className="helpControls">
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Desktop camera</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>LMB drag:</strong> Orbit around target
                  </li>
                  <li>
                    <strong>RMB drag:</strong> Free-look (adjust view angle)
                  </li>
                  <li>
                    <strong>Shift+LMB / MMB:</strong> Pan
                  </li>
                  <li>
                    <strong>Shift+RMB drag:</strong> Roll (tilt camera)
                  </li>
                  <li>
                    <strong>Scroll wheel:</strong> Zoom in/out
                  </li>
                </ul>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Touch devices</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>1-finger drag:</strong> Orbit (default), Pan (with Pan toggle), or Free-look (with Look
                    toggle)
                  </li>
                  <li>
                    <strong>2-finger drag:</strong> Pan
                  </li>
                  <li>
                    <strong>Pinch:</strong> Zoom
                  </li>
                  <li>
                    <strong>2-finger twist:</strong> Roll (rotate view)
                  </li>
                </ul>
                <p>
                  Use the <strong>Look</strong> toggle to make 1-finger drag do free-look instead of orbit. Use the{' '}
                  <strong>Pan</strong> toggle to make 1-finger drag pan instead of orbit. Priority: Look &gt; Pan &gt;
                  Orbit.
                </p>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Selection</h4>
                <p>
                  Click or tap any planet to select it and center the view. Use the <strong>Focus</strong> dropdown to
                  jump to a specific body. Selection inspector is coming in a future update.
                </p>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Scaling tips</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>Sun size</strong> can help when focusing outer planets (keeps the Sun visible and easier to
                    spot at long distances).
                  </li>
                  <li>
                    <strong>Planet size</strong> can help when focusing the Sun (makes nearby planets big enough to
                    click).
                  </li>
                </ul>
                <p>
                  These sliders only affect how bodies are rendered—they don't change the underlying SPICE positions.
                </p>
              </div>
            </div>
          </section>

          <section className="helpSection">
            <h3 className="helpSectionTitle">Keyboard shortcuts</h3>
            <div className="helpControls">
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">UI</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>?:</strong> Toggle help
                  </li>
                </ul>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Camera</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>Arrow keys:</strong> Orbit (yaw/pitch)
                  </li>
                  <li>
                    <strong>Shift + Arrow keys:</strong> Pan
                  </li>
                  <li>
                    <strong>W / A / S / D:</strong> Pan (alternate)
                  </li>
                  <li>
                    <strong>+ / − (or =):</strong> Zoom in/out
                  </li>
                  <li>
                    <strong>Q / E:</strong> Roll left/right
                  </li>
                  <li>
                    <strong>F or C:</strong> Focus/center view
                  </li>
                  <li>
                    <strong>Esc:</strong> Recenter view (reset look offset)
                  </li>
                  <li>
                    <strong>R or Home:</strong> Reset view
                  </li>
                  <li>
                    <strong>L:</strong> Toggle body labels
                  </li>
                </ul>
              </div>
              <div className="helpControlGroup">
                <h4 className="helpControlGroupTitle">Time</h4>
                <ul className="helpControlList">
                  <li>
                    <strong>Space:</strong> Play/pause
                  </li>
                  <li>
                    <strong>[ / ]:</strong> Step time backward/forward
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section className="helpSection">
            <h3 className="helpSectionTitle">Data &amp; limitations</h3>
            <p>
              This demo uses a bundled set of SPICE kernel data (ephemeris files). The available bodies and time ranges
              are limited to what's included in these pre-packaged kernels—you can't upload custom data or access the
              full SPICE catalog.
            </p>
            <p>
              For full flexibility with SPICE data, check out the{' '}
              <a href="https://github.com/rybosome/tspice" target="_blank" rel="noopener noreferrer">
                tspice library on GitHub
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
