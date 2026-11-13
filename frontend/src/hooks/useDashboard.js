import { useEffect, useState } from 'react'
import { buscarDashboard, listarColetores, listarPedidos, listarPosicoes } from '../services/api'
import { atualizarPeriodicamente } from '../utils/atualizacao'

// Dados da tela Início: indicadores do dia (GET /dashboard), pedidos (GET /orders),
// coletores e alertas (GET /pickers) e as posições para desenhar a planta (GET /locations).
// Atualiza sozinho a cada 5 s, só enquanto a aba está visível.
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
      return Promise.all([buscarDashboard(), listarPedidos(), listarColetores()])
        .then(([indicadores, pedidos, coletores]) => {
          if (!ativo) return
          setDados({ indicadores, pedidos, coletores })
          setErro('')
        })
        .catch((e) => ativo && setErro(e.message))
        .finally(() => ativo && setCarregando(false))
    }

    const desligar = atualizarPeriodicamente(buscar)

    return () => {
      ativo = false
      desligar()
    }
  }, [versao])

  function recarregar() {
    setVersao((v) => v + 1)
  }

  return { dados, posicoes, carregando, erro, recarregar }
}
