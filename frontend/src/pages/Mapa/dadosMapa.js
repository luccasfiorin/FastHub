// Dados de exemplo para a tela do Mapa do armazém.
// Quando a API tiver a ocupação das posições (GET /api/locations com estoque) e a posição de cada
// coletor, é só trocar `ocupacaoPorCorredor`, `produtosConhecidos` e `coletoresExemplo` pelas respostas.

// Planta desenhada no mapa: 1 estante por corredor, posições 1–10 no bloco de cima e 11–19 no de baixo.
export const PLANTA = {
  corredores: ['A', 'B', 'C', 'D', 'E'],
  posicoesPorCorredor: 19,
  metrosPorPosicao: 1.2,
  metrosEntreCorredores: 3,
}

// A doca fica à esquerda do corredor A, embaixo (é o ponto 0,0 do cálculo de rota).
export const DOCA_NA_PLANTA = { corredor: -1, posicao: 19.5 }

// "B-14" vira { corredor: 1, posicao: 14 }
export function lerCodigo(codigo) {
  const [letra, numero] = codigo.split('-')
  return { corredor: PLANTA.corredores.indexOf(letra), posicao: Number(numero) }
}

// Converte a posição da planta para metros, no mesmo formato { x, y } que utils/rota.js usa.
export function emMetros({ corredor, posicao }) {
  return {
    x: (corredor + 1) * PLANTA.metrosEntreCorredores,
    y: (DOCA_NA_PLANTA.posicao - posicao) * PLANTA.metrosPorPosicao,
  }
}

// Coletores com pedido aberto. `as` é o horário em que a parada foi coletada (vazio = falta).
const hoje = new Date().toISOString().slice(0, 10)
const parada = (codigo, produto, as = null) => ({
  codigo,
  produto,
  coletadaEm: as ? `${hoje}T${as}:00` : null,
})

export const coletoresExemplo = [
  {
    pedido: '4826',
    nome: 'Pedro L.',
    paradas: [
      parada('A-02', 'Copo térmico', '16:30'),
      parada('A-09', 'Kit talheres', '16:32'),
      parada('B-03', 'Pote de vidro', '16:35'),
      parada('B-11', 'Tábua de corte', '16:37'),
      parada('C-07', 'Escorredor de louça'),
      parada('D-05', 'Jarra de suco'),
    ],
  },
  {
    pedido: '4822',
    nome: 'Ana P.',
    paradas: [
      parada('A-03', 'Liquidificador', '16:24'),
      parada('A-07', 'Ventilador de mesa', '16:26'),
      parada('A-12', 'Ferro de passar', '16:29'),
      parada('B-02', 'Chaleira elétrica', '16:33'),
      parada('B-05', 'Sanduicheira', '16:35'),
      parada('B-09', 'Jogo de panelas', '16:38'),
      parada('B-14', 'Garrafa térmica', '16:42'),
      parada('C-04', 'Cafeteira'),
      parada('C-06', 'Torradeira'),
      parada('D-03', 'Batedeira'),
      parada('D-08', 'Secador de cabelo'),
      parada('E-02', 'Panela de pressão'),
    ],
  },
  {
    pedido: '4823',
    nome: 'João R.',
    paradas: [
      parada('A-05', 'Mixer de mão', '16:20'),
      parada('B-08', 'Forma de bolo', '16:23'),
      parada('B-14', 'Garrafa térmica'),
      parada('C-12', 'Assadeira'),
      parada('D-16', 'Panela elétrica'),
      parada('E-09', 'Fruteira'),
    ],
  },
  {
    pedido: '4824',
    nome: 'Empilhadeira 02',
    paradas: [
      parada('C-02', 'Geladeira compacta'),
      parada('D-11', 'Micro-ondas'),
      parada('E-17', 'Forno elétrico'),
    ],
  },
  {
    pedido: '4825',
    nome: 'Bruna S.',
    paradas: [
      parada('A-14', 'Cafeteira'),
      parada('B-06', 'Torradeira'),
      parada('C-10', 'Batedeira'),
      parada('D-02', 'Liquidificador'),
      parada('E-13', 'Sanduicheira'),
    ],
  },
]

export const AREA = 'Galpão 1 · Térreo'
export const NIVEIS_POR_ESTANTE = 4
export const ALTURA_POR_NIVEL = 0.6

// Ocupação (%) de cada posição, da 1 à 19. 0 = posição vazia.
const ocupacaoPorCorredor = {
  A: [35, 70, 0, 0, 45, 30, 0, 100, 80, 40, 50, 75, 65, 0, 25, 0, 80, 0, 70],
  B: [40, 0, 0, 95, 100, 0, 35, 90, 0, 50, 70, 45, 30, 92, 100, 40, 0, 55, 35],
  C: [0, 75, 50, 45, 0, 95, 0, 90, 40, 0, 65, 30, 80, 70, 0, 0, 45, 35, 0],
  D: [45, 70, 80, 100, 35, 50, 40, 30, 75, 45, 40, 50, 0, 75, 0, 30, 70, 95, 100],
  E: [95, 100, 80, 75, 65, 0, 40, 50, 0, 45, 70, 80, 35, 90, 0, 40, 75, 50, 0],
}

// Divergências de bipagem abertas (vão sair dos scan_events com divergência).
export const divergencias = [
  {
    codigo: 'B-14',
    pedido: '4823',
    coletor: 'João R.',
    texto: 'João R. bipou a garrafa térmica do lote 18, mas o pedido #4823 pede o lote 21.',
    registradaEm: '2026-11-03T16:47:00',
  },
]

// Produtos já conferidos em algumas posições (o resto é montado a partir dos pedidos).
const produtosConhecidos = {
  'B-14': [
    { nome: 'Garrafa térmica', lote: 21, quantidade: 38 },
    { nome: 'Jogo de panelas', lote: 22, quantidade: 12 },
    { nome: 'Jarra de vidro', lote: 19, quantidade: 7 },
  ],
}

const catalogo = [
  'Caixa de parafusos',
  'Pote hermético',
  'Jogo de copos',
  'Assadeira',
  'Porta-temperos',
  'Kit de facas',
  'Escorredor de massa',
  'Fruteira',
]

export const faixasOcupacao = [
  { id: 'vazia', nome: 'Vazia' },
  { id: 'baixa', nome: 'Até 55%' },
  { id: 'media', nome: 'Até 85%' },
  { id: 'cheia', nome: 'Cheia' },
  { id: 'divergencia', nome: 'Divergência' },
]

export function faixaDaOcupacao(ocupacao) {
  if (ocupacao === 0) return 'vazia'
  if (ocupacao <= 55) return 'baixa'
  if (ocupacao <= 85) return 'media'
  return 'cheia'
}

// número fixo a partir do código, para os dados de exemplo não mudarem a cada render
function numeroDoCodigo(codigo) {
  return [...codigo].reduce((soma, letra) => soma * 31 + letra.charCodeAt(0), 7)
}

function produtosDaPosicao(codigo, ocupacao) {
  if (ocupacao === 0) return []
  if (produtosConhecidos[codigo]) return produtosConhecidos[codigo]

  const semente = numeroDoCodigo(codigo)
  const nomes = new Set()
  for (const coletor of coletoresExemplo) {
    for (const p of coletor.paradas) {
      if (p.codigo === codigo) nomes.add(p.produto)
    }
  }
  if (nomes.size === 0) nomes.add(catalogo[semente % catalogo.length])

  return [...nomes].map((nome, i) => ({
    nome,
    lote: 12 + ((semente + i * 5) % 12),
    quantidade: Math.max(2, Math.round((ocupacao / 100) * (20 + (semente % 25)))),
  }))
}

function ultimoInventario(codigo) {
  const data = new Date()
  data.setDate(data.getDate() - (3 + (numeroDoCodigo(codigo) % 20)))
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Lista com todas as posições da planta, já com os detalhes usados no painel lateral.
export const posicoes = PLANTA.corredores.flatMap((letra, corredor) =>
  ocupacaoPorCorredor[letra].map((ocupacao, i) => {
    const posicao = i + 1
    const codigo = `${letra}-${String(posicao).padStart(2, '0')}`
    const nivel = ((posicao - 1) % NIVEIS_POR_ESTANTE) + 1
    const divergencia = divergencias.find((d) => d.codigo === codigo) ?? null

    return {
      codigo,
      letra,
      corredor,
      posicao,
      ocupacao,
      faixa: divergencia ? 'divergencia' : faixaDaOcupacao(ocupacao),
      divergencia,
      nivel,
      altura: nivel * ALTURA_POR_NIVEL,
      ultimoInventario: ultimoInventario(codigo),
      produtos: produtosDaPosicao(codigo, ocupacao),
    }
  }),
)

// Cor da linha e do marcador de cada coletor no mapa.
const coresColetor = {
  'Ana P.': '#ffd600',
  'João R.': '#e5484d',
  'Pedro L.': '#2fbf62',
  'Empilhadeira 02': '#49509b',
  'Bruna S.': '#f08c2e',
}
const coresReserva = ['#3aa0e8', '#b05ad8', '#8a6d00']

export function corDoColetor(nome, indice) {
  return coresColetor[nome] ?? coresReserva[indice % coresReserva.length]
}
