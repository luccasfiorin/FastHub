import { useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import MapaRota from './MapaRota'
import { pedidosExemplo } from './dadosPedidos'
import { calcularRota, distancia, DOCA, lerCodigoPosicao } from '../../utils/rota'
import { formatarHora } from '../../utils/formatar'
import './Pedidos.css'

// Por enquanto a tela usa dados de exemplo (dadosPedidos.js).
// Quando a API tiver GET /api/orders, trocar `pedidosExemplo` pela resposta.

const filtros = [
  { id: 'todos', nome: 'Todos' },
  { id: 'aguardando', nome: 'Aguardando' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'concluidos', nome: 'Concluídos' },
  { id: 'divergencia', nome: 'Com divergência', icone: 'aviso', classe: 'perigo' },
  { id: 'empilhadeira', nome: 'Empilhadeira', icone: 'empilhadeira' },
]

const PARADAS_VISIVEIS = 6

function codigoPosicao(location) {
  return `${location.aisle.code}-${String(location.position).padStart(2, '0')}`
}

function contarItens(pedido) {
  const total = pedido.items.reduce((soma, i) => soma + i.quantity, 0)
  const coletados = pedido.items.reduce((soma, i) => soma + i.picked_quantity, 0)
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

// Monta as paradas do pedido e calcula a rota pelo vizinho mais próximo.
function montarRota(pedido) {
  const paradas = pedido.items.map((item, i) => {
    const codigo = codigoPosicao(item.location)
    return {
      id: `${pedido.id}-${i}`,
      codigo,
      produto: item.product.name,
      quantidade: item.quantity,
      coletada: item.is_picked,
      coletadaEm: item.picked_at,
      ponto: lerCodigoPosicao(codigo),
    }
  })

  const rota = calcularRota(paradas)
  const feitas = rota.paradas.filter((p) => p.coletada).length

  // metros que ainda faltam: da última parada feita até o fim, voltando para a doca
  let metrosFaltando = 0
  let anterior = feitas ? rota.paradas[feitas - 1].ponto : DOCA
  for (const parada of rota.paradas.slice(feitas)) {
    metrosFaltando += distancia(anterior, parada.ponto)
    anterior = parada.ponto
  }
  metrosFaltando += distancia(anterior, DOCA)

  // estimativa simples: 1 m/s andando + 20 s por item para pegar e bipar
  const itensFaltando = rota.paradas.slice(feitas).reduce((soma, p) => soma + p.quantidade, 0)
  const minutosFaltando = Math.max(1, Math.round((metrosFaltando + itensFaltando * 20) / 60))

  return { ...rota, feitas, minutosFaltando }
}

function Pedidos({ usuario, onNavegar, onSair }) {
  const pedidos = pedidosExemplo
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [selecionadoId, setSelecionadoId] = useState(4822)
  const [verTodasParadas, setVerTodasParadas] = useState(false)

  const contagem = useMemo(() => {
    const resultado = {}
    for (const item of filtros) {
      resultado[item.id] = pedidos.filter((p) => passaNoFiltro(p, item.id)).length
    }
    return resultado
  }, [pedidos])

  const termo = busca.trim().toLowerCase()
  const visiveis = pedidos.filter(
    (p) =>
      passaNoFiltro(p, filtro) &&
      (!termo ||
        p.order_number.includes(termo.replace('#', '')) ||
        p.customer_name.toLowerCase().includes(termo) ||
        p.picker?.name.toLowerCase().includes(termo)),
  )

  const selecionado = pedidos.find((p) => p.id === selecionadoId) ?? null
  const rota = useMemo(() => (selecionado ? montarRota(selecionado) : null), [selecionado])
  const abertos = pedidos.filter((p) => p.status !== 'completed' && p.status !== 'cancelled').length
  const emAndamento = pedidos.filter((p) => p.status === 'in_progress').length

  function selecionar(pedido) {
    setSelecionadoId(pedido.id)
    setVerTodasParadas(false)
  }

  return (
    <div className="dashboard">
      <Sidebar ativo="pedidos" pedidosAbertos={abertos} onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Pedidos"
          subtitulo={`${pedidos.length} pedidos hoje · ${emAndamento} em andamento`}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
        />

        <main className="dash-conteudo">
          <div className="col-aviso demo">
            Prévia com dados de exemplo. A lista vai usar a API quando existir a rota de listagem de pedidos.
          </div>

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

            <button type="button" className="col-adicionar" title="Em breve">
              + Novo pedido
            </button>
          </div>

          <div className="ped-grade">
            <section className="dash-card ped-lista" aria-label="Lista de pedidos">
              {visiveis.length === 0 && <p className="dash-vazio">Nenhum pedido encontrado para esse filtro ou busca.</p>}

              <ul>
                {visiveis.map((pedido) => {
                  const status = situacao(pedido)
                  const itens = contarItens(pedido)
                  const ativo = pedido.id === selecionadoId
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
                          <strong>#{pedido.order_number}</strong>
                          <span className="ped-cliente">{pedido.customer_name}</span>
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
                verTodas={verTodasParadas}
                onVerTodas={() => setVerTodasParadas(!verTodasParadas)}
              />
            ) : (
              <section className="dash-card ped-painel ped-painel-vazio">
                <Icone nome="rotas" tamanho={28} />
                <p>Selecione um pedido na lista para ver a rota.</p>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PainelRota({ pedido, rota, verTodas, onVerTodas }) {
  const status = situacao(pedido)
  const itens = contarItens(pedido)
  const concluido = pedido.status === 'completed'
  const total = rota.paradas.length

  // mostra a partir da última parada feita, para dar contexto de onde o coletor está
  const inicio = verTodas ? 0 : Math.max(0, Math.min(rota.feitas - 1, total - PARADAS_VISIVEIS))
  const lista = verTodas ? rota.paradas : rota.paradas.slice(inicio, inicio + PARADAS_VISIVEIS)

  let previsao = `${rota.minutosFaltando} min`
  if (concluido) previsao = 'Concluído'
  else if (pedido.status === 'pending') previsao = `≈ ${rota.minutosFaltando} min`

  return (
    <section className="dash-card ped-painel" aria-label={`Rota do pedido ${pedido.order_number}`}>
      <div className="ped-painel-topo">
        <div>
          <div className="ped-painel-titulo">
            <h2>Pedido #{pedido.order_number}</h2>
            <span className={`dash-status ${status.classe} ped-status`}>
              {status.icone && <Icone nome={status.icone} tamanho={12} />}
              {status.nome}
            </span>
          </div>
          <p>
            {pedido.customer_name} · criado às {formatarHora(pedido.created_at)}
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
          <dt>Distância</dt>
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
          <strong>{pedido.status === 'pending' ? 'Rota sugerida' : 'Rota pelo vizinho mais próximo'}</strong>
          {pedido.status === 'in_progress' && <span className="ped-ao-vivo">Ao vivo</span>}
        </div>
        <MapaRota paradas={rota.paradas} feitas={rota.feitas} concluido={concluido} />
      </div>

      <div className="ped-paradas-topo">
        <h3>{verTodas || concluido ? 'Todas as paradas' : 'Próximas paradas'}</h3>
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
    </section>
  )
}

export default Pedidos
