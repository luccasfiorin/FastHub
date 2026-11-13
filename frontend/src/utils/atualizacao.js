// Atualização automática das telas (Início, Pedidos e Mapa).
//
// - Busca na hora e depois a cada `intervalo` ms.
// - Com a aba escondida (outra aba aberta, janela minimizada), para de buscar;
//   quando a aba volta a ficar visível, busca na hora e retoma o intervalo.
// - Se uma busca ainda não terminou, a próxima é pulada, para não empilhar requisições.
//
// `buscar` pode devolver uma Promise; os erros devem ser tratados dentro dela.
// Devolve a função que desliga tudo (para usar no retorno do useEffect).

export const INTERVALO_ATUALIZACAO = 5000

export function atualizarPeriodicamente(buscar, intervalo = INTERVALO_ATUALIZACAO) {
  let timer = null
  let buscando = false

  async function rodada() {
    if (buscando) return
    buscando = true
    try {
      await buscar()
    } catch {
      // cada tela mostra o próprio erro; aqui só garante que o relógio continua
    } finally {
      buscando = false
    }
  }

  function ligar() {
    if (timer === null) timer = setInterval(rodada, intervalo)
  }

  function desligar() {
    clearInterval(timer)
    timer = null
  }

  function aoMudarVisibilidade() {
    if (document.visibilityState === 'visible') {
      rodada()
      ligar()
    } else {
      desligar()
    }
  }

  rodada()
  if (document.visibilityState === 'visible') ligar()
  document.addEventListener('visibilitychange', aoMudarVisibilidade)

  return () => {
    desligar()
    document.removeEventListener('visibilitychange', aoMudarVisibilidade)
  }
}
