// Valores iniciais da tela de Configurações.
// A planta começa com os mesmos números desenhados no Mapa do armazém.
// Enquanto a API não tem rota de configurações, o que for salvo fica só neste navegador.

import { ALTURA_POR_NIVEL, NIVEIS_POR_ESTANTE, PLANTA } from '../Mapa/dadosMapa'

export const configuracaoPadrao = {
  nomeArmazem: 'Galpão 1 · Marília',
  corredores: String(PLANTA.corredores.length),
  posicoesPorCorredor: String(PLANTA.posicoesPorCorredor),
  niveisPorEstante: String(NIVEIS_POR_ESTANTE),
  alturaPorNivel: ALTURA_POR_NIVEL.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  posicaoDoca: 'esquerda',
  alturaEmpilhadeira: '1,50',
  pesoEmpilhadeira: '25',
  maxItensPorRota: '40',
  agruparPedidos: true,
  pedidosPorGrupo: '3',
}

export const opcoesDoca = [
  { id: 'esquerda', nome: 'Lateral esquerda, junto ao corredor A' },
  { id: 'direita', nome: 'Lateral direita, junto ao último corredor' },
  { id: 'fundo', nome: 'Fundo do armazém, no meio dos corredores' },
]

export const nomesPerfil = {
  gestor: 'Gestor',
  coletor: 'Coletor',
  empilhadeira: 'Coletor · empilhadeira',
}

export const usuariosExemplo = [
  { id: 'ana', nome: 'Ana P.', email: 'ana.p@empresa.com.br', perfil: 'coletor', ultimoAcesso: 'há 2 min' },
  { id: 'pedro', nome: 'Pedro L.', email: 'pedro.l@empresa.com.br', perfil: 'coletor', ultimoAcesso: 'há 1 min' },
  { id: 'joao', nome: 'João R.', email: 'joao.r@empresa.com.br', perfil: 'coletor', ultimoAcesso: 'há 3 min' },
  {
    id: 'marcos',
    nome: 'Marcos T.',
    email: 'marcos.t@empresa.com.br',
    perfil: 'empilhadeira',
    ultimoAcesso: 'há 12 min',
  },
]
