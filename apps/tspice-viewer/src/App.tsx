import './App.css'
import { SceneCanvas } from './SceneCanvas'

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>tspice viewer</h1>
      </header>
      <main className="main">
        <SceneCanvas />
      </main>
    </div>
  )
}

export default App
