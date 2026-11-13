import { useEffect, useState } from 'react'
import { listarPedidos, listarPosicoes } from '../services/api'
import { atualizarPeriodicamente } from '../utils/atualizacao'

// Carrega os pedidos e as posições do armazém (para desenhar a planta) e atualiza a cada 5 s,
// só enquanto a aba está visível. Devolve também `recarregar`, para buscar de novo na hora
// (ex.: depois de um erro ou de mudar o status de um pedido).
export function usePedidos() {
  const [pedidos, setPedidos] = useState(null)
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    function buscar() {
      // as posições só servem para o desenho: se falharem, a tela continua com os pedidos
      const posicoesBuscadas = listarPosicoes()
        .then((lista) => ativo && setPosicoes(lista))
        .catch(() => ativo && setPosicoes([]))

      const pedidosBuscados = listarPedidos()
        .then((resposta) => {
          if (!ativo) return
          setPedidos(resposta)
          setErro('')
        })
        .catch((e) => ativo && setErro(e.message))
        .finally(() => ativo && setCarregando(false))

      return Promise.all([posicoesBuscadas, pedidosBuscados])
    }

    const desligar = atualizarPeriodicamente(buscar)

    // quando a tela fecha (ou `versao` muda), para o relógio antigo e ignora respostas atrasadas
    return () => {
      ativo = false
      desligar()
    }
  }, [versao])

  function recarregar() {
    setVersao(versao + 1)
  }

  return { pedidos: pedidos ?? [], posicoes, carregando, erro, recarregar }
}
