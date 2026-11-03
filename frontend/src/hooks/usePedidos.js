import { useEffect, useState } from 'react'
import { listarPedidos, listarPosicoes } from '../services/api'

// Carrega os pedidos e as posições do armazém (para desenhar a planta) e atualiza a cada 30 s.
// Devolve também `recarregar`, para buscar de novo na hora (ex.: depois de um erro).
export function usePedidos() {
  const [pedidos, setPedidos] = useState(null)
  const [posicoes, setPosicoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    function buscar() {
      // as posições só servem para o desenho: se falharem, a tela continua com os pedidos
      listarPosicoes()
        .then(setPosicoes)
        .catch(() => setPosicoes([]))

      listarPedidos()
        .then((resposta) => {
          setPedidos(resposta)
          setErro('')
        })
        .catch((e) => setErro(e.message))
        .finally(() => setCarregando(false))
    }

    buscar()
    const timer = setInterval(buscar, 30000)

    // quando a tela fecha (ou `versao` muda), para o relógio antigo
    return () => clearInterval(timer)
  }, [versao])

  function recarregar() {
    setVersao(versao + 1)
  }

  return { pedidos: pedidos ?? [], posicoes, carregando, erro, recarregar }
}
