import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import GraficoLinha from './GraficoLinha'
import GraficoDistancia from './GraficoDistancia'
import { buscarRelatorio } from '../../services/api'
import { formatarPercentual, semDado } from '../../utils/formatar'
import './Relatorios.css'

// Relatórios com dados do banco (GET /reports). Para comparar, busca também o período
// anterior de mesmo tamanho.

const periodos = [
  { id: 'hoje', nome: 'Hoje' },
  { id: '7dias', nome: '7 dias' },
  { id: '30dias', nome: '30 dias' },
  { id: 'personalizado', nome: 'Personalizado' },
]

const textosDoPeriodo = {
  hoje: {
    subtitulo: 'hoje',
    comparacao: 'vs ontem',
    atual: 'Hoje',
    anterior: 'Ontem',
    dentro: 'hoje',
    media: 'Média de hoje',
  },
  '7dias': {
    subtitulo: 'últimos 7 dias',
    comparacao: 'vs 7 dias anteriores',
    atual: 'Este período',
    anterior: 'Período anterior',
    dentro: 'no período',
    media: 'Média do período',
  },
  '30dias': {
    subtitulo: 'últimos 30 dias',
    comparacao: 'vs 30 dias anteriores',
    atual: 'Este período',
    anterior: 'Período anterior',
    dentro: 'no período',
    media: 'Média do período',
  },
  personalizado: {
    subtitulo: 'período personalizado',
    comparacao: 'vs período anterior',
    atual: 'Este período',
    anterior: 'Período anterior',
    dentro: 'no período',
    media: 'Média do período',
  },
}

const nomesSituacao = {
  open: { nome: 'Aberta', classe: 'aberta' },
  resolved: { nome: 'Pedido concluído', classe: 'resolvida' },
  cancelled: { nome: 'Pedido cancelado', classe: 'inventario' },
}

const MAXIMO_DIAS_PERSONALIZADO = 90
const OCORRENCIAS_VISIVEIS = 7
const DIA_EM_MS = 24 * 60 * 60 * 1000

const numero = (valor, casas = 0) =>
  valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

function inicioDoDia(data = new Date()) {
  const copia = new Date(data)
  copia.setHours(0, 0, 0, 0)
  return copia
}

function somarDias(data, dias) {
  const copia = new Date(data)
  copia.setDate(copia.getDate() + dias)
  return copia
}

function diasEntre(inicio, fim) {
  return Math.round((inicioDoDia(fim) - inicioDoDia(inicio)) / DIA_EM_MS) + 1
}

function formatarDiaMes(data) {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function paraIso(data) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

// "2026-11-12" vira a data local (sem o fuso empurrar para o dia anterior)
function deIso(texto) {
  return new Date(`${texto}T00:00:00`)
}

// Busca o período escolhido e o anterior de mesmo tamanho.
function useRelatorio(inicio, fim, anteriorInicio, anteriorFim, ativo) {
  const [estado, setEstado] = useState({ atual: null, anterior: null, erro: '', chave: '' })
  const chave = `${inicio}|${fim}`

  useEffect(() => {
    if (!ativo) return undefined
    let vivo = true
    Promise.all([buscarRelatorio(inicio, fim), buscarRelatorio(anteriorInicio, anteriorFim)])
      .then(([atual, anterior]) => vivo && setEstado({ atual, anterior, erro: '', chave }))
      .catch((e) => vivo && setEstado({ atual: null, anterior: null, erro: e.message, chave }))
    return () => {
      vivo = false
    }
  }, [inicio, fim, anteriorInicio, anteriorFim, ativo, chave])

  const carregando = estado.chave !== chave
  return { ...estado, carregando }
}

// Distância média ponderada pelos pedidos de cada dia; null se nenhum dia tem dado.
function mediaDistancia(dias) {
  const comDado = dias.filter((d) => d.avg_list_order_m != null && d.orders > 0)
  const pedidos = comDado.reduce((s, d) => s + d.orders, 0)
  if (!pedidos) return null
  return {
    papel: Math.round(comDado.reduce((s, d) => s + d.avg_list_order_m * d.orders, 0) / pedidos),
    otimizada: Math.round(comDado.reduce((s, d) => s + d.avg_optimized_m * d.orders, 0) / pedidos),
  }
}

function gruposDeDistancia(periodo, dias, diasAnteriores) {
  const grupo = (rotulo, titulo, lista) => {
    const media = mediaDistancia(lista)
    return media ? { rotulo, titulo, ...media } : null
  }

  let grupos
  if (periodo === 'hoje') {
    grupos = [grupo('Ontem', 'Ontem', diasAnteriores), grupo('Hoje', 'Hoje', dias)]
  } else if (dias.length <= 7) {
    grupos = dias.map((d) => {
      const data = deIso(d.date)
      const semana = data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      return grupo(semana, formatarDiaMes(data), [d])
    })
  } else {
    const quantos = Math.min(6, Math.max(2, Math.round(dias.length / 7)))
    const tamanho = dias.length / quantos
    grupos = Array.from({ length: quantos }, (_, i) => {
      const trecho = dias.slice(Math.round(i * tamanho), Math.round((i + 1) * tamanho))
      const titulo = `${formatarDiaMes(deIso(trecho[0].date))} a ${formatarDiaMes(deIso(trecho[trecho.length - 1].date))}`
      return grupo(`S${i + 1}`, titulo, trecho)
    })
  }
  return grupos.filter(Boolean)
}

// Pontos do gráfico de linha. Hoje: por hora (juntando as horas de hoje e de ontem); senão, por dia.
function pontosDoGrafico(periodo, atual, anterior) {
  if (periodo === 'hoje') {
    const deHoje = new Map((atual.hours ?? []).map((h) => [h.hour, h.orders]))
    const deOntem = new Map((anterior.hours ?? []).map((h) => [h.hour, h.orders]))
    const horas = [...deHoje.keys(), ...deOntem.keys()]
    if (horas.length === 0) return []
    const primeira = Math.min(...horas)
    const ultima = Math.max(...horas)
    return Array.from({ length: ultima - primeira + 1 }, (_, i) => {
      const hora = primeira + i
      return {
        rotulo: `${String(hora).padStart(2, '0')}h`,
        atual: deHoje.get(hora) ?? 0,
        anterior: deOntem.get(hora) ?? 0,
      }
    })
  }
  return atual.days.map((d, i) => ({
    rotulo: formatarDiaMes(deIso(d.date)),
    atual: d.orders,
    anterior: anterior.days[i]?.orders ?? 0,
  }))
}

function baixarPlanilha(nomeArquivo, linhas) {
  const texto = linhas.map((linha) => linha.join(';')).join('\n')
  const arquivo = new Blob([`﻿${texto}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(arquivo)
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(link.href)
}

function textoVariacao(atual, anterior, comparacao) {
  if (atual == null || !anterior) return { texto: `sem base ${comparacao}`, positivo: null }
  const variacao = Math.round(((atual - anterior) / anterior) * 100)
  if (variacao === 0) return { texto: `sem mudança ${comparacao}`, positivo: true }
  return { texto: `${variacao > 0 ? '+' : '−'}${Math.abs(variacao)}% ${comparacao}`, positivo: variacao > 0 }
}

function Relatorios({ usuario, onNavegar, onSair }) {
  const hoje = inicioDoDia()
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('30dias')
  const [personalizado, setPersonalizado] = useState({
    de: paraIso(somarDias(hoje, -13)),
    ate: paraIso(hoje),
  })
  const [verTodas, setVerTodas] = useState(false)

  // intervalo escolhido (o personalizado só vale se as datas fizerem sentido)
  let inicio = hoje
  let fim = hoje
  let erroPeriodo = ''
  if (periodo === '7dias') inicio = somarDias(hoje, -6)
  if (periodo === '30dias') inicio = somarDias(hoje, -29)
  if (periodo === 'personalizado') {
    const de = inicioDoDia(deIso(personalizado.de))
    const ate = inicioDoDia(deIso(personalizado.ate))
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      erroPeriodo = 'Escolha as duas datas.'
    } else if (de > ate) {
      erroPeriodo = 'A data inicial precisa ser antes da final.'
    } else if (ate > hoje) {
      erroPeriodo = 'A data final não pode ser depois de hoje.'
    } else if (diasEntre(de, ate) > MAXIMO_DIAS_PERSONALIZADO) {
      erroPeriodo = `Escolha no máximo ${MAXIMO_DIAS_PERSONALIZADO} dias.`
    } else {
      inicio = de
      fim = ate
    }
  }

  const quantidadeDias = diasEntre(inicio, fim)
  const anteriorFim = somarDias(inicio, -1)
  const anteriorInicio = somarDias(anteriorFim, -(quantidadeDias - 1))

  const { atual, anterior, erro, carregando } = useRelatorio(
    paraIso(inicio),
    paraIso(fim),
    paraIso(anteriorInicio),
    paraIso(anteriorFim),
    !erroPeriodo,
  )

  const textos = textosDoPeriodo[periodo]
  const textoIntervalo =
    quantidadeDias === 1 ? formatarDiaMes(inicio) : `${formatarDiaMes(inicio)} – ${formatarDiaMes(fim)}`

  function trocarPeriodo(id) {
    setPeriodo(id)
    setVerTodas(false)
  }

  let conteudo
  if (erroPeriodo) {
    conteudo = <p className="col-aviso">Ajuste as datas para ver o relatório.</p>
  } else if (erro && !atual) {
    conteudo = <div className="col-aviso erro">Não foi possível carregar o relatório: {erro}</div>
  } else if (!atual || carregando) {
    conteudo = <p className="col-aviso">Carregando relatório...</p>
  } else {
    conteudo = (
      <Conteudo
        periodo={periodo}
        textos={textos}
        atual={atual}
        anterior={anterior}
        verTodas={verTodas}
        onVerTodas={() => setVerTodas(!verTodas)}
        busca={busca.trim().toLowerCase().replace('#', '')}
      />
    )
  }

  function exportarPlanilha() {
    if (!atual) return
    const nome = `relatorio-fasthub-${atual.from}-a-${atual.to}.csv`
    if (periodo === 'hoje') {
      baixarPlanilha(nome, [['Hora', 'Pedidos separados'], ...(atual.hours ?? []).map((h) => [`${h.hour}h`, h.orders])])
      return
    }
    const ou = (valor, casas = 0) => (valor == null ? '' : numero(valor, casas))
    baixarPlanilha(nome, [
      [
        'Data',
        'Pedidos separados',
        'Tempo médio por item (s)',
        'Acurácia (%)',
        'Distância média na ordem da lista (m)',
        'Distância média com rota otimizada (m)',
      ],
      ...atual.days.map((d) => [
        deIso(d.date).toLocaleDateString('pt-BR'),
        d.orders,
        ou(d.seconds_per_item, 1),
        ou(d.accuracy, 1),
        ou(d.avg_list_order_m),
        ou(d.avg_optimized_m),
      ]),
    ])
  }

  return (
    <div className="dashboard">
      <Sidebar ativo="relatorios" onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Relatórios"
          subtitulo={`Desempenho da operação · ${textos.subtitulo}`}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
        />

        <main className="dash-conteudo">
          <div className="rel-barra">
            <div className="rel-periodo">
              <div className="rel-periodos" role="tablist" aria-label="Período do relatório">
                {periodos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={periodo === item.id}
                    className={periodo === item.id ? 'ativo' : ''}
                    onClick={() => trocarPeriodo(item.id)}
                  >
                    {item.nome}
                  </button>
                ))}
              </div>

              {periodo === 'personalizado' ? (
                <div className="rel-datas">
                  <label>
                    De
                    <input
                      type="date"
                      value={personalizado.de}
                      max={paraIso(hoje)}
                      onChange={(e) => setPersonalizado({ ...personalizado, de: e.target.value })}
                    />
                  </label>
                  <label>
                    até
                    <input
                      type="date"
                      value={personalizado.ate}
                      max={paraIso(hoje)}
                      onChange={(e) => setPersonalizado({ ...personalizado, ate: e.target.value })}
                    />
                  </label>
                  {erroPeriodo && <span className="rel-erro">{erroPeriodo}</span>}
                </div>
              ) : (
                <span className="rel-intervalo">{textoIntervalo}</span>
              )}
            </div>

            <div className="rel-exportar rel-nao-imprimir">
              <button type="button" className="rel-btn-secundario" onClick={exportarPlanilha} disabled={!atual}>
                <Icone nome="importar" tamanho={16} />
                Exportar planilha
              </button>
              <button type="button" className="rel-btn-principal" onClick={() => window.print()}>
                <Icone nome="importar" tamanho={16} />
                Exportar PDF
              </button>
            </div>
          </div>

          {conteudo}
        </main>
      </div>
    </div>
  )
}

function Conteudo({ periodo, textos, atual, anterior, verTodas, onVerTodas, busca }) {
  const r = atual.summary
  const a = anterior.summary
  const meta = atual.items_per_hour_target

  const pedidos = textoVariacao(r.orders, a.orders, textos.comparacao)

  let segundos = { texto: 'sem bipagens no período', positivo: null }
  if (r.seconds_per_item != null && a.seconds_per_item != null) {
    const diferenca = Math.round(r.seconds_per_item - a.seconds_per_item)
    segundos =
      diferenca === 0
        ? { texto: `sem mudança ${textos.comparacao}`, positivo: true }
        : { texto: `${diferenca < 0 ? '−' : '+'}${Math.abs(diferenca)} s ${textos.comparacao}`, positivo: diferenca < 0 }
  } else if (r.seconds_per_item != null) {
    segundos = { texto: `sem base ${textos.comparacao}`, positivo: null }
  }

  const pontos = pontosDoGrafico(periodo, atual, anterior)
  const grupos = gruposDeDistancia(periodo, atual.days, anterior.days)
  const porDia = periodo !== 'hoje' && atual.days.length <= 7
  let legendaDistancia = 'Média semanal, em metros'
  if (periodo === 'hoje') legendaDistancia = 'Média do dia, em metros'
  else if (porDia) legendaDistancia = 'Média diária, em metros'

  const ocorrencias = atual.occurrences.filter(
    (o) =>
      !busca ||
      (o.order_number ?? '').toLowerCase().includes(busca) ||
      (o.picker ?? '').toLowerCase().includes(busca) ||
      (o.location ?? '').toLowerCase().includes(busca),
  )
  const listaOcorrencias = verTodas ? ocorrencias : ocorrencias.slice(0, OCORRENCIAS_VISIVEIS)
  const classe = (positivo) => (positivo == null ? '' : positivo ? 'positivo' : 'negativo')

  return (
    <>
      <section className="rel-indicadores" aria-label="Indicadores do período">
        <article className="dash-card rel-indicador">
          <span>Pedidos separados</span>
          <strong>{numero(r.orders)}</strong>
          <small className={classe(pedidos.positivo)}>{pedidos.texto}</small>
        </article>
        <article className="dash-card rel-indicador">
          <span>Tempo médio por item</span>
          <strong>{r.seconds_per_item == null ? semDado : `${Math.round(r.seconds_per_item)} s/item`}</strong>
          <small className={classe(segundos.positivo)}>{segundos.texto}</small>
        </article>
        <article className="dash-card rel-indicador">
          <span>Acurácia</span>
          <strong>{formatarPercentual(r.accuracy)}</strong>
          <small>
            {r.mismatches === 1 ? '1 divergência' : `${r.mismatches} divergências`} em {numero(r.scans)} bipagens{' '}
            {textos.dentro}
          </small>
        </article>
        <article className="dash-card rel-indicador">
          <span>Economia de percurso</span>
          <strong>{r.saving_percent == null ? semDado : `−${formatarPercentual(r.saving_percent, 0)}`}</strong>
          <small className={r.saved_km ? 'positivo' : ''}>
            {r.saved_km == null ? 'nenhum pedido concluído' : `≈ ${numero(r.saved_km, 1)} km a menos que a ordem da lista`}
          </small>
        </article>
      </section>

      <div className="rel-linha-graficos">
        <section className="dash-card rel-bloco">
          <div className="rel-bloco-topo">
            <h2>{periodo === 'hoje' ? 'Pedidos separados por hora' : 'Pedidos separados por dia'}</h2>
            <ul className="rel-legenda">
              <li>
                <span className="rel-legenda-linha atual" /> {textos.atual}
              </li>
              <li>
                <span className="rel-legenda-linha anterior" /> {textos.anterior}
              </li>
            </ul>
          </div>
          {pontos.length === 0 ? (
            <p className="dash-vazio">Nenhum pedido concluído nesse período.</p>
          ) : (
            <GraficoLinha pontos={pontos} nomeAtual={textos.atual} nomeAnterior={textos.anterior} unidade="pedidos" />
          )}
        </section>

        <section className="dash-card rel-bloco">
          <h2>Distância por pedido</h2>
          <p className="rel-bloco-sub">{legendaDistancia}</p>
          <ul className="rel-legenda rel-legenda-barras">
            <li>
              <span className="rel-legenda-cor papel" /> Ordem da lista
            </li>
            <li>
              <span className="rel-legenda-cor otimizada" /> Rota otimizada
            </li>
          </ul>
          {grupos.length === 0 ? (
            <p className="dash-vazio">Sem pedidos concluídos para comparar.</p>
          ) : (
            <GraficoDistancia grupos={grupos} />
          )}
        </section>
      </div>

      <div className="rel-linha-tabelas">
        <section className="dash-card rel-bloco">
          <h2>Itens por hora por coletor</h2>
          <p className="rel-bloco-sub">
            {textos.media} · meta de {meta} itens por hora
          </p>

          {atual.pickers.length === 0 ? (
            <p className="dash-vazio">Nenhuma bipagem nesse período.</p>
          ) : (
            <ul className="rel-coletores" style={{ '--meta': meta / 100 }}>
              {atual.pickers.map((coletor) => (
                <li key={coletor.id}>
                  <span className="rel-coletor-nome">{coletor.name}</span>
                  <span className="rel-coletor-trilho">
                    <span
                      className={coletor.items_per_hour >= meta ? 'na-meta' : 'abaixo'}
                      style={{ width: `${Math.min(coletor.items_per_hour, 100)}%` }}
                    />
                  </span>
                  <strong>{Math.round(coletor.items_per_hour)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-card rel-bloco rel-ocorrencias">
          <div className="rel-bloco-topo">
            <h2>Ocorrências de bipagem</h2>
            {ocorrencias.length > OCORRENCIAS_VISIVEIS && (
              <button type="button" className="rel-ver-todas" onClick={onVerTodas}>
                {verTodas ? 'Ver menos' : 'Ver todas'} <Icone nome="seta" tamanho={14} />
              </button>
            )}
          </div>

          {ocorrencias.length === 0 ? (
            <p className="dash-vazio">Nenhuma ocorrência de bipagem nesse período.</p>
          ) : (
            <div className="rel-tabela-area">
              <table className="rel-tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Pedido</th>
                    <th>Coletor</th>
                    <th>Local</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {listaOcorrencias.map((o) => {
                    const situacao = nomesSituacao[o.status] ?? nomesSituacao.open
                    return (
                      <tr key={o.id}>
                        <td className="rel-cinza">
                          {new Date(o.at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="rel-pedido">{o.order_number ?? semDado}</td>
                        <td>{o.picker ?? semDado}</td>
                        <td>
                          <span className="rel-local">{o.location ?? semDado}</span>
                        </td>
                        <td>
                          <span className={`rel-situacao ${situacao.classe}`}>{situacao.nome}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

export default Relatorios
