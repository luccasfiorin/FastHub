import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarRotaPedido, listarMeusPedidos, listarPosicoes } from '../services/api'

// Pedidos do coletor logado: os abertos (em andamento primeiro, depois a fila) e os concluídos,
// para os números do dia. Atualiza a cada 30 s, para pegar pedidos novos atribuídos pelo gestor.
// `recarregar` devolve uma promessa, para a tela esperar os dados novos (ex.: depois de bipar).
function buscarPedidosDoColetor() {
  return Promise.all([listarMeusPedidos(), listarMeusPedidos('completed')])
}

export function usePedidosColetor() {
  const [abertos, setAbertos] = useState(null)
  const [concluidos, setConcluidos] = useState([])
  const [erro, setErro] = useState('')

  const aplicar = useCallback(([listaAbertos, listaConcluidos]) => {
    setAbertos(listaAbertos)
    setConcluidos(listaConcluidos)
    setErro('')
  }, [])

  const recarregar = useCallback(
    () =>
      buscarPedidosDoColetor()
        .then(aplicar)
        .catch((e) => setErro(e.message)),
    [aplicar],
  )

  useEffect(() => {
    recarregar()
    const timer = setInterval(recarregar, 30000)
    return () => clearInterval(timer)
  }, [recarregar])

  return {
    abertos: abertos ?? [],
    concluidos,
    carregando: abertos === null && !erro,
    erro,
    recarregar,
  }
}

// Posições do armazém, só para desenhar a planta no mapa da rota.
export function usePosicoesArmazem() {
  const [posicoes, setPosicoes] = useState([])

  useEffect(() => {
    let ativo = true
    listarPosicoes()
      .then((lista) => {
        if (ativo) setPosicoes(lista)
      })
      .catch(() => {
        // sem posições o mapa mostra só a rota; a coleta continua funcionando
      })
    return () => {
      ativo = false
    }
  }, [])

  return posicoes
}

// Rota de coleta do pedido em andamento (GET /orders/{id}/route), calculada no backend.
// Buscada de novo quando o pedido muda e sempre que a tela chama `recarregar` (depois de cada bipagem).
export function useRotaColeta(pedidoId) {
  const [resposta, setResposta] = useState(null)
  const [erro, setErro] = useState('')
  // número da última busca: uma resposta antiga que chega atrasada não apaga a mais nova
  const ultimaBusca = useRef(0)

  const buscar = useCallback(() => {
    if (!pedidoId) return Promise.resolve()
    const busca = ++ultimaBusca.current
    return buscarRotaPedido(pedidoId)
      .then((dados) => {
        if (busca !== ultimaBusca.current) return
        setResposta(dados)
        setErro('')
      })
      .catch((e) => {
        if (busca === ultimaBusca.current) setErro(e.message)
      })
  }, [pedidoId])

  useEffect(() => {
    buscar()
  }, [buscar])

  const daRota = resposta && resposta.order_id === pedidoId ? resposta : null
  return { resposta: daRota, erro: daRota ? '' : erro, recarregar: buscar }
}
