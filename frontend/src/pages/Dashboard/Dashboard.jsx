import { useEffect, useMemo, useState } from 'react'
import Icone from '../../components/Icone'
import Sidebar from '../../components/Sidebar'
import MapaRota from '../Pedidos/MapaRota'
import GraficoPedidos from './GraficoPedidos'
import { useDashboard } from '../../hooks/useDashboard'
import { buscarRotaPedido } from '../../services/api'
import { formatarHora, formatarPercentual, iniciais, semDado } from '../../utils/formatar'
import { posicoesDaApi, rotaDaApi } from '../../utils/rotaApi'
import './Dashboard.css'
import '../Pedidos/Pedidos.css'

// Tela Início: todos os dados vêm da API (useDashboard).

const filtros = [
  { id: 'todos', nome: 'Todos' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'aguardando', nome: 'Aguardando' },
  { id: 'concluido', nome: 'Concluídos hoje' },
]

const nomesStatus = {
  concluido: 'Concluído',
  andamento: 'Em andamento',
  iniciado: 'Iniciado',
  aguardando: 'Aguardando',
  neutro: 'Sem coletor',
}

const nomesEstado = { active: 'Ativo', paused: 'Em pausa', offline: 'Offline' }
const classesEstado = { active: 'ativo', paused: 'pausa', offline: 'offline' }

// ordem da tabela: em andamento, aguardando, concluídos
const ordemStatus = { in_progress: 0, pending: 1, completed: 2 }

function dataDeHoje() {
  const agora = new Date()
  const texto = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = agora.getHours()
  let turno = 'Turno da noite'
  if (hora >= 6 && hora < 12) turno = 'Turno da manhã'
  else if (hora >= 12 && hora < 18) turno = 'Turno da tarde'

  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · ${turno}`
}

function ehHoje(iso) {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

function numeroPedido(pedido) {
  return /^\d+$/.test(pedido.order_number) ? `#${pedido.order_number}` : pedido.order_number
}

// Linha da tabela a partir do pedido da API.
function linhaDoPedido(pedido) {
  const total = pedido.items.reduce((soma, i) => soma + i.quantity, 0)
  const coletados = pedido.items.reduce((soma, i) => soma + Math.min(i.picked_quantity, i.quantity), 0)
  const progresso = total ? Math.round((coletados / total) * 100) : 0

  let status = 'aguardando'
  if (pedido.status === 'completed') status = 'concluido'
  else if (pedido.status === 'in_progress') status = coletados > 0 ? 'andamento' : 'iniciado'
  else if (!pedido.picker) status = 'neutro'

  return {
    id: pedido.id,
    numero: numeroPedido(pedido),
    coletor: pedido.picker?.name ?? 'Sem coletor',
    empilhadeira: Boolean(pedido.requires_forklift),
    itens: total,
    progresso,
    status,
    inicio: pedido.started_at ? formatarHora(pedido.started_at) : semDado,
    pedido,
  }
}

// "+12% vs ontem"; sem base de comparação, devolve null.
function variacaoPercentual(atual, anterior) {
  if (!anterior) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

function montarIndicadores(ind) {
  const hoje = ind.today
  const ontem = ind.yesterday

  const variacao = variacaoPercentual(hoje.orders, ontem.orders)
  let detalhePedidos = 'Nenhum pedido ontem até este horário'
  if (variacao !== null) {
    detalhePedidos = variacao === 0 ? 'Igual a ontem neste horário' : `${variacao > 0 ? '+' : '−'}${Math.abs(variacao)}% vs ontem`
  }

  let detalheRitmo = 'Sem bipagens hoje'
  let ritmoPositivo = false
  if (hoje.seconds_per_item != null && ontem.seconds_per_item != null) {
    const diferenca = Math.round(hoje.seconds_per_item - ontem.seconds_per_item)
    ritmoPositivo = diferenca <= 0
    detalheRitmo = diferenca === 0 ? 'Igual a ontem' : `${diferenca > 0 ? '+' : '−'}${Math.abs(diferenca)} s vs ontem`
  } else if (hoje.seconds_per_item != null) {
    detalheRitmo = 'Sem dados de ontem para comparar'
  }

  return [
    {
      titulo: 'Pedidos separados hoje',
      icone: 'caixa',
      valor: String(hoje.orders),
      detalhe: detalhePedidos,
      positivo: variacao !== null && variacao >= 0,
    },
    {
      titulo: 'Em andamento',
      icone: 'andamento',
      valor: String(ind.in_progress),
      detalhe: `${ind.active_pickers} ${ind.active_pickers === 1 ? 'coletor ativo' : 'coletores ativos'} · ${ind.pending} aguardando`,
    },
    {
      titulo: 'Pick rate',
      icone: 'relogio',
      valor: hoje.seconds_per_item == null ? semDado : `${Math.round(hoje.seconds_per_item)} s/item`,
      detalhe: detalheRitmo,
      positivo: ritmoPositivo,
    },
    {
      titulo: 'Acurácia',
      icone: 'alvo',
      valor: formatarPercentual(hoje.accuracy),
      detalhe:
        hoje.scans === 0
          ? 'Sem bipagens hoje'
          : `${hoje.mismatches} ${hoje.mismatches === 1 ? 'divergência' : 'divergências'} em ${hoje.scans} bipagens`,
      positivo: hoje.mismatches === 0 && hoje.scans > 0,
      destaque: true,
    },
  ]
}

// Rota do pedido escolhido, calculada no backend.
function useRota(pedidoId, atualizacao) {
  const [resposta, setResposta] = useState(null)

  useEffect(() => {
    if (!pedidoId) return undefined
    let ativo = true
    buscarRotaPedido(pedidoId)
      .then((dados) => ativo && setResposta(dados))
      .catch(() => ativo && setResposta(null))
    return () => {
      ativo = false
    }
  }, [pedidoId, atualizacao])

  return resposta && resposta.order_id === pedidoId ? rotaDaApi(resposta) : null
}

function Dashboard({ usuario, onNavegar, onSair }) {
  const { dados, posicoes: posicoesApi, carregando, erro, recarregar } = useDashboard()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [alertasAbertos, setAlertasAbertos] = useState(false)

  const posicoes = useMemo(() => posicoesDaApi(posicoesApi), [posicoesApi])

  const linhas = useMemo(() => {
    if (!dados) return []
    return dados.pedidos
      .filter((p) => p.status === 'in_progress' || p.status === 'pending' || (p.status === 'completed' && ehHoje(p.completed_at)))
      .sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || b.id - a.id)
      .map(linhaDoPedido)
  }, [dados])

  const termo = busca.trim().toLowerCase().replace('#', '')
  const candidatas = linhas.filter((linha) => {
    const passaFiltro =
      filtro === 'todos' ||
      linha.status === filtro ||
      (filtro === 'andamento' && linha.status === 'iniciado') ||
      (filtro === 'aguardando' && linha.status === 'neutro')
    const passaBusca =
      !termo || linha.numero.toLowerCase().includes(termo) || linha.coletor.toLowerCase().includes(termo)
    return passaFiltro && passaBusca
  })
  // em "Todos" sem busca, mostra os abertos e só os últimos concluídos; a lista completa fica no filtro próprio
  const concluidosVisiveis = 5
  const limitar = filtro === 'todos' && !termo
  const idsConcluidos = new Set(
    candidatas.filter((l) => l.status === 'concluido').slice(0, concluidosVisiveis).map((l) => l.id),
  )
  const filtradas = candidatas.filter((linha) => !limitar || linha.status !== 'concluido' || idsConcluidos.has(linha.id))

  const selecionada = linhas.find((l) => l.id === selecionadoId) ?? filtradas[0] ?? linhas[0] ?? null
  const rota = useRota(selecionada?.id ?? null, dados)

  if (carregando && !dados) {
    return (
      <div className="dashboard">
        <Sidebar ativo="inicio" onNavegar={onNavegar} onSair={onSair} />
        <div className="dash-principal">
          <main className="dash-conteudo">
            <p className="col-aviso">Carregando a operação de hoje...</p>
          </main>
        </div>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className="dashboard">
        <Sidebar ativo="inicio" onNavegar={onNavegar} onSair={onSair} />
        <div className="dash-principal">
          <main className="dash-conteudo">
            <div className="col-aviso erro">
              {erro || 'Não foi possível carregar os dados.'}
              <button type="button" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const { indicadores: ind, coletores } = dados
  const cards = montarIndicadores(ind)
  const alertas = coletores.alerts
  const abertos = coletores.open_orders
  const economia = ind.today.saving_percent
  const divergencia = ind.latest_mismatch
  const primeiroNome = usuario?.name?.split(' ')[0] ?? ''

  return (
    <div className="dashboard">
      <Sidebar ativo="inicio" pedidosAbertos={abertos} onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <header className="dash-topo">
          <div>
            <h1>Olá, {primeiroNome}</h1>
            <p>{dataDeHoje()}</p>
          </div>

          <div className="dash-topo-acoes">
            <label className="dash-busca">
              <Icone nome="busca" tamanho={16} />
              <input
                type="search"
                placeholder="Buscar pedido ou coletor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>

            <div className="dash-alerta-area">
              <button
                type="button"
                className={`dash-alerta col-sino ${alertas.length ? 'com-alerta' : ''}`}
                aria-label="Alertas"
                aria-expanded={alertasAbertos}
                onClick={() => setAlertasAbertos(!alertasAbertos)}
              >
                <Icone nome="sino" tamanho={18} />
              </button>

              {alertasAbertos && (
                <div className="dash-alertas">
                  <strong>Alertas de hoje</strong>
                  {alertas.length === 0 ? (
                    <p className="col-alertas-vazio">Nenhuma divergência registrada hoje.</p>
                  ) : (
                    <ul>
                      {alertas.map((alerta) => (
                        <li key={alerta.id}>
                          <span className="dash-alertas-icone erro">
                            <Icone nome="aviso" tamanho={14} />
                          </span>
                          <div>
                            <p>{alerta.text}</p>
                            <small>às {formatarHora(alerta.at)}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="dash-usuario">
              <span className="dash-avatar">{usuario ? iniciais(usuario.name) : ''}</span>
              <div>
                <strong>{usuario?.name}</strong>
                <small>{usuario?.job_title ?? 'Gestor'}</small>
              </div>
            </div>
          </div>
        </header>

        <main className="dash-conteudo">
          {erro && (
            <div className="col-aviso erro">
              Não foi possível atualizar agora: {erro}
              <button type="button" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          )}

          <div className="dash-titulo">
            <h2>Visão geral da operação</h2>
          </div>

          <section className="dash-indicadores">
            {cards.map((card) => (
              <article key={card.titulo} className="dash-card dash-indicador">
                <div className="dash-indicador-topo">
                  <span className={`dash-indicador-icone ${card.destaque ? 'destaque' : ''}`}>
                    <Icone nome={card.icone} tamanho={18} />
                  </span>
                  {card.titulo}
                </div>
                <strong>{card.valor}</strong>
                <small className={card.positivo ? 'positivo' : ''}>{card.detalhe}</small>
              </article>
            ))}
          </section>

          <div className="dash-meio">
            <section className="dash-card dash-pedidos">
              <div className="dash-pedidos-topo">
                <h3>Pedidos de hoje</h3>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavegar('pedidos')
                  }}
                >
                  Ver todos <Icone nome="seta" tamanho={14} />
                </a>
              </div>

              <div className="dash-filtros" role="tablist">
                {filtros.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filtro === item.id}
                    className={filtro === item.id ? 'ativo' : ''}
                    onClick={() => setFiltro(item.id)}
                  >
                    {item.nome}
                  </button>
                ))}
              </div>

              <div className="dash-tabela-area">
                <table className="dash-tabela">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Coletor</th>
                      <th>Itens</th>
                      <th>Progresso</th>
                      <th>Status</th>
                      <th>Início</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((linha) => (
                      <tr
                        key={linha.id}
                        className={linha.id === selecionada?.id ? 'selecionado' : ''}
                        onClick={() => setSelecionadoId(linha.id)}
                        title="Ver rota no mapa"
                      >
                        <td className="dash-numero">{linha.numero}</td>
                        <td>
                          <span className="dash-coletor">
                            <span className="dash-coletor-icone">
                              <Icone nome={linha.empilhadeira ? 'empilhadeira' : 'usuario'} tamanho={14} />
                            </span>
                            {linha.coletor}
                          </span>
                        </td>
                        <td className="dash-cinza">{linha.itens}</td>
                        <td>
                          <div className="dash-progresso">
                            <div className={`dash-barra ${linha.status}`}>
                              <span style={{ width: `${linha.progresso}%` }} />
                            </div>
                            <small>{linha.progresso}%</small>
                          </div>
                        </td>
                        <td>
                          <span className={`dash-status ${linha.status}`}>{nomesStatus[linha.status]}</span>
                        </td>
                        <td>{linha.inicio}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filtradas.length === 0 && (
                  <p className="dash-vazio">
                    {linhas.length === 0 ? 'Nenhum pedido aberto ou concluído hoje.' : 'Nenhum pedido encontrado para essa busca.'}
                  </p>
                )}
              </div>
            </section>

            <section className="dash-card dash-mapa">
              <div className="dash-mapa-topo">
                <div>
                  <h3>Mapa do armazém · rota</h3>
                  <p>
                    {selecionada
                      ? `Pedido ${selecionada.numero} · ${selecionada.coletor} · ${selecionada.itens} itens`
                      : 'Nenhum pedido selecionado'}
                  </p>
                </div>
                {selecionada?.pedido.status === 'in_progress' && <span className="dash-mapa-ao-vivo">Ao vivo</span>}
              </div>
              {selecionada && rota ? (
                <MapaRota
                  posicoes={posicoes}
                  paradas={rota.paradas}
                  feitas={rota.feitas}
                  concluido={selecionada.pedido.status === 'completed'}
                  doca={rota.doca}
                  retorno={rota.retorno}
                  empilhadeira={rota.empilhadeira}
                />
              ) : (
                <p className="dash-vazio">{selecionada ? 'Calculando a rota...' : 'Selecione um pedido para ver a rota.'}</p>
              )}
            </section>
          </div>

          <div className="dash-destaques">
            <article className="dash-card dash-destaque">
              <span className="dash-destaque-rotulo">
                <Icone nome="rotas" tamanho={15} />
                Eficiência de rota
              </span>
              {economia != null ? (
                <>
                  <strong>
                    {economia > 0 ? '−' : ''}
                    {formatarPercentual(Math.abs(economia), 0)} distância percorrida
                  </strong>
                  <small>Pedidos de hoje, comparado a seguir a ordem da lista</small>
                  <div className="dash-destaque-barra">
                    <span style={{ width: `${Math.max(0, 100 - economia)}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <strong className="dash-sem-dados">{semDado}</strong>
                  <small>Nenhum pedido concluído hoje</small>
                  <div className="dash-destaque-barra" />
                </>
              )}
            </article>

            <article className="dash-card dash-destaque">
              <span className="dash-destaque-rotulo">
                <Icone nome="empilhadeira" tamanho={15} />
                Rotas com empilhadeira
              </span>
              <strong>
                {ind.forklift_open_orders} {ind.forklift_open_orders === 1 ? 'pedido aberto' : 'pedidos abertos'}
              </strong>
              <small>Itens grandes saem em rota própria da empilhadeira</small>
              <button type="button" className="dash-chip" onClick={() => onNavegar('pedidos')}>
                Ver pedidos
              </button>
            </article>

            <article className={`dash-card dash-destaque ${divergencia ? 'alerta' : ''}`}>
              <span className="dash-destaque-rotulo">
                <Icone nome="aviso" tamanho={15} />
                Alerta de bipagem
              </span>
              {divergencia ? (
                <>
                  <strong>Código divergente</strong>
                  <small>
                    {divergencia.location ?? 'Posição não informada'} · Pedido {divergencia.order_number}
                    {divergencia.picker ? ` · ${divergencia.picker}` : ''} · às {formatarHora(divergencia.at)}
                  </small>
                  <button type="button" className="dash-chip perigo" onClick={() => onNavegar('relatorios')}>
                    Ver ocorrência
                  </button>
                </>
              ) : (
                <>
                  <strong>Nenhuma divergência</strong>
                  <small>Todas as bipagens de hoje conferem</small>
                </>
              )}
            </article>
          </div>

          <div className="dash-rodape-grid">
            <section className="dash-card dash-bloco">
              <div className="dash-bloco-topo">
                <h3>Pedidos separados por hora</h3>
                <span className="dash-bloco-legenda">
                  <span className="dash-bloco-legenda-cor" /> Hora atual
                </span>
              </div>
              <GraficoPedidos porHora={ind.orders_per_hour} />
            </section>

            <section className="dash-card dash-bloco">
              <div className="dash-bloco-topo">
                <h3>Coletores</h3>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    onNavegar('coletores')
                  }}
                >
                  Ver todos <Icone nome="seta" tamanho={14} />
                </a>
              </div>

              {coletores.pickers.length === 0 ? (
                <p className="dash-vazio">Nenhum coletor cadastrado.</p>
              ) : (
                <ul className="dash-coletores">
                  {coletores.pickers.map((coletor) => (
                    <li key={coletor.id}>
                      <span className="dash-coletor-icone">
                        <Icone nome={coletor.picker_type === 'forklift' ? 'empilhadeira' : 'usuario'} tamanho={14} />
                      </span>
                      <div className="dash-coletores-nome">
                        <strong>{coletor.name}</strong>
                        <small className={`dash-estado ${classesEstado[coletor.status]}`}>
                          {nomesEstado[coletor.status]}
                        </small>
                      </div>
                      <span className="dash-coletores-ritmo">
                        <strong>
                          {coletor.metrics.items_per_hour == null ? semDado : Math.round(coletor.metrics.items_per_hour)}
                        </strong>{' '}
                        itens/h
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
