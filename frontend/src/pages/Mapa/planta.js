// Montagem da planta do Mapa a partir da API.
// As posições (GET /locations), os produtos guardados nelas (GET /products) e as divergências
// abertas (GET /scan-events?open=1) viram a lista de posições desenhada pela PlantaArmazem.

import { codigoPosicao } from '../../utils/rotaApi'

export const faixasOcupacao = [
  { id: 'vazia', nome: 'Sem produto' },
  { id: 'cheia', nome: 'Com produto' },
  { id: 'divergencia', nome: 'Divergência' },
]

// Corredores em ordem alfabética e onde termina o primeiro bloco de prateleiras
// (posições da prateleira 1 em cima, as demais embaixo, depois do corredor transversal).
export function montarPlanta(locations) {
  const corredores = [...new Set(locations.map((l) => l.aisle?.code).filter(Boolean))].sort()
  const daPrateleira1 = locations.filter((l) => l.shelf === '1').map((l) => Number(l.position))
  const limiteBloco = daPrateleira1.length ? Math.max(...daPrateleira1) : 10
  return { corredores, limiteBloco }
}

export function montarPosicoes(locations, produtos, divergencias, planta, config) {
  const produtosPorPosicao = new Map()
  for (const produto of produtos) {
    if (!produto.location_id) continue
    const lista = produtosPorPosicao.get(produto.location_id) ?? []
    lista.push({ id: produto.id, nome: produto.name, sku: produto.sku, lote: produto.batch_code })
    produtosPorPosicao.set(produto.location_id, lista)
  }

  const divergenciaPorPosicao = new Map()
  for (const d of divergencias) {
    if (d.location_id && !divergenciaPorPosicao.has(d.location_id)) divergenciaPorPosicao.set(d.location_id, d)
  }

  const alturaNivel = Number(config?.level_height_m) || 0

  return locations
    .filter((l) => l.aisle?.code)
    .map((l) => {
      const lista = produtosPorPosicao.get(l.id) ?? []
      const divergencia = divergenciaPorPosicao.get(l.id) ?? null
      const altura = Number(l.coord_z ?? 0)

      return {
        id: l.id,
        codigo: codigoPosicao(l),
        letra: l.aisle.code,
        corredor: planta.corredores.indexOf(l.aisle.code),
        posicao: Number(l.position),
        ocupada: lista.length > 0,
        faixa: divergencia ? 'divergencia' : lista.length > 0 ? 'cheia' : 'vazia',
        divergencia,
        nivel: alturaNivel > 0 ? Math.max(1, Math.round(altura / alturaNivel)) : null,
        altura,
        ponto: { x: Number(l.coord_x ?? 0), y: Number(l.coord_y ?? 0) },
        produtos: lista,
      }
    })
}

// Cor da linha e do marcador de cada coletor no mapa, pela ordem na lista.
const cores = ['#ffd600', '#e5484d', '#2fbf62', '#49509b', '#f08c2e', '#3aa0e8', '#b05ad8', '#8a6d00']

export function corDoColetor(indice) {
  return cores[indice % cores.length]
}
