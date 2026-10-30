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
