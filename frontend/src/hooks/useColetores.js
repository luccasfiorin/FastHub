import { useEffect, useState } from 'react'
import { buscarRanking, listarColetores } from '../services/api'

// Carrega os coletores (cards, contagens, indicadores e alertas) e atualiza sozinho a cada 30 s.
// Devolve também `recarregar`, para a página buscar de novo depois de cadastrar, editar ou excluir.
export function useColetores() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    function buscar() {
      listarColetores()
        .then((resposta) => {
          setDados(resposta)
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

  // Mudar `versao` faz o useEffect rodar de novo e buscar os dados.
  function recarregar() {
    setVersao(versao + 1)
  }

  return { dados, carregando, erro, recarregar }
}

// Busca o ranking do período escolhido. Busca de novo quando o período ou os coletores mudam.
export function useRanking(periodo, coletores) {
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    buscarRanking(periodo)
      .then((resposta) => {
        setLinhas(resposta.ranking)
        setErro('')
      })
      .catch((e) => setErro(e.message))
  }, [periodo, coletores])

  return { linhas, erro }
}
