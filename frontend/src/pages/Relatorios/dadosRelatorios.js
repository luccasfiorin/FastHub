// Dados de exemplo para a tela de Relatórios.
// Os números de cada dia são gerados a partir da data, então não mudam a cada vez que a tela abre.
// Quando o backend tiver os relatórios (ex.: GET /api/reports?from=&to=), trocar `dadosDoDia`,
// `ocorrencias` e `itensPorHoraBase` pelas respostas da API.

import { pedidosPorHora } from '../Dashboard/dados'

const DIA_EM_MS = 24 * 60 * 60 * 1000

export const META_ITENS_POR_HORA = 70

export function inicioDoDia(data = new Date()) {
  const copia = new Date(data)
  copia.setHours(0, 0, 0, 0)
  return copia
}

export function somarDias(data, dias) {
  const copia = new Date(data)
  copia.setDate(copia.getDate() + dias)
  return copia
}

export function diasEntre(inicio, fim) {
  return Math.round((inicioDoDia(fim) - inicioDoDia(inicio)) / DIA_EM_MS) + 1
}

export function formatarDiaMes(data) {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function paraIso(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// número entre 0 e 1, sempre o mesmo para a mesma data e o mesmo "canal"
function sorteio(data, canal) {
  let numero = canal * 7919
  for (const letra of paraIso(data)) numero = (numero * 31 + letra.charCodeAt(0)) % 1000003
  return ((numero * 9301 + 49297) % 233280) / 233280
}

// Números de um dia de operação.
export function dadosDoDia(data) {
  const diaDaSemana = data.getDay()
  const diasAtras = Math.max(0, diasEntre(data, new Date()) - 1)

  let base = 118
  if (diaDaSemana === 6) base = 80
  if (diaDaSemana === 0) base = 45

  return {
    data,
    pedidos: Math.round(base + (sorteio(data, 1) - 0.5) * 24),
    segundosPorItem: 40 + sorteio(data, 2) * 6 + diasAtras * 0.18,
    metrosListaPapel: 205 + sorteio(data, 3) * 12,
    metrosRotaOtimizada: 136 + sorteio(data, 4) * 12 + diasAtras * 0.15,
  }
}

// Pedidos de hoje por hora (os mesmos do gráfico do Início) e de ontem para comparar.
export function pedidosHojePorHora() {
  const ontem = somarDias(inicioDoDia(), -1)
  return pedidosPorHora.map((item, i) => ({
    rotulo: item.hora,
    atual: item.total,
    anterior: Math.max(0, Math.round(item.total * 0.92 + (sorteio(ontem, 10 + i) - 0.5) * 6)),
  }))
}

// Ocorrências de bipagem dos últimos dias. `diasAtras` = 0 é hoje.
const ocorrenciasBase = [
  { diasAtras: 0, pedido: '4823', tipo: 'Lote divergente', local: 'B-14', situacao: 'aberta' },
  { diasAtras: 2, pedido: '4790', tipo: 'Produto trocado', local: 'C-06', situacao: 'resolvida' },
  { diasAtras: 3, pedido: '4771', tipo: 'Quantidade menor', local: 'A-12', situacao: 'resolvida' },
  { diasAtras: 5, pedido: '4744', tipo: 'Lote divergente', local: 'D-08', situacao: 'resolvida' },
  { diasAtras: 6, pedido: '4730', tipo: 'Posição vazia', local: 'E-15', situacao: 'inventario' },
  { diasAtras: 9, pedido: '4702', tipo: 'Produto trocado', local: 'B-05', situacao: 'resolvida' },
  { diasAtras: 11, pedido: '4688', tipo: 'Lote divergente', local: 'A-07', situacao: 'resolvida' },
  { diasAtras: 13, pedido: '4661', tipo: 'Quantidade menor', local: 'C-12', situacao: 'resolvida' },
  { diasAtras: 16, pedido: '4630', tipo: 'Produto trocado', local: 'D-03', situacao: 'resolvida' },
  { diasAtras: 19, pedido: '4598', tipo: 'Lote divergente', local: 'E-09', situacao: 'resolvida' },
  { diasAtras: 22, pedido: '4571', tipo: 'Posição vazia', local: 'B-17', situacao: 'resolvida' },
  { diasAtras: 26, pedido: '4533', tipo: 'Quantidade menor', local: 'A-02', situacao: 'resolvida' },
  { diasAtras: 33, pedido: '4480', tipo: 'Lote divergente', local: 'C-15', situacao: 'resolvida' },
  { diasAtras: 38, pedido: '4442', tipo: 'Produto trocado', local: 'D-16', situacao: 'resolvida' },
  { diasAtras: 41, pedido: '4410', tipo: 'Lote divergente', local: 'E-02', situacao: 'resolvida' },
  { diasAtras: 47, pedido: '4361', tipo: 'Quantidade menor', local: 'B-09', situacao: 'resolvida' },
  { diasAtras: 52, pedido: '4318', tipo: 'Produto trocado', local: 'A-11', situacao: 'resolvida' },
]

export const ocorrencias = ocorrenciasBase.map((o) => ({
  ...o,
  data: somarDias(inicioDoDia(), -o.diasAtras),
}))

export const nomesSituacao = {
  aberta: 'Aberta',
  resolvida: 'Resolvida',
  inventario: 'Inventário',
}

// Média de itens por hora de cada coletor no período.
const itensPorHoraBase = [
  { nome: 'Ana P.', itens: 84 },
  { nome: 'Pedro L.', itens: 79 },
  { nome: 'João R.', itens: 73 },
  { nome: 'Carlos M.', itens: 70 },
  { nome: 'Bruna S.', itens: 61 },
  { nome: 'Empilhadeira 02', itens: 24 },
]

export function itensPorHoraNoPeriodo(inicio, fim) {
  return itensPorHoraBase.map((coletor, i) => ({
    ...coletor,
    itens: Math.max(0, coletor.itens + Math.round((sorteio(fim, 20 + i) - 0.5) * (diasEntre(inicio, fim) > 7 ? 2 : 8))),
  }))
}
