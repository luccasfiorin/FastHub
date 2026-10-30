import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Coletores from './pages/Coletores/Coletores'
import { buscarUsuario, lerToken, sair } from './services/api'

function App() {
  const [usuario, setUsuario] = useState(null)
  const [verificando, setVerificando] = useState(Boolean(lerToken()))
  const [pagina, setPagina] = useState('inicio')

  const sairDoSistema = useCallback(async () => {
    await sair()
    setUsuario(null)
    setPagina('inicio')
  }, [])

  // Recarregou a página com token salvo: confirma a sessão na API.
  useEffect(() => {
    if (!lerToken()) return
    buscarUsuario()
      .then((dados) => setUsuario(dados.role === 'manager' ? dados : null))
      .catch(() => setUsuario(null))
      .finally(() => setVerificando(false))
  }, [])

  // Token vencido ou revogado durante o uso.
  useEffect(() => {
    const expirou = () => setUsuario(null)
    window.addEventListener('fasthub:sessao-expirada', expirou)
    return () => window.removeEventListener('fasthub:sessao-expirada', expirou)
  }, [])

  if (verificando) return null

  if (!usuario) {
    return <Login onEntrar={setUsuario} />
  }

  if (pagina === 'coletores') {
    return <Coletores usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  return <Dashboard onNavegar={setPagina} onSair={sairDoSistema} />
}

export default App
