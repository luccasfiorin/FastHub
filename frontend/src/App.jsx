import { useState } from 'react'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  const [logado, setLogado] = useState(false)

  if (logado) {
    return <Dashboard onSair={() => setLogado(false)} />
  }

  return <Login onEntrar={() => setLogado(true)} />
}

export default App
