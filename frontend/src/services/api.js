// Funções que conversam com a API do Laravel.
// O token do login fica no localStorage; todos os dados vêm do banco via API.

const URL_BASE = import.meta.env.VITE_API_URL ?? '/api'
const CHAVE_TOKEN = 'fasthub_token'

export function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN)
  } catch {
    return null
  }
}

function guardarToken(token) {
  try {
    if (token) {
      localStorage.setItem(CHAVE_TOKEN, token)
    } else {
      localStorage.removeItem(CHAVE_TOKEN)
    }
  } catch {
    // se o navegador bloquear o armazenamento, o login vale só até recarregar a página
  }
}

// Cria um erro com a mensagem e, se a API mandou, os erros de cada campo (ex.: erro.erros.email).
function criarErro(mensagem, status = 0, erros = {}) {
  const erro = new Error(mensagem)
  erro.status = status
  erro.erros = erros
  return erro
}

async function requisicao(caminho, metodo = 'GET', corpo = null) {
  const token = lerToken()

  const headers = { Accept: 'application/json' }
  if (corpo) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let resposta
  try {
    resposta = await fetch(URL_BASE + caminho, {
      method: metodo,
      headers: headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw criarErro('Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.')
  }

  const dados = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    // 401 com token salvo = sessão vencida: limpa o token e avisa o App.
    if (resposta.status === 401 && token) {
      guardarToken(null)
      window.dispatchEvent(new Event('fasthub:sessao-expirada'))
    }

    const mensagem = dados?.message ?? 'Erro inesperado ao falar com o servidor.'
    throw criarErro(mensagem, resposta.status, dados?.errors ?? {})
  }

  return dados
}

export async function entrar(email, senha) {
  const dados = await requisicao('/login', 'POST', { email: email, password: senha })
  guardarToken(dados.token)
  return dados.user
}

export async function sair() {
  try {
    await requisicao('/logout', 'POST')
  } catch {
    // sem rede ou token já inválido: o importante é limpar a sessão local
  }
  guardarToken(null)
}

export function buscarUsuario() {
  return requisicao('/me')
}

export function listarColetores() {
  return requisicao('/pickers')
}

export function buscarRanking(periodo) {
  return requisicao(`/pickers/ranking?period=${periodo}`)
}

export function criarColetor(corpo) {
  return requisicao('/pickers', 'POST', corpo)
}

export function editarColetor(id, corpo) {
  return requisicao(`/pickers/${id}`, 'PUT', corpo)
}

export function excluirColetor(id) {
  return requisicao(`/pickers/${id}`, 'DELETE')
}

export function listarPedidos() {
  return requisicao('/orders')
}

// Rota de coleta calculada no backend: paradas em ordem, saindo e voltando à expedição.
export function buscarRotaPedido(id) {
  return requisicao(`/orders/${id}/route`)
}

export function criarPedido(corpo) {
  return requisicao('/orders', 'POST', corpo)
}

export function listarPosicoes() {
  return requisicao('/locations')
}

export function criarPosicao(corpo) {
  return requisicao('/locations', 'POST', corpo)
}

export function listarProdutos() {
  return requisicao('/products')
}

export function criarProduto(corpo) {
  return requisicao('/products', 'POST', corpo)
}

export function listarCorredores() {
  return requisicao('/aisles')
}

export function criarCorredor(corpo) {
  return requisicao('/aisles', 'POST', corpo)
}

export function buscarDashboard() {
  return requisicao('/dashboard')
}

// datas no formato AAAA-MM-DD
export function buscarRelatorio(de, ate) {
  return requisicao(`/reports?from=${de}&to=${ate}`)
}

// Divergências de bipagem. `abertas` = só as de pedidos ainda não concluídos.
export function listarDivergencias({ desde, abertas } = {}) {
  const filtros = new URLSearchParams()
  if (desde) filtros.set('from', desde)
  if (abertas) filtros.set('open', '1')
  const texto = filtros.toString()
  return requisicao(`/scan-events${texto ? `?${texto}` : ''}`)
}

export function listarPedidosPorStatus(status) {
  return requisicao(`/orders?status=${status}`)
}

export function buscarConfiguracoes() {
  return requisicao('/settings')
}

export function salvarConfiguracoes(corpo) {
  return requisicao('/settings', 'PUT', corpo)
}

export function listarUsuarios() {
  return requisicao('/users')
}

export function criarUsuario(corpo) {
  return requisicao('/users', 'POST', corpo)
}

export function editarUsuario(id, corpo) {
  return requisicao(`/users/${id}`, 'PUT', corpo)
}

export function excluirUsuario(id) {
  return requisicao(`/users/${id}`, 'DELETE')
}

// Coletor (perfil picker) ------------------------------------------------------

// Pedidos do coletor logado. Sem status: abertos (em andamento primeiro, depois pendentes).
// status: pending | in_progress | completed | cancelled | all
export function listarMeusPedidos(status) {
  return requisicao(`/picker/orders${status ? `?status=${status}` : ''}`)
}

export function iniciarPedido(id) {
  return requisicao(`/orders/${id}/start`, 'POST')
}

export function concluirPedido(id) {
  return requisicao(`/orders/${id}/complete`, 'POST')
}

// Só o gestor cancela. Pedido concluído ou já cancelado responde 409.
export function cancelarPedido(id) {
  return requisicao(`/orders/${id}/cancel`, 'POST')
}

// Bipagem de uma unidade. Código diferente do produto do item = divergência (a API responde 422).
export function biparItem(orderItemId, codigo) {
  return requisicao('/scan-events', 'POST', { order_item_id: orderItemId, barcode: codigo })
}

// status: active | paused | offline
export function mudarMeuStatus(status) {
  return requisicao('/picker/status', 'POST', { status })
}
