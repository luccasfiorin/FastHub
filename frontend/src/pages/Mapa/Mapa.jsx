import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import PlantaArmazem from './PlantaArmazem'
import { corDoColetor, faixasOcupacao, montarPlanta, montarPosicoes } from './planta'
import {
  buscarConfiguracoes,
  buscarRotaPedido,
  listarColetores,
  listarDivergencias,
  listarPedidosPorStatus,
  listarPosicoes,
  listarProdutos,
} from '../../services/api'
import { formatarHora } from '../../utils/formatar'
import { atualizarPeriodicamente } from '../../utils/atualizacao'
import './Mapa.css'

// Mapa do armazém com dados do banco: posições, produtos guardados, divergências abertas
// e a rota (calculada no backend) de cada pedido em andamento. Atualiza a cada 5 s, só com a aba visível.

const camadasDoMapa = [
  { id: 'ocupacao', nome: 'Ocupação', icone: 'camadas' },
  { id: 'rotas', nome: 'Rotas ativas', icone: 'rotas' },
  { id: 'coletores', nome: 'Coletores', icone: 'usuario' },
  { id: 'alertas', nome: 'Alertas', icone: 'aviso' },
]

const nomesFaixa = {
  vazia: 'Sem produto',
  cheia: 'Com produto',
}

function pontos(lista) {
  return (lista ?? []).map((p) => ({ x: Number(p.x), y: Number(p.y) }))
}

// Paradas da rota da API, com o trecho (em metros) que o backend calculou desde a parada anterior.
function paradasDaRota(rota) {
  return rota.stops.map((stop) => ({
    codigo: stop.code,
    coletada: stop.picked,
    ponto: { x: Number(stop.point.x), y: Number(stop.point.y) },
    trecho: pontos(stop.path_from_previous),
  }))
}

// Coletores com pedido aberto: quem já começou aparece na última posição coletada,
// quem ainda não saiu (pedido atribuído e não iniciado) fica aguardando na doca.
async function buscarColetoresNoMapa(tiposPorColetor) {
  const [emAndamento, pendentes] = await Promise.all([
    listarPedidosPorStatus('in_progress'),
    listarPedidosPorStatus('pending'),
  ])

  // doca e travessas vêm junto com a rota; sem pedido em andamento, ficam no padrão
  let geometria = null

  const andando = await Promise.all(
    emAndamento
      .filter((p) => p.picker)
      .map(async (pedido) => {
        const rota = await buscarRotaPedido(pedido.id)
        geometria ??= { doca: { x: Number(rota.dock.x), y: Number(rota.dock.y) }, travessas: (rota.cross_aisles_y ?? []).map(Number) }
        // operador de empilhadeira segue a rota dos itens grandes; os demais, a rota a pé
        const usaEmpilhadeira = tiposPorColetor.get(pedido.picker.id) === 'forklift' && rota.forklift_route
        const trecho = usaEmpilhadeira ? rota.forklift_route : rota
        return {
          pedido: pedido.order_number,
          nome: pedido.picker.name,
          paradas: paradasDaRota(trecho),
          retorno: pontos(trecho.return_path),
          feitas: trecho.picked_stops,
          aguardando: false,
        }
      }),
  )

  const naDoca = pendentes
    .filter((p) => p.picker)
    .map((pedido) => ({
      pedido: pedido.order_number,
      nome: pedido.picker.name,
      paradas: [],
      retorno: [],
      feitas: 0,
      aguardando: true,
    }))

  const todos = [...andando, ...naDoca].map((c, i) => ({ ...c, cor: corDoColetor(i) }))

  // afasta um pouco as linhas de cada coletor para não ficarem uma em cima da outra
  const emRota = todos.filter((c) => !c.aguardando)
  const coletores = todos.map((c) => {
    const indice = emRota.indexOf(c)
    return { ...c, desvio: indice < 0 ? 0 : (indice - (emRota.length - 1) / 2) * 5 }
  })
  return { coletores, geometria }
}

function useMapa() {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let ativo = true

    async function buscar() {
      try {
        const [locations, produtos, divergencias, configuracoes, coletores] = await Promise.all([
          listarPosicoes(),
          listarProdutos(),
          listarDivergencias({ abertas: true }),
          buscarConfiguracoes(),
          listarColetores(),
        ])
        const planta = montarPlanta(locations)
        const tipos = new Map(coletores.pickers.map((c) => [c.id, c.picker_type]))
        const noMapa = await buscarColetoresNoMapa(tipos)

        if (!ativo) return
        setDados({
          planta,
          posicoes: montarPosicoes(locations, produtos, divergencias, planta, configuracoes.settings),
          divergencias,
          config: configuracoes.settings,
          coletores: noMapa.coletores,
          geometria: noMapa.geometria,
        })
        setErro('')
      } catch (e) {
        if (ativo) setErro(e.message)
      }
    }

    // a cada 5 s, só com a aba visível; uma busca lenta não empilha outra por cima
    const desligar = atualizarPeriodicamente(buscar)
    return () => {
      ativo = false
      desligar()
    }
  }, [versao])

  return { dados, erro, recarregar: () => setVersao((v) => v + 1) }
}

function formatarAltura(metros) {
  return `${metros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
}

function textoDivergencia(d) {
  const quem = d.picker ?? 'O coletor'
  const produto = d.product ? ` (${d.product})` : ''
  return `${quem} bipou um código que não confere com o item${produto} do pedido ${d.order_number}, às ${formatarHora(d.at)}.`
}

function Mapa({ usuario, onNavegar, onSair }) {
  const { dados, erro, recarregar } = useMapa()
  const [busca, setBusca] = useState('')
  const [camadas, setCamadas] = useState({ ocupacao: true, rotas: true, coletores: true, alertas: false })
  const [selecionadaId, setSelecionadaId] = useState(null)
  const [rotaEscolhida, setRotaEscolhida] = useState(null)

  const termo = busca.trim().toLowerCase()

  const alertasDoTopo = useMemo(
    () =>
      (dados?.divergencias ?? []).map((d) => ({
        id: d.id,
        text: `Divergência em ${d.location ?? 'posição não informada'} · pedido ${d.order_number}`,
        at: d.at,
      })),
    [dados],
  )

  function alternarCamada(id) {
    setCamadas((atual) => ({ ...atual, [id]: !atual[id] }))
  }

  const area = dados?.config.warehouse_name ?? ''
  const subtitulo = dados
    ? `${area} · ${dados.planta.corredores.length} corredores · ${dados.posicoes.length} posições`
    : 'Carregando...'

  const cabecalho = (
    <Header
      titulo="Mapa do armazém"
      subtitulo={subtitulo}
      usuario={usuario}
      busca={busca}
      onBusca={setBusca}
      alertas={alertasDoTopo}
    />
  )

  if (!dados) {
    return (
      <div className="dashboard">
        <Sidebar ativo="mapa" onNavegar={onNavegar} onSair={onSair} />
        <div className="dash-principal">
          {cabecalho}
          <main className="dash-conteudo">
            {erro ? (
              <div className="col-aviso erro">
                {erro}
                <button type="button" onClick={recarregar}>
                  Tentar de novo
                </button>
              </div>
            ) : (
              <p className="col-aviso">Carregando o mapa...</p>
            )}
          </main>
        </div>
      </div>
    )
  }

  const { planta, posicoes, divergencias, coletores } = dados

  if (posicoes.length === 0) {
    return (
      <div className="dashboard">
        <Sidebar ativo="mapa" onNavegar={onNavegar} onSair={onSair} />
        <div className="dash-principal">
          {cabecalho}
          <main className="dash-conteudo">
            <div className="col-vazio">
              <strong>Nenhuma posição cadastrada</strong>
              <p>Cadastre corredores e posições para ver a planta do armazém.</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const padrao = posicoes.find((p) => p.divergencia) ?? posicoes.find((p) => p.ocupada) ?? posicoes[0]
  const posicao = posicoes.find((p) => p.id === selecionadaId) ?? padrao
  const rotaSelecionada = coletores.some((c) => c.pedido === rotaEscolhida)
    ? rotaEscolhida
    : (coletores.find((c) => !c.aguardando)?.pedido ?? null)

  const ocupadas = posicoes.filter((p) => p.ocupada).length
  const percentualOcupado = Math.round((ocupadas / posicoes.length) * 100)

  return (
    <div className="dashboard">
      <Sidebar ativo="mapa" onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        {cabecalho}

        <main className="dash-conteudo">
          {erro && (
            <div className="col-aviso erro">
              Não foi possível atualizar agora: {erro}
              <button type="button" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          )}

          <div className="arm-barra">
            <div className="arm-camadas" role="group" aria-label="Camadas do mapa">
              {camadasDoMapa.map((camada) => (
                <button
                  key={camada.id}
                  type="button"
                  aria-pressed={camadas[camada.id]}
                  className={camadas[camada.id] ? 'ativo' : ''}
                  onClick={() => alternarCamada(camada.id)}
                >
                  <Icone nome={camada.icone} tamanho={16} />
                  {camada.nome}
                </button>
              ))}
            </div>

            <div className="arm-barra-direita">
              <label className="arm-area">
                <span>Área:</span>
                <select value={area} onChange={() => {}}>
                  <option value={area}>{area}</option>
                </select>
              </label>
              <button type="button" className="arm-btn-secundario" onClick={() => onNavegar('configuracoes')}>
                <Icone nome="editar" tamanho={15} />
                Configurações
              </button>
            </div>
          </div>

          <div className="arm-grade">
            <section className="dash-card arm-mapa-card">
              <div className="arm-mapa-topo">
                <h2>Visão em planta</h2>
                <span className="arm-atualizado">Atualiza a cada 5 s</span>
              </div>

              <PlantaArmazem
                planta={planta}
                geometria={dados.geometria}
                posicoes={posicoes}
                selecionada={posicao.id}
                onSelecionar={setSelecionadaId}
                camadas={camadas}
                coletores={coletores}
                rotaSelecionada={rotaSelecionada}
                onSelecionarRota={setRotaEscolhida}
                termo={termo}
              />

              <ul className="arm-legenda">
                <li className="arm-legenda-titulo">Ocupação</li>
                {faixasOcupacao.map((faixa) => (
                  <li key={faixa.id}>
                    <span className={`arm-legenda-cor ${faixa.id}`} />
                    {faixa.nome}
                  </li>
                ))}
              </ul>
            </section>

            <div className="arm-lateral">
              <section className="dash-card arm-posicao" aria-live="polite">
                <span className="arm-rotulo">Posição selecionada</span>
                <h2>
                  Corredor {posicao.letra} · Posição {posicao.posicao}
                </h2>
                {posicao.divergencia ? (
                  <span className="arm-selo perigo">
                    <Icone nome="aviso" tamanho={13} />
                    Divergência na bipagem
                  </span>
                ) : (
                  <span className={`arm-selo ${posicao.faixa}`}>{nomesFaixa[posicao.faixa]}</span>
                )}

                <dl className="arm-detalhes">
                  <div>
                    <dt>Código</dt>
                    <dd>{posicao.codigo}</dd>
                  </div>
                  <div>
                    <dt>Nível</dt>
                    <dd>
                      {posicao.nivel == null ? '—' : `${posicao.nivel} de ${dados.config.levels_per_rack}`}
                    </dd>
                  </div>
                  <div>
                    <dt>Altura</dt>
                    <dd>{formatarAltura(posicao.altura)}</dd>
                  </div>
                  <div>
                    <dt>Produtos</dt>
                    <dd>{posicao.produtos.length}</dd>
                  </div>
                </dl>

                <h3>Produtos nesta posição</h3>
                {posicao.produtos.length === 0 ? (
                  <p className="arm-sem-produtos">Nenhum produto cadastrado nesta posição.</p>
                ) : (
                  <ul className="arm-produtos">
                    {posicao.produtos.map((produto) => (
                      <li key={produto.id}>
                        <div>
                          <strong>{produto.nome}</strong>
                          <small>
                            SKU {produto.sku}
                            {produto.lote ? ` · Lote ${produto.lote}` : ''}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {divergencias.map((d) => (
                <section key={d.id} className="dash-card arm-alerta">
                  <strong>
                    <Icone nome="aviso" tamanho={16} />
                    Divergência na bipagem{d.location ? ` · ${d.location}` : ''}
                  </strong>
                  <p>{textoDivergencia(d)}</p>
                  <button type="button" className="dash-chip perigo" onClick={() => onNavegar('relatorios')}>
                    Ver ocorrência
                  </button>
                </section>
              ))}

              <section className="dash-card arm-ocupacao">
                <span className="arm-rotulo">Posições com produto</span>
                <strong>{percentualOcupado}%</strong>
                <small>
                  {ocupadas} de {posicoes.length} posições têm produto cadastrado
                </small>
                <div className="arm-ocupacao-barra">
                  <span style={{ width: `${percentualOcupado}%` }} />
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Mapa
