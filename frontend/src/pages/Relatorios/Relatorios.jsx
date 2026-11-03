import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import GraficoLinha from './GraficoLinha'
import GraficoDistancia from './GraficoDistancia'
import {
  META_ITENS_POR_HORA,
  dadosDoDia,
  diasEntre,
  formatarDiaMes,
  inicioDoDia,
  itensPorHoraNoPeriodo,
  nomesSituacao,
  ocorrencias,
  paraIso,
  pedidosHojePorHora,
  somarDias,
} from './dadosRelatorios'
import './Relatorios.css'

// Por enquanto a tela usa dados de exemplo (dadosRelatorios.js).

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
    comparacao: 'vs semana anterior',
    atual: 'Esta semana',
    anterior: 'Semana anterior',
    dentro: 'na semana',
    media: 'Média da semana',
  },
  '30dias': {
    subtitulo: 'últimos 30 dias',
    comparacao: 'vs mês anterior',
    atual: 'Este mês',
    anterior: 'Mês anterior',
    dentro: 'no mês',
    media: 'Média do mês',
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

const MAXIMO_DIAS_PERSONALIZADO = 90
const OCORRENCIAS_VISIVEIS = 7

const numero = (valor, casas = 0) =>
  valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

function diasDoIntervalo(inicio, fim) {
  return Array.from({ length: diasEntre(inicio, fim) }, (_, i) => dadosDoDia(somarDias(inicio, i)))
}

function somar(lista, conta) {
  return lista.reduce((total, item) => total + conta(item), 0)
}

// médias ponderadas pela quantidade de pedidos de cada dia
function resumir(dias) {
  const pedidos = somar(dias, (d) => d.pedidos)
  return {
    pedidos,
    segundosPorItem: somar(dias, (d) => d.segundosPorItem * d.pedidos) / pedidos,
    papel: somar(dias, (d) => d.metrosListaPapel * d.pedidos) / pedidos,
    otimizada: somar(dias, (d) => d.metrosRotaOtimizada * d.pedidos) / pedidos,
    kmEconomizados: somar(dias, (d) => (d.metrosListaPapel - d.metrosRotaOtimizada) * d.pedidos) / 1000,
  }
}

function grupoDeDistancia(rotulo, titulo, dias) {
  const r = resumir(dias)
  return { rotulo, titulo, papel: Math.round(r.papel), otimizada: Math.round(r.otimizada) }
}

function gruposDeDistancia(periodo, dias, diasAnteriores) {
  if (periodo === 'hoje') {
    return [grupoDeDistancia('Ontem', 'Ontem', diasAnteriores), grupoDeDistancia('Hoje', 'Hoje', dias)]
  }
  if (dias.length <= 7) {
    return dias.map((d) => {
      const semana = d.data.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      return grupoDeDistancia(semana, formatarDiaMes(d.data), [d])
    })
  }
  const quantos = Math.min(6, Math.max(2, Math.round(dias.length / 7)))
  const tamanho = dias.length / quantos
  return Array.from({ length: quantos }, (_, i) => {
    const trecho = dias.slice(Math.round(i * tamanho), Math.round((i + 1) * tamanho))
    const titulo = `${formatarDiaMes(trecho[0].data)} a ${formatarDiaMes(trecho[trecho.length - 1].data)}`
    return grupoDeDistancia(`S${i + 1}`, titulo, trecho)
  })
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
    const de = inicioDoDia(new Date(`${personalizado.de}T00:00:00`))
    const ate = inicioDoDia(new Date(`${personalizado.ate}T00:00:00`))
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
    if (erroPeriodo) inicio = somarDias(hoje, -13)
  }

  const textos = textosDoPeriodo[periodo]
  const dias = diasDoIntervalo(inicio, fim)
  const quantidadeDias = dias.length
  // período anterior com o mesmo tamanho, recuado em semanas inteiras para os fins de semana
  // ficarem alinhados no gráfico (hoje compara com ontem)
  const recuo = quantidadeDias === 1 ? 1 : Math.ceil(quantidadeDias / 7) * 7
  const diasAnteriores = diasDoIntervalo(somarDias(inicio, -recuo), somarDias(fim, -recuo))

  const atual = resumir(dias)
  const anterior = resumir(diasAnteriores)
  if (periodo === 'hoje') {
    atual.pedidos = somar(pedidosHojePorHora(), (p) => p.atual)
  }

  const ocorrenciasDoPeriodo = ocorrencias.filter((o) => o.data >= inicio && o.data <= fim)
  const divergencias = ocorrenciasDoPeriodo.length
  const acuracia = ((atual.pedidos - divergencias) / atual.pedidos) * 100
  const economia = (1 - atual.otimizada / atual.papel) * 100
  const variacaoPedidos = Math.round(((atual.pedidos - anterior.pedidos) / anterior.pedidos) * 100)
  const variacaoSegundos = Math.round(atual.segundosPorItem - anterior.segundosPorItem)

  const pontos =
    periodo === 'hoje'
      ? pedidosHojePorHora()
      : dias.map((d, i) => ({
          rotulo: formatarDiaMes(d.data),
          atual: d.pedidos,
          anterior: diasAnteriores[i].pedidos,
        }))
  const grupos = gruposDeDistancia(periodo, dias, diasAnteriores)
  const porDia = periodo !== 'hoje' && dias.length <= 7
  let legendaDistancia = 'Média semanal, em metros'
  if (periodo === 'hoje') legendaDistancia = 'Média do dia, em metros'
  else if (porDia) legendaDistancia = 'Média diária, em metros'

  const coletores = itensPorHoraNoPeriodo(inicio, fim).sort((a, b) => b.itens - a.itens)
  const listaOcorrencias = verTodas ? ocorrenciasDoPeriodo : ocorrenciasDoPeriodo.slice(0, OCORRENCIAS_VISIVEIS)

  const textoIntervalo =
    quantidadeDias === 1 ? formatarDiaMes(inicio) : `${formatarDiaMes(inicio)} – ${formatarDiaMes(fim)}`

  function exportarPlanilha() {
    const nome = `relatorio-fasthub-${paraIso(inicio)}-a-${paraIso(fim)}.csv`
    if (periodo === 'hoje') {
      baixarPlanilha(nome, [['Hora', 'Pedidos separados'], ...pontos.map((p) => [p.rotulo, p.atual])])
      return
    }
    baixarPlanilha(nome, [
      [
        'Data',
        'Pedidos separados',
        'Tempo médio por item (s)',
        'Distância média com lista de papel (m)',
        'Distância média com rota otimizada (m)',
      ],
      ...dias.map((d) => [
        d.data.toLocaleDateString('pt-BR'),
        d.pedidos,
        numero(d.segundosPorItem, 1),
        Math.round(d.metrosListaPapel),
        Math.round(d.metrosRotaOtimizada),
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
          <div className="col-aviso demo rel-nao-imprimir">
            Prévia com dados de exemplo. Os números vão vir da API quando existir a rota de relatórios.
          </div>

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
                    onClick={() => {
                      setPeriodo(item.id)
                      setVerTodas(false)
                    }}
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
              <button type="button" className="rel-btn-secundario" onClick={exportarPlanilha}>
                <Icone nome="importar" tamanho={16} />
                Exportar planilha
              </button>
              <button type="button" className="rel-btn-principal" onClick={() => window.print()}>
                <Icone nome="importar" tamanho={16} />
                Exportar PDF
              </button>
            </div>
          </div>

          <section className="rel-indicadores" aria-label="Indicadores do período">
            <article className="dash-card rel-indicador">
              <span>Pedidos separados</span>
              <strong>{numero(atual.pedidos)}</strong>
              <small className={variacaoPedidos >= 0 ? 'positivo' : 'negativo'}>
                {variacaoPedidos === 0
                  ? `sem mudança ${textos.comparacao}`
                  : `${variacaoPedidos > 0 ? '+' : '−'}${Math.abs(variacaoPedidos)}% ${textos.comparacao}`}
              </small>
            </article>
            <article className="dash-card rel-indicador">
              <span>Tempo médio por item</span>
              <strong>{Math.round(atual.segundosPorItem)} s/item</strong>
              <small className={variacaoSegundos <= 0 ? 'positivo' : 'negativo'}>
                {variacaoSegundos === 0
                  ? `sem mudança ${textos.comparacao}`
                  : `${variacaoSegundos < 0 ? '−' : '+'}${Math.abs(variacaoSegundos)} s ${textos.comparacao}`}
              </small>
            </article>
            <article className="dash-card rel-indicador">
              <span>Acurácia</span>
              <strong>{numero(acuracia, 1)}%</strong>
              <small>
                {divergencias === 1 ? '1 divergência' : `${divergencias} divergências`} {textos.dentro}
              </small>
            </article>
            <article className="dash-card rel-indicador">
              <span>Economia de percurso</span>
              <strong>−{Math.round(economia)}%</strong>
              <small className="positivo">≈ {numero(atual.kmEconomizados)} km a menos</small>
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
              <GraficoLinha
                pontos={pontos}
                nomeAtual={textos.atual}
                nomeAnterior={textos.anterior}
                unidade="pedidos"
              />
            </section>

            <section className="dash-card rel-bloco">
              <h2>Distância por pedido</h2>
              <p className="rel-bloco-sub">{legendaDistancia}</p>
              <ul className="rel-legenda rel-legenda-barras">
                <li>
                  <span className="rel-legenda-cor papel" /> Lista de papel
                </li>
                <li>
                  <span className="rel-legenda-cor otimizada" /> Rota otimizada
                </li>
              </ul>
              <GraficoDistancia grupos={grupos} />
            </section>
          </div>

          <div className="rel-linha-tabelas">
            <section className="dash-card rel-bloco">
              <h2>Itens por hora por coletor</h2>
              <p className="rel-bloco-sub">
                {textos.media} · meta de {META_ITENS_POR_HORA} itens por hora
              </p>

              <ul className="rel-coletores" style={{ '--meta': META_ITENS_POR_HORA / 100 }}>
                {coletores.map((coletor) => (
                  <li key={coletor.nome}>
                    <span className="rel-coletor-nome">{coletor.nome}</span>
                    <span className="rel-coletor-trilho">
                      <span
                        className={coletor.itens >= META_ITENS_POR_HORA ? 'na-meta' : 'abaixo'}
                        style={{ width: `${Math.min(coletor.itens, 100)}%` }}
                      />
                    </span>
                    <strong>{coletor.itens}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section className="dash-card rel-bloco rel-ocorrencias">
              <div className="rel-bloco-topo">
                <h2>Ocorrências de bipagem</h2>
                {ocorrenciasDoPeriodo.length > OCORRENCIAS_VISIVEIS && (
                  <button type="button" className="rel-ver-todas" onClick={() => setVerTodas(!verTodas)}>
                    {verTodas ? 'Ver menos' : 'Ver todas'} <Icone nome="seta" tamanho={14} />
                  </button>
                )}
              </div>

              {ocorrenciasDoPeriodo.length === 0 ? (
                <p className="dash-vazio">Nenhuma ocorrência de bipagem nesse período.</p>
              ) : (
                <div className="rel-tabela-area">
                  <table className="rel-tabela">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Pedido</th>
                        <th>Tipo</th>
                        <th>Local</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaOcorrencias.map((o) => (
                        <tr key={o.pedido}>
                          <td className="rel-cinza">{formatarDiaMes(o.data)}</td>
                          <td className="rel-pedido">#{o.pedido}</td>
                          <td>{o.tipo}</td>
                          <td>
                            <span className="rel-local">{o.local}</span>
                          </td>
                          <td>
                            <span className={`rel-situacao ${o.situacao}`}>{nomesSituacao[o.situacao]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Relatorios
