import './App.css'
import { SceneCanvas } from './SceneCanvas'

function App() {
  return (
    <div className="app">
      <header className="appHeader">
        <h1 className="appHeading">tspice viewer</h1>
      </header>
      <main className="main">
        <SceneCanvas />
      </main>
    </div>
  )
}

export default App
