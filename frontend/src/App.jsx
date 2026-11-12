import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import Coletores from './pages/Coletores/Coletores'
import Pedidos from './pages/Pedidos/Pedidos'
import Mapa from './pages/Mapa/Mapa'
import Relatorios from './pages/Relatorios/Relatorios'
import Configuracoes from './pages/Configuracoes/Configuracoes'
import AreaColetor from './pages/Coletor/AreaColetor'
import { buscarUsuario, lerToken, sair } from './services/api'

// Perfis que entram no sistema: o gestor usa o painel completo e o coletor, a tela dele.
const perfisComAcesso = ['manager', 'picker']

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
      .then((dados) => setUsuario(perfisComAcesso.includes(dados.role) ? dados : null))
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

  // Coletor cai direto na tela dele, sem o menu do gestor.
  if (usuario.role === 'picker') {
    return <AreaColetor usuario={usuario} onSair={sairDoSistema} />
  }

  if (pagina === 'pedidos') {
    return <Pedidos usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  if (pagina === 'coletores') {
    return <Coletores usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  if (pagina === 'mapa') {
    return <Mapa usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  if (pagina === 'relatorios') {
    return <Relatorios usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  if (pagina === 'configuracoes') {
    return <Configuracoes usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
  }

  return <Dashboard usuario={usuario} onNavegar={setPagina} onSair={sairDoSistema} />
}

export default App
