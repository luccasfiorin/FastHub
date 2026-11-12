import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import MapaRota from './MapaRota'
import NovoPedido from './NovoPedido'
import { usePedidos } from '../../hooks/usePedidos'
import { buscarRotaPedido } from '../../services/api'
import { formatarHora } from '../../utils/formatar'
import { posicoesDaApi, rotaDaApi } from '../../utils/rotaApi'
import './Pedidos.css'

const filtros = [
  { id: 'todos', nome: 'Todos' },
  { id: 'aguardando', nome: 'Aguardando' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'concluidos', nome: 'Concluídos' },
  { id: 'divergencia', nome: 'Com divergência', icone: 'aviso', classe: 'perigo' },
  { id: 'empilhadeira', nome: 'Empilhadeira', icone: 'empilhadeira' },
]

// Ordem da lista: primeiro o que está em andamento, depois o que espera, por último o que acabou.
const ordemStatus = { in_progress: 0, pending: 1, completed: 2, cancelled: 3 }

const PARADAS_VISIVEIS = 6

// Números puros ganham "#" na frente (#4822); códigos como ORD-AB12CD ficam como estão.
function numeroPedido(pedido) {
  return /^\d+$/.test(pedido.order_number) ? `#${pedido.order_number}` : pedido.order_number
}

function contarItens(pedido) {
  const total = pedido.items.reduce((soma, i) => soma + i.quantity, 0)
  const coletados = pedido.items.reduce((soma, i) => soma + Math.min(i.picked_quantity, i.quantity), 0)
  return { total, coletados, percentual: total ? Math.round((coletados / total) * 100) : 0 }
}

// Texto e cor do status mostrado na lista e no painel.
function situacao(pedido) {
  const { coletados } = contarItens(pedido)
  if (pedido.status === 'completed') return { nome: 'Concluído', classe: 'concluido' }
  if (pedido.status === 'cancelled') return { nome: 'Cancelado', classe: 'neutro' }
  if (pedido.has_mismatch) return { nome: 'Divergência', classe: 'aguardando', icone: 'aviso' }
  if (pedido.status === 'in_progress') {
    return coletados > 0 ? { nome: 'Em andamento', classe: 'andamento' } : { nome: 'Iniciado', classe: 'iniciado' }
  }
  if (!pedido.picker) return { nome: 'Sem coletor', classe: 'neutro' }
  return { nome: 'Aguardando', classe: 'aguardando' }
}

function passaNoFiltro(pedido, filtro) {
  switch (filtro) {
    case 'aguardando':
      return pedido.status === 'pending'
    case 'andamento':
      return pedido.status === 'in_progress'
    case 'concluidos':
      return pedido.status === 'completed'
    case 'divergencia':
      return pedido.has_mismatch
    case 'empilhadeira':
      return pedido.requires_forklift && pedido.status !== 'completed'
    default:
      return true
  }
}

// Rota do pedido selecionado, calculada no backend (RF04) e buscada de novo quando o pedido
// muda (a lista atualiza a cada 30 s). Devolve { rota, erro }; rota fica null até a resposta chegar.
function useRotaPedido(pedido) {
  const [resposta, setResposta] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!pedido) return undefined
    let ativo = true

    buscarRotaPedido(pedido.id)
      .then((dados) => {
        if (!ativo) return
        setResposta(dados)
        setErro('')
      })
      .catch((e) => {
        if (ativo) setErro(e.message)
      })

    // troca de pedido antes da resposta chegar: ignora a resposta antiga
    return () => {
      ativo = false
    }
  }, [pedido])

  const rota = useMemo(() => {
    if (!pedido || !resposta || resposta.order_id !== pedido.id) return null
    return rotaDaApi(resposta)
  }, [pedido, resposta])

  return { rota, erro: rota ? '' : erro }
}

function Pedidos({ usuario, onNavegar, onSair }) {
  const { pedidos: recebidos, posicoes: posicoesApi, carregando, erro, recarregar } = usePedidos()
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [selecionadoId, setSelecionadoId] = useState(null)
  const [verTodasParadas, setVerTodasParadas] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)
  const [avisoCriado, setAvisoCriado] = useState('')

  const pedidos = useMemo(
    () => [...recebidos].sort((a, b) => (ordemStatus[a.status] ?? 9) - (ordemStatus[b.status] ?? 9) || b.id - a.id),
    [recebidos],
  )

  const posicoes = useMemo(() => posicoesDaApi(posicoesApi), [posicoesApi])

  const contagem = useMemo(() => {
    const resultado = {}
    for (const item of filtros) {
      resultado[item.id] = pedidos.filter((p) => passaNoFiltro(p, item.id)).length
    }
    return resultado
  }, [pedidos])

  const termo = busca.trim().toLowerCase().replace('#', '')
  const visiveis = pedidos.filter(
    (p) =>
      passaNoFiltro(p, filtro) &&
      (!termo || p.order_number.toLowerCase().includes(termo) || p.picker?.name.toLowerCase().includes(termo)),
  )

  // Mostra o pedido escolhido se ele estiver na lista filtrada; se não, o primeiro da lista
  // (que é um em andamento, se houver).
  const selecionado = visiveis.find((p) => p.id === selecionadoId) ?? visiveis[0] ?? null
  const { rota, erro: erroRota } = useRotaPedido(selecionado)
  const abertos = pedidos.filter((p) => p.status === 'pending' || p.status === 'in_progress').length
  const emAndamento = pedidos.filter((p) => p.status === 'in_progress').length

  function selecionar(pedido) {
    setSelecionadoId(pedido.id)
    setVerTodasParadas(false)
  }

  // pedido recém-criado: limpa filtro e busca para ele aparecer na lista e já abre a rota dele
  function pedidoCriado(pedido) {
    setNovoAberto(false)
    setFiltro('todos')
    setBusca('')
    selecionar(pedido)
    setAvisoCriado(`Pedido ${numeroPedido(pedido)} criado.`)
    recarregar()
  }

  return (
    <div className="dashboard">
      <Sidebar ativo="pedidos" pedidosAbertos={abertos} onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Pedidos"
          subtitulo={`${pedidos.length} pedidos · ${emAndamento} em andamento`}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
        />

        <main className="dash-conteudo">
          {erro && (
            <div className="col-aviso erro" role="alert">
              {erro}
              <button type="button" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          )}

          <div className="ped-barra-topo">
            <div className="col-filtros ped-filtros" role="tablist">
              {filtros.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === item.id}
                  className={`${filtro === item.id ? 'ativo' : ''} ${item.classe ?? ''}`}
                  onClick={() => setFiltro(item.id)}
                >
                  {item.icone && <Icone nome={item.icone} tamanho={15} />}
                  {item.nome} <span>{contagem[item.id]}</span>
                </button>
              ))}
            </div>

            <button type="button" className="col-adicionar" onClick={() => setNovoAberto(true)}>
              + Novo pedido
            </button>
          </div>

          {avisoCriado && (
            <div className="col-aviso ped-aviso-ok" role="status">
              {avisoCriado}
              <button type="button" onClick={() => setAvisoCriado('')}>
                Fechar
              </button>
            </div>
          )}

          {carregando && <p className="col-aviso">Carregando pedidos...</p>}

          {!carregando && !erro && pedidos.length === 0 && (
            <div className="col-vazio">
              <strong>Nenhum pedido cadastrado</strong>
              <p>Os pedidos aparecem aqui assim que forem cadastrados no sistema.</p>
            </div>
          )}

          {pedidos.length > 0 && (
            <div className="ped-grade">
              <section className="dash-card ped-lista" aria-label="Lista de pedidos">
                {visiveis.length === 0 && (
                  <p className="dash-vazio">Nenhum pedido encontrado para esse filtro ou busca.</p>
                )}

                <ul>
                  {visiveis.map((pedido) => {
                    const status = situacao(pedido)
                    const itens = contarItens(pedido)
                    const ativo = pedido.id === selecionado?.id
                    const semColetor = !pedido.picker && pedido.status === 'pending'

                    return (
                      <li key={pedido.id}>
                        <button
                          type="button"
                          className={`ped-linha ${ativo ? 'ativo' : ''}`}
                          aria-pressed={ativo}
                          onClick={() => selecionar(pedido)}
                        >
                          <span className="ped-linha-topo">
                            <strong>{numeroPedido(pedido)}</strong>
                            <span className="ped-cliente">criado às {formatarHora(pedido.created_at)}</span>
                            {pedido.requires_forklift && (
                              <span className="ped-empilhadeira" title="Precisa de empilhadeira">
                                <Icone nome="empilhadeira" tamanho={15} />
                              </span>
                            )}
                            <span className={`dash-status ${status.classe} ped-status`}>
                              {status.icone && <Icone nome={status.icone} tamanho={12} />}
                              {status.nome}
                            </span>
                          </span>

                          <span className="ped-linha-base">
                            <span className={semColetor ? 'ped-sem-coletor' : ''}>
                              {itens.total} itens · {pedido.picker?.name ?? 'sem coletor'}
                            </span>
                            {pedido.status === 'pending' ? (
                              <span className="ped-acao">
                                {pedido.requires_forklift ? 'Liberar para empilhadeira' : 'Atribuir coletor'} →
                              </span>
                            ) : (
                              <span className="dash-progresso">
                                <span className={`dash-barra ${status.classe}`}>
                                  <span style={{ width: `${itens.percentual}%` }} />
                                </span>
                                <small>{itens.percentual}%</small>
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {selecionado && rota ? (
                <PainelRota
                  pedido={selecionado}
                  rota={rota}
                  posicoes={posicoes}
                  verTodas={verTodasParadas}
                  onVerTodas={() => setVerTodasParadas(!verTodasParadas)}
                />
              ) : (
                <section className="dash-card ped-painel ped-painel-vazio">
                  <Icone nome="rotas" tamanho={28} />
                  <p>
                    {!selecionado && 'Selecione um pedido na lista para ver a rota.'}
                    {selecionado && erroRota && `Não foi possível calcular a rota: ${erroRota}`}
                    {selecionado && !erroRota && 'Calculando a rota...'}
                  </p>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {novoAberto && <NovoPedido onCriado={pedidoCriado} onFechar={() => setNovoAberto(false)} />}
    </div>
  )
}

function PainelRota({ pedido, rota, posicoes, verTodas, onVerTodas }) {
  const status = situacao(pedido)
  const itens = contarItens(pedido)
  const concluido = pedido.status === 'completed'
  const total = rota.paradas.length
  const proximaParada = concluido ? null : (rota.paradas[rota.feitas] ?? null)
  const empilhadeira = rota.empilhadeira
  const proximaEmpilhadeira = concluido || !empilhadeira ? null : (empilhadeira.paradas[empilhadeira.feitas] ?? null)

  // mostra a partir da última parada feita, para dar contexto de onde o coletor está
  const inicio = verTodas ? 0 : Math.max(0, Math.min(rota.feitas - 1, total - PARADAS_VISIVEIS))
  const lista = verTodas ? rota.paradas : rota.paradas.slice(inicio, inicio + PARADAS_VISIVEIS)

  let previsao = `${rota.minutosFaltando} min`
  if (total === 0) previsao = '—'
  else if (concluido) previsao = 'Concluído'
  else if (pedido.status === 'pending') previsao = `≈ ${rota.minutosFaltando} min`

  return (
    <section className="dash-card ped-painel" aria-label={`Rota do pedido ${pedido.order_number}`}>
      <div className="ped-painel-topo">
        <div>
          <div className="ped-painel-titulo">
            <h2>Pedido {numeroPedido(pedido)}</h2>
            <span className={`dash-status ${status.classe} ped-status`}>
              {status.icone && <Icone nome={status.icone} tamanho={12} />}
              {status.nome}
            </span>
          </div>
          <p>
            Criado às {formatarHora(pedido.created_at)} · {total} {total === 1 ? 'parada' : 'paradas'}
            {pedido.requires_forklift && ' · precisa de empilhadeira'}
          </p>
        </div>
        <button type="button" className="ped-btn-secundario" title="Em breve">
          <Icone nome="usuario" tamanho={15} />
          {pedido.picker ? 'Trocar coletor' : 'Atribuir coletor'}
        </button>
      </div>

      <dl className="ped-numeros">
        <div>
          <dt>Itens</dt>
          <dd>
            {itens.coletados} / {itens.total}
          </dd>
        </div>
        <div>
          <dt>Coletor</dt>
          <dd>{pedido.picker?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>{empilhadeira ? 'Distância a pé' : 'Distância'}</dt>
          <dd>{rota.metros} m</dd>
        </div>
        <div>
          <dt>Previsão</dt>
          <dd>{previsao}</dd>
        </div>
      </dl>

      <div className={`ped-progresso ${status.classe}`}>
        <span style={{ width: `${itens.percentual}%` }} />
      </div>

      <div className="ped-mapa-card">
        <div className="ped-mapa-topo">
          <strong>{pedido.status === 'pending' ? 'Rota sugerida' : 'Rota calculada'}</strong>
          {proximaParada && (
            <span className="ped-proxima-mapa">
              Próxima: <strong>{proximaParada.codigo}</strong>
            </span>
          )}
          {proximaEmpilhadeira && (
            <span className="ped-proxima-mapa empilhadeira">
              Empilhadeira: <strong>{proximaEmpilhadeira.codigo}</strong>
            </span>
          )}
          {pedido.status === 'in_progress' && <span className="ped-ao-vivo">Ao vivo</span>}
        </div>
        {total > 0 || empilhadeira ? (
          <MapaRota
            posicoes={posicoes}
            paradas={rota.paradas}
            feitas={rota.feitas}
            concluido={concluido}
            doca={rota.doca}
            empilhadeira={empilhadeira}
          />
        ) : (
          <p className="ped-mapa-vazio">Este pedido ainda não tem itens.</p>
        )}
      </div>

      <div className="ped-paradas-topo">
        <h3>
          {empilhadeira && 'Rota a pé · '}
          {verTodas || concluido ? 'Todas as paradas' : 'Próximas paradas'}
        </h3>
        <span>
          {rota.feitas} de {total} paradas
        </span>
      </div>

      <ol className="ped-paradas">
        {lista.map((parada) => {
          const indice = rota.paradas.indexOf(parada)
          const feita = indice < rota.feitas
          const proxima = !concluido && indice === rota.feitas
          let rotulo = { nome: 'Falta', classe: 'neutro' }
          if (feita) rotulo = { nome: 'Coletado', classe: 'concluido' }
          if (proxima) rotulo = { nome: 'Próxima', classe: 'iniciado' }

          return (
            <li key={parada.id} className={proxima ? 'proxima' : ''}>
              <span className={`ped-numero ${feita ? 'feita' : proxima ? 'proxima' : ''}`}>
                {feita ? <Icone nome="check" tamanho={12} /> : indice + 1}
              </span>
              <span className="ped-posicao">{parada.codigo}</span>
              <span className="ped-produto">{parada.produto}</span>
              <span className="ped-qtd">{parada.quantidade} un</span>
              <span className={`dash-status ${rotulo.classe}`}>{rotulo.nome}</span>
            </li>
          )
        })}
      </ol>

      {total > PARADAS_VISIVEIS && (
        <button type="button" className="ped-ver-todas" onClick={onVerTodas}>
          {verTodas ? 'Mostrar só as próximas' : `Ver todas as ${total} paradas`}
        </button>
      )}

      {empilhadeira && (
        <>
          <div className="ped-paradas-topo">
            <h3>
              <Icone nome="empilhadeira" tamanho={15} /> Rota da empilhadeira
            </h3>
            <span>
              {empilhadeira.feitas} de {empilhadeira.paradas.length} paradas · {empilhadeira.metros} m
            </span>
          </div>

          <ol className="ped-paradas empilhadeira">
            {empilhadeira.paradas.map((parada, indice) => {
              const feita = indice < empilhadeira.feitas
              const proxima = !concluido && indice === empilhadeira.feitas
              let rotulo = { nome: 'Falta', classe: 'neutro' }
              if (feita) rotulo = { nome: 'Coletado', classe: 'concluido' }
              if (proxima) rotulo = { nome: 'Próxima', classe: 'iniciado' }

              return (
                <li key={parada.id} className={proxima ? 'proxima' : ''}>
                  <span className={`ped-numero ${feita ? 'feita' : proxima ? 'proxima' : ''}`}>
                    {feita ? <Icone nome="check" tamanho={12} /> : `E${indice + 1}`}
                  </span>
                  <span className="ped-posicao">{parada.codigo}</span>
                  <span className="ped-produto">{parada.produto}</span>
                  <span className="ped-qtd">{parada.quantidade} un</span>
                  <span className={`dash-status ${rotulo.classe}`}>{rotulo.nome}</span>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

export default Pedidos
