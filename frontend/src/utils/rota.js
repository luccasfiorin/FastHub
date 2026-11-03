// Cálculo da rota de coleta pelo algoritmo do vizinho mais próximo.
//
// Como a planta é tratada:
// - cada corredor (A, B, C...) é uma coluna; o coletor anda pelo vão à direita da estante;
// - as posições 1 a 10 ficam no bloco de cima e as de 11 em diante no bloco de baixo;
// - entre os dois blocos existe um corredor transversal: para trocar de corredor,
//   o coletor sempre passa por ele.

export const PLANTA = {
  corredores: ['A', 'B', 'C', 'D', 'E'],
  posicoesPorCorredor: 19,
  transversal: 10.5, // fica entre a posição 10 e a 11
  metrosPorPosicao: 1.2,
  metrosEntreCorredores: 3,
}

// A doca fica à esquerda do corredor A, na parte de baixo.
export const DOCA = { corredor: -1, posicao: 19.5 }

// "B-14" vira { corredor: 1, posicao: 14 }
export function lerCodigoPosicao(codigo) {
  const [letra, numero] = codigo.split('-')
  return { corredor: PLANTA.corredores.indexOf(letra), posicao: Number(numero) }
}

export function distancia(a, b) {
  const { transversal, metrosPorPosicao, metrosEntreCorredores } = PLANTA
  if (a.corredor === b.corredor) {
    return Math.abs(a.posicao - b.posicao) * metrosPorPosicao
  }
  const ateTransversal = Math.abs(a.posicao - transversal) + Math.abs(b.posicao - transversal)
  return ateTransversal * metrosPorPosicao + Math.abs(a.corredor - b.corredor) * metrosEntreCorredores
}

// Recebe as paradas de um pedido e devolve na ordem em que o coletor deve passar.
// - As já coletadas ficam primeiro, na ordem em que foram coletadas (picked_at).
// - As que faltam são ordenadas pelo vizinho mais próximo, a partir da última coletada
//   (ou da doca, se o pedido ainda não começou).
// - A rota termina voltando para a doca.
export function calcularRota(paradas) {
  const feitas = paradas
    .filter((p) => p.coletada)
    .sort((a, b) => new Date(a.coletadaEm) - new Date(b.coletadaEm))
  const faltam = paradas.filter((p) => !p.coletada)

  let atual = feitas.length ? feitas[feitas.length - 1].ponto : DOCA
  const ordenadas = []

  while (faltam.length) {
    let indiceMaisPerto = 0
    for (let i = 1; i < faltam.length; i++) {
      if (distancia(atual, faltam[i].ponto) < distancia(atual, faltam[indiceMaisPerto].ponto)) {
        indiceMaisPerto = i
      }
    }
    const proxima = faltam.splice(indiceMaisPerto, 1)[0]
    ordenadas.push(proxima)
    atual = proxima.ponto
  }

  const ordem = [...feitas, ...ordenadas]

  let metros = 0
  let anterior = DOCA
  for (const parada of ordem) {
    metros += distancia(anterior, parada.ponto)
    anterior = parada.ponto
  }
  metros += distancia(anterior, DOCA)

  return { paradas: ordem, metros: Math.round(metros) }
}
