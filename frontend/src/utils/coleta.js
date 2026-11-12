// Regras da tela do coletor: ordem das paradas, próxima parada e progresso do pedido.
// Tudo é montado a partir das respostas da API (GET /picker/orders e GET /orders/{id}/route).

// Números puros ganham "#" na frente (#4822); códigos como ORD-AB12CD ficam como estão.
export function numeroPedido(pedido) {
  const numero = String(pedido?.order_number ?? '')
  return /^\d+$/.test(numero) ? `#${numero}` : numero
}

export function primeiroNome(nome) {
  return (nome ?? '').trim().split(/\s+/)[0] ?? ''
}

// Unidades do pedido (vem com `progress` do GET /picker/orders; se não vier, soma os itens).
export function progressoPedido(pedido) {
  if (pedido?.progress) {
    return {
      coletados: pedido.progress.picked,
      total: pedido.progress.total,
      percentual: pedido.progress.percent,
      itensFaltando: pedido.progress.pending_items,
    }
  }
  const itens = pedido?.items ?? []
  const total = itens.reduce((soma, item) => soma + item.quantity, 0)
  const coletados = itens.reduce((soma, item) => soma + Math.min(item.picked_quantity, item.quantity), 0)
  return {
    coletados,
    total,
    percentual: total ? Math.round((coletados / total) * 100) : 0,
    itensFaltando: itens.filter((item) => !item.is_picked).length,
  }
}

// Corredores por onde o pedido passa, ex.: "A, C e E".
export function corredoresDoPedido(pedido) {
  const codigos = [...new Set((pedido?.items ?? []).map((item) => item.location?.aisle?.code).filter(Boolean))].sort()
  if (codigos.length <= 1) return codigos.join('')
  return `${codigos.slice(0, -1).join(', ')} e ${codigos[codigos.length - 1]}`
}

function itemDaRota(item, codigosDeBarras) {
  const coletados = Math.min(item.picked_quantity, item.quantity)
  return {
    id: item.order_item_id,
    nome: item.name ?? 'Produto sem nome',
    sku: item.sku,
    quantidade: item.quantity,
    coletados,
    faltam: item.quantity - coletados,
    coletado: item.is_picked,
    codigoBarras: codigosDeBarras.get(item.order_item_id) ?? null,
  }
}

function paradasDaRota(rota, empilhadeira, codigosDeBarras) {
  return (rota?.stops ?? []).map((stop) => ({
    chave: `${empilhadeira ? 'E' : 'P'}${stop.location_id}`,
    codigo: stop.code,
    corredor: stop.aisle,
    coletada: stop.picked,
    empilhadeira,
    itens: stop.items.map((item) => itemDaRota(item, codigosDeBarras)),
  }))
}

// Monta a coleta do pedido em andamento.
// - `resposta`: GET /orders/{id}/route (rota a pé nos campos de topo e forklift_route para itens grandes).
// - `pedido`: o mesmo pedido vindo do GET /picker/orders, que traz o barcode_primary de cada produto.
// - `tipoColetor`: 'forklift' faz a rota da empilhadeira vir primeiro; senão, a rota a pé vem primeiro.
// As paradas já vêm na ordem da rota (coletadas primeiro); a próxima é a primeira que falta.
export function montarColeta(resposta, pedido, tipoColetor) {
  const codigosDeBarras = new Map(
    (pedido?.items ?? []).map((item) => [item.id, item.product?.barcode_primary ?? null]),
  )

  const aPe = paradasDaRota(resposta, false, codigosDeBarras)
  const grandes = paradasDaRota(resposta.forklift_route, true, codigosDeBarras)
  const paradas = tipoColetor === 'forklift' ? [...grandes, ...aPe] : [...aPe, ...grandes]

  const semPosicao = (resposta.unlocated_items ?? []).map((item) => itemDaRota(item, codigosDeBarras))
  const todosItens = [...paradas.flatMap((p) => p.itens), ...semPosicao]

  const total = todosItens.reduce((soma, item) => soma + item.quantidade, 0)
  const coletados = todosItens.reduce((soma, item) => soma + item.coletados, 0)
  const proximaIndice = paradas.findIndex((p) => !p.coletada)

  return {
    paradas,
    proxima: proximaIndice >= 0 ? paradas[proximaIndice] : null,
    proximaNumero: proximaIndice + 1,
    feitas: paradas.filter((p) => p.coletada).length,
    semPosicao,
    pendentes: todosItens.filter((item) => !item.coletado),
    total,
    coletados,
    percentual: total ? Math.round((coletados / total) * 100) : 0,
    tudoColetado: todosItens.length > 0 && todosItens.every((item) => item.coletado),
  }
}

// Decide para qual item vai a bipagem do código lido.
// Primeiro procura entre os itens da próxima parada, depois entre os outros que faltam no pedido.
// Se nenhum produto tem esse código, a bipagem vai para o primeiro item da próxima parada:
// a API grava a divergência e responde 422.
export function itemParaBipar(coleta, codigoLido) {
  const daParada = (coleta.proxima?.itens ?? []).filter((item) => !item.coletado)
  const certo =
    daParada.find((item) => item.codigoBarras === codigoLido) ??
    coleta.pendentes.find((item) => item.codigoBarras === codigoLido)

  if (certo) {
    return { item: certo, confere: true, foraDaParada: !daParada.includes(certo) }
  }
  return { item: daParada[0] ?? coleta.pendentes[0] ?? null, confere: false, foraDaParada: false }
}

function mesmoDia(iso, dia) {
  if (!iso) return false
  const data = new Date(iso)
  return (
    data.getFullYear() === dia.getFullYear() && data.getMonth() === dia.getMonth() && data.getDate() === dia.getDate()
  )
}

// Números do dia do coletor, a partir dos pedidos concluídos (GET /picker/orders?status=completed)
// e do pedido em andamento.
export function resumoDoDia(concluidos, pedidoAtual, hoje = new Date()) {
  const deHoje = concluidos
    .filter((pedido) => mesmoDia(pedido.completed_at, hoje))
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  const unidadesConcluidas = deHoje.reduce((soma, pedido) => soma + progressoPedido(pedido).coletados, 0)
  const unidadesEmAndamento = pedidoAtual ? progressoPedido(pedidoAtual).coletados : 0

  const duracoes = deHoje
    .filter((pedido) => pedido.started_at)
    .map((pedido) => (new Date(pedido.completed_at) - new Date(pedido.started_at)) / 60000)
    .filter((minutos) => minutos >= 0)

  return {
    concluidosHoje: deHoje,
    unidadesHoje: unidadesConcluidas + unidadesEmAndamento,
    minutosMedios: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null,
  }
}

export function duracaoEmMinutos(inicio, fim) {
  if (!inicio || !fim) return null
  return Math.max(0, Math.round((new Date(fim) - new Date(inicio)) / 60000))
}
