// Dados de exemplo para a prévia da tela de Pedidos.
// O formato segue o que o OrderController devolve hoje (order + items.product + items.location + picker).
// Quando existir GET /api/orders, é só trocar esta lista pela resposta da API.
//
// Campos que ainda NÃO existem no banco e foram usados só na prévia:
// - customer_name (nome do cliente)
// - has_mismatch (vai sair dos scan_events com divergência)

const hoje = '2026-11-03'

// item('B-14', 'Garrafa térmica', 4, 4, '16:18') => item com 4 unidades, 4 coletadas às 16:18
function item(posicao, produto, quantidade, coletadas = 0, coletadoAs = null) {
  const [corredor, numero] = posicao.split('-')
  return {
    quantity: quantidade,
    picked_quantity: coletadas,
    is_picked: coletadas >= quantidade,
    picked_at: coletadoAs ? `${hoje}T${coletadoAs}:00` : null,
    product: { name: produto },
    location: { aisle: { code: corredor }, position: Number(numero) },
  }
}

function pedido(numero, dados) {
  return {
    id: Number(numero),
    order_number: numero,
    created_at: `${hoje}T${dados.criadoAs}:00`,
    requires_forklift: false,
    has_mismatch: false,
    picker: null,
    ...dados,
  }
}

export const pedidosExemplo = [
  pedido('4826', {
    customer_name: 'Loja Bela Vista',
    status: 'in_progress',
    criadoAs: '16:21',
    picker: { name: 'Pedro L.' },
    items: [
      item('A-02', 'Copo térmico', 2, 2, '16:30'),
      item('A-09', 'Kit talheres', 1, 1, '16:32'),
      item('B-03', 'Pote de vidro', 3, 3, '16:35'),
      item('B-11', 'Tábua de corte', 1, 1, '16:37'),
      item('C-07', 'Escorredor de louça', 1),
      item('D-05', 'Jarra de suco', 1),
    ],
  }),
  pedido('4822', {
    customer_name: 'Loja Centro',
    status: 'in_progress',
    criadoAs: '15:58',
    picker: { name: 'Ana P.' },
    items: [
      item('A-03', 'Liquidificador', 1, 1, '16:24'),
      item('A-07', 'Ventilador de mesa', 1, 1, '16:26'),
      item('A-12', 'Ferro de passar', 4, 4, '16:29'),
      item('B-02', 'Chaleira elétrica', 3, 3, '16:33'),
      item('B-05', 'Sanduicheira', 2, 2, '16:35'),
      item('B-09', 'Jogo de panelas', 7, 7, '16:38'),
      item('B-14', 'Garrafa térmica', 4, 4, '16:42'),
      item('C-04', 'Cafeteira', 2),
      item('C-06', 'Torradeira', 3),
      item('D-03', 'Batedeira', 2),
      item('D-08', 'Secador de cabelo', 1),
      item('E-02', 'Panela de pressão', 2),
    ],
  }),
  pedido('4823', {
    customer_name: 'Casa & Cia',
    status: 'in_progress',
    criadoAs: '16:05',
    picker: { name: 'João R.' },
    has_mismatch: true,
    items: [
      item('A-05', 'Mixer de mão', 1, 1, '16:20'),
      item('B-08', 'Forma de bolo', 2, 2, '16:23'),
      item('B-14', 'Garrafa térmica', 3),
      item('C-12', 'Assadeira', 2),
      item('D-16', 'Panela elétrica', 1),
      item('E-09', 'Fruteira', 3),
    ],
  }),
  pedido('4824', {
    customer_name: 'Mercado Norte',
    status: 'pending',
    criadoAs: '16:10',
    requires_forklift: true,
    picker: { name: 'Empilhadeira 02' },
    items: [
      item('C-02', 'Geladeira compacta', 1),
      item('D-11', 'Micro-ondas', 2),
      item('E-17', 'Forno elétrico', 4),
    ],
  }),
  pedido('4825', {
    customer_name: 'Eletro Sul',
    status: 'in_progress',
    criadoAs: '16:18',
    picker: { name: 'Bruna S.' },
    items: [
      item('A-14', 'Cafeteira', 4),
      item('B-06', 'Torradeira', 5),
      item('C-10', 'Batedeira', 6),
      item('D-02', 'Liquidificador', 4),
      item('E-13', 'Sanduicheira', 6),
    ],
  }),
  pedido('4827', {
    customer_name: 'Loja Centro',
    status: 'pending',
    criadoAs: '16:42',
    items: [
      item('A-08', 'Ventilador de mesa', 3),
      item('B-17', 'Ferro de passar', 5),
      item('C-01', 'Chaleira elétrica', 6),
    ],
  }),
  pedido('4828', {
    customer_name: 'Eletro Sul',
    status: 'pending',
    criadoAs: '16:40',
    items: [
      item('A-11', 'Jogo de panelas', 6),
      item('C-15', 'Garrafa térmica', 8),
      item('D-04', 'Secador de cabelo', 4),
      item('E-06', 'Panela de pressão', 4),
    ],
  }),
  pedido('4829', {
    customer_name: 'Loja Bauru',
    status: 'pending',
    criadoAs: '16:35',
    requires_forklift: true,
    items: [
      item('B-19', 'Máquina de lavar', 2),
      item('E-15', 'Fogão 4 bocas', 6),
    ],
  }),
  pedido('4821', {
    customer_name: 'Loja Bauru',
    status: 'completed',
    criadoAs: '15:12',
    picker: { name: 'Carlos M.' },
    items: [
      item('A-04', 'Pote de vidro', 6, 6, '15:20'),
      item('B-10', 'Copo térmico', 8, 8, '15:24'),
      item('D-12', 'Jarra de suco', 4, 4, '15:31'),
    ],
  }),
  pedido('4820', {
    customer_name: 'Loja Centro',
    status: 'completed',
    criadoAs: '14:47',
    picker: { name: 'Ana P.' },
    items: [
      item('A-06', 'Kit talheres', 5, 5, '14:55'),
      item('C-03', 'Escorredor de louça', 6, 6, '15:02'),
    ],
  }),
  pedido('4819', {
    customer_name: 'Mercado Norte',
    status: 'completed',
    criadoAs: '14:30',
    picker: { name: 'Pedro L.' },
    items: [
      item('A-01', 'Tábua de corte', 9, 9, '14:36'),
      item('B-12', 'Forma de bolo', 8, 8, '14:41'),
      item('C-18', 'Assadeira', 10, 10, '14:48'),
    ],
  }),
]
