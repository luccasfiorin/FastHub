// Dados fictícios para montar a tela enquanto a API do Laravel não está pronta.
// Quando o backend tiver as rotas, é só trocar estes arrays pelas respostas da API.

export const menu = [
  { id: 'inicio', nome: 'Início' },
  { id: 'pedidos', nome: 'Pedidos', contador: 23 },
  { id: 'mapa', nome: 'Mapa do armazém' },
  { id: 'rotas', nome: 'Rotas' },
  { id: 'coletores', nome: 'Coletores' },
  { id: 'relatorios', nome: 'Relatórios' },
  { id: 'erp', nome: 'Integração ERP' },
]

export const indicadores = [
  {
    titulo: 'Pedidos hoje',
    icone: 'caixa',
    valor: '128',
    detalhe: '+12% vs ontem',
    positivo: true,
  },
  { titulo: 'Em andamento', icone: 'andamento', valor: '23', detalhe: '6 coletores ativos' },
  {
    titulo: 'Pick rate',
    icone: 'relogio',
    valor: '42 s/item',
    detalhe: '−8 s com rota otimizada',
    positivo: true,
  },
  {
    titulo: 'Acurácia',
    icone: 'alvo',
    valor: '99,9%',
    detalhe: '2 erros evitados na bipagem',
    positivo: true,
    destaque: true,
  },
]

// Pontos de coleta no mapa (coordenadas do SVG do MapaArmazem).
// O primeiro ponto é sempre a doca.
export const rotas = {
  r1: [
    [16, 246],
    [80, 222],
    [80, 150],
    [145, 130],
    [145, 48],
    [210, 30],
    [210, 86],
    [275, 160],
    [275, 222],
  ],
  r2: [
    [16, 246],
    [80, 200],
    [80, 60],
    [145, 40],
    [210, 130],
    [275, 70],
  ],
  r3: [
    [16, 246],
    [80, 222],
    [145, 170],
    [210, 130],
    [210, 60],
    [275, 40],
    [275, 110],
  ],
}

export const pedidos = [
  {
    numero: '#4821',
    coletor: 'Carlos M.',
    tipo: 'pessoa',
    itens: 18,
    progresso: 100,
    status: 'concluido',
    eta: '—',
    rota: 'r2',
  },
  {
    numero: '#4822',
    coletor: 'Ana P.',
    tipo: 'pessoa',
    itens: 32,
    progresso: 70,
    status: 'andamento',
    eta: '6 min',
    rota: 'r1',
  },
  {
    numero: '#4823',
    coletor: 'João R.',
    tipo: 'pessoa',
    itens: 12,
    progresso: 45,
    status: 'andamento',
    eta: '9 min',
    rota: 'r3',
  },
  {
    numero: '#4824',
    coletor: 'Empilhadeira 02',
    tipo: 'empilhadeira',
    itens: 7,
    progresso: 20,
    status: 'aguardando',
    eta: '14 min',
    rota: 'r2',
  },
  {
    numero: '#4825',
    coletor: 'Bruna S.',
    tipo: 'pessoa',
    itens: 25,
    progresso: 0,
    status: 'iniciado',
    eta: '18 min',
    rota: 'r3',
  },
  {
    numero: '#4826',
    coletor: 'Pedro L.',
    tipo: 'pessoa',
    itens: 9,
    progresso: 85,
    status: 'andamento',
    eta: '2 min',
    rota: 'r1',
  },
]

export const nomesStatus = {
  concluido: 'Concluído',
  andamento: 'Em andamento',
  aguardando: 'Aguardando',
  iniciado: 'Iniciado',
}

export const filtros = [
  { id: 'todos', nome: 'Todos' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'aguardando', nome: 'Aguardando' },
  { id: 'concluido', nome: 'Concluídos' },
]

export const pedidosPorHora = [
  { hora: '08h', total: 9 },
  { hora: '09h', total: 14 },
  { hora: '10h', total: 18 },
  { hora: '11h', total: 16 },
  { hora: '12h', total: 8 },
  { hora: '13h', total: 11 },
  { hora: '14h', total: 19 },
  { hora: '15h', total: 21 },
  { hora: '16h', total: 12 },
]

export const coletores = [
  { nome: 'Ana P.', tipo: 'pessoa', estado: 'ativo', itensHora: 86 },
  { nome: 'Pedro L.', tipo: 'pessoa', estado: 'ativo', itensHora: 81 },
  { nome: 'João R.', tipo: 'pessoa', estado: 'ativo', itensHora: 74 },
  { nome: 'Empilhadeira 02', tipo: 'empilhadeira', estado: 'pausa', itensHora: 22 },
  { nome: 'Bruna S.', tipo: 'pessoa', estado: 'ativo', itensHora: 0 },
  { nome: 'Carlos M.', tipo: 'pessoa', estado: 'offline', itensHora: 69 },
]

export const nomesEstado = {
  ativo: 'Ativo',
  pausa: 'Em pausa',
  offline: 'Offline',
}

export const alertas = [
  { tipo: 'erro', texto: 'Divergência de lote no pedido #4823', tempo: 'há 3 min' },
  { tipo: 'aviso', texto: 'Empilhadeira 02 aguardando liberação', tempo: 'há 8 min' },
  { tipo: 'info', texto: '12 pedidos importados do ERP', tempo: 'há 25 min' },
]

// Eficiência de rota: % de distância economizada em relação ao roteiro por lista de papel.
// Fica null até o backend calcular com os pedidos reais; enquanto isso o card mostra "sem dados".
// Formato esperado quando vier da API: { reducao: 31 }
export const eficienciaRota = null
