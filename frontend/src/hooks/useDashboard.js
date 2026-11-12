import { useEffect, useState } from 'react'
import { buscarDashboard, listarColetores, listarPedidos, listarPosicoes } from '../services/api'

// Dados da tela Início: indicadores do dia (GET /dashboard), pedidos (GET /orders),
// coletores e alertas (GET /pickers) e as posições para desenhar a planta (GET /locations).
// Atualiza sozinho a cada 30 s.
export function useDashboard() {
  const [dados, setDados] = useState(null)
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    // a planta quase não muda: busca uma vez por montagem
    listarPosicoes()
      .then((lista) => ativo && setPosicoes(lista))
      .catch(() => ativo && setPosicoes([]))

    function buscar() {
      Promise.all([buscarDashboard(), listarPedidos(), listarColetores()])
        .then(([indicadores, pedidos, coletores]) => {
          if (!ativo) return
          setDados({ indicadores, pedidos, coletores })
          setErro('')
        })
        .catch((e) => ativo && setErro(e.message))
        .finally(() => ativo && setCarregando(false))
    }

    buscar()
    const timer = setInterval(buscar, 30000)

    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [versao])

  function recarregar() {
    setVersao((v) => v + 1)
  }

  return { dados, posicoes, carregando, erro, recarregar }
}
