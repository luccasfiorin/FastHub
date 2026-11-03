// Cálculo da rota de coleta pelo algoritmo do vizinho mais próximo.
//
// Cada parada é um ponto { x, y } com as coordenadas da posição cadastrada no armazém
// (coord_x e coord_y da tabela locations, em metros).
// O coletor anda pelos corredores, então a distância entre dois pontos é a soma do
// deslocamento na horizontal e na vertical (não a linha reta).

// A doca ainda não existe no banco: por enquanto fica na origem (0, 0) da planta.
export const DOCA = { x: 0, y: 0 }

export function distancia(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
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
