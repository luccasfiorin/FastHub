// Conversões das respostas da API de rota (GET /orders/{id}/route) e de posições (GET /locations)
// para o formato que os mapas (MapaRota) e os painéis usam.

// "A" + prateleira "1" + posição "3" vira "A-1-3"
export function codigoPosicao(location) {
  if (!location) return '—'
  return [location.aisle?.code, location.shelf, location.position].filter(Boolean).join('-')
}

export function pontoDaPosicao(location) {
  return { x: Number(location?.coord_x ?? 0), y: Number(location?.coord_y ?? 0) }
}

// Posições do armazém para desenhar a planta.
export function posicoesDaApi(locations) {
  return locations.map((location) => ({
    id: location.id,
    codigo: codigoPosicao(location),
    corredor: location.aisle?.code ?? '',
    ponto: pontoDaPosicao(location),
  }))
}

// estimativa simples: 1 m/s andando + 20 s por item para pegar e bipar
export function estimarMinutos(metros, itens) {
  return Math.max(1, Math.round((metros + itens * 20) / 60))
}

// Converte uma rota da API (a pé ou de empilhadeira) para o formato que o painel e o mapa usam.
// Cada parada é uma posição; itens do pedido na mesma posição aparecem juntos.
function paradasDaApi(rota) {
  return rota.stops.map((stop) => ({
    id: stop.location_id,
    codigo: stop.code,
    produto: stop.items.map((item) => item.name ?? 'Produto sem nome').join(', '),
    quantidade: stop.items.reduce((soma, item) => soma + item.quantity, 0),
    coletada: stop.picked,
    coletadaEm: stop.picked_at,
    ponto: { x: Number(stop.point.x), y: Number(stop.point.y) },
  }))
}

// Converte a resposta de GET /orders/{id}/route. Os campos de topo são a rota a pé;
// `forklift_route` é a rota própria dos itens grandes (RN04), ou null se não houver.
export function rotaDaApi(resposta) {
  const paradas = paradasDaApi(resposta)
  const itensFaltando = paradas.filter((p) => !p.coletada).reduce((soma, p) => soma + p.quantidade, 0)

  let empilhadeira = null
  if (resposta.forklift_route) {
    empilhadeira = {
      paradas: paradasDaApi(resposta.forklift_route),
      feitas: resposta.forklift_route.picked_stops,
      metros: Math.round(resposta.forklift_route.total_distance_m),
    }
  }

  return {
    paradas,
    feitas: resposta.picked_stops,
    metros: Math.round(resposta.total_distance_m),
    minutosFaltando: estimarMinutos(resposta.remaining_distance_m, itensFaltando),
    doca: { x: Number(resposta.dock.x), y: Number(resposta.dock.y) },
    empilhadeira,
  }
}
