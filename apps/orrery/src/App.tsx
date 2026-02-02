import './App.css'
import { SceneCanvas } from './SceneCanvas'

function App() {
  return (
    <div className="app">
      {/* Visually-hidden heading for e2e smoke + accessibility. */}
      <h1 className="sr-only">Orrery</h1>
      <main className="main">
        <SceneCanvas />
      </main>
    </div>
  )
}

export default App
