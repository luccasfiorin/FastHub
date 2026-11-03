import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import PlantaArmazem from './PlantaArmazem'
import {
  AREA,
  NIVEIS_POR_ESTANTE,
  PLANTA,
  coletoresExemplo,
  corDoColetor,
  divergencias,
  emMetros,
  faixasOcupacao,
  lerCodigo,
  posicoes,
} from './dadosMapa'
import { calcularRota } from '../../utils/rota'
import './Mapa.css'

// Por enquanto a tela usa dados de exemplo (dadosMapa.js).
// As rotas são calculadas com o mesmo algoritmo da tela de Pedidos (vizinho mais próximo).

const camadasDoMapa = [
  { id: 'ocupacao', nome: 'Ocupação', icone: 'camadas' },
  { id: 'rotas', nome: 'Rotas ativas', icone: 'rotas' },
  { id: 'coletores', nome: 'Coletores', icone: 'usuario' },
  { id: 'alertas', nome: 'Alertas', icone: 'aviso' },
]

const nomesFaixa = {
  vazia: 'Posição vazia',
  baixa: 'Ocupação baixa',
  media: 'Ocupação média',
  cheia: 'Posição cheia',
}

// Coletores com pedido aberto: quem já começou aparece na última posição coletada,
// quem ainda não saiu fica aguardando na doca.
function montarColetores() {
  const coletores = coletoresExemplo.map((coletor, i) => {
    const paradas = coletor.paradas.map((p) => {
      const local = lerCodigo(p.codigo)
      return { ...p, local, ponto: emMetros(local), coletada: Boolean(p.coletadaEm) }
    })
    const rota = calcularRota(paradas)
    const feitas = rota.paradas.filter((p) => p.coletada).length

    return {
      pedido: coletor.pedido,
      nome: coletor.nome,
      paradas: rota.paradas,
      feitas,
      aguardando: feitas === 0,
      cor: corDoColetor(coletor.nome, i),
    }
  })

  // afasta um pouco as linhas de cada coletor para não ficarem uma em cima da outra
  const andando = coletores.filter((c) => !c.aguardando)
  return coletores.map((c) => {
    const indice = andando.indexOf(c)
    return { ...c, desvio: indice < 0 ? 0 : (indice - (andando.length - 1) / 2) * 5 }
  })
}

const coletoresNoMapa = montarColetores()
const ocupadas = posicoes.filter((p) => p.ocupacao > 0).length
const percentualOcupado = Math.round((ocupadas / posicoes.length) * 100)

const alertasDoTopo = divergencias.map((d) => ({
  id: d.codigo,
  text: `Divergência de lote em ${d.codigo} · pedido #${d.pedido}`,
  at: d.registradaEm,
}))

function formatarAltura(metros) {
  return `${metros.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
}

function Mapa({ usuario, onNavegar, onSair }) {
  const [busca, setBusca] = useState('')
  const [camadas, setCamadas] = useState({ ocupacao: true, rotas: true, coletores: true, alertas: false })
  const [selecionada, setSelecionada] = useState('B-14')
  const [rotaSelecionada, setRotaSelecionada] = useState('4822')

  const posicao = posicoes.find((p) => p.codigo === selecionada)
  const termo = busca.trim().toLowerCase()

  function alternarCamada(id) {
    setCamadas((atual) => ({ ...atual, [id]: !atual[id] }))
  }

  return (
    <div className="dashboard">
      <Sidebar ativo="mapa" onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Mapa do armazém"
          subtitulo={`${AREA} · ${PLANTA.corredores.length} corredores · ${posicoes.length} posições`}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
          alertas={alertasDoTopo}
        />

        <main className="dash-conteudo">
          <div className="col-aviso demo">
            Prévia com dados de exemplo. A ocupação vai usar a API quando existir o estoque por posição.
          </div>

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
                <select defaultValue={AREA}>
                  <option value={AREA}>{AREA}</option>
                </select>
              </label>
              <button type="button" className="arm-btn-secundario" onClick={() => onNavegar('configuracoes')}>
                <Icone nome="editar" tamanho={15} />
                Editar planta
              </button>
            </div>
          </div>

          <div className="arm-grade">
            <section className="dash-card arm-mapa-card">
              <div className="arm-mapa-topo">
                <h2>Visão em planta</h2>
                <span className="arm-atualizado">Atualizado agora</span>
              </div>

              <PlantaArmazem
                posicoes={posicoes}
                selecionada={selecionada}
                onSelecionar={setSelecionada}
                camadas={camadas}
                coletores={coletoresNoMapa}
                rotaSelecionada={rotaSelecionada}
                onSelecionarRota={setRotaSelecionada}
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
                    Divergência de lote
                  </span>
                ) : (
                  <span className={`arm-selo ${posicao.faixa}`}>{nomesFaixa[posicao.faixa]}</span>
                )}

                <dl className="arm-detalhes">
                  <div>
                    <dt>Nível</dt>
                    <dd>
                      {posicao.nivel} de {NIVEIS_POR_ESTANTE}
                    </dd>
                  </div>
                  <div>
                    <dt>Altura</dt>
                    <dd>{formatarAltura(posicao.altura)}</dd>
                  </div>
                  <div>
                    <dt>Ocupação</dt>
                    <dd>{posicao.ocupacao}%</dd>
                  </div>
                  <div>
                    <dt>Último inventário</dt>
                    <dd>{posicao.ultimoInventario}</dd>
                  </div>
                </dl>

                <h3>Produtos nesta posição</h3>
                {posicao.produtos.length === 0 ? (
                  <p className="arm-sem-produtos">Nenhum produto guardado aqui.</p>
                ) : (
                  <ul className="arm-produtos">
                    {posicao.produtos.map((produto) => (
                      <li key={`${produto.nome}-${produto.lote}`}>
                        <div>
                          <strong>{produto.nome}</strong>
                          <small>Lote {produto.lote}</small>
                        </div>
                        <span>{produto.quantidade} un</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="arm-posicao-acoes">
                  <button type="button" className="arm-btn-secundario" title="Em breve">
                    Ver histórico
                  </button>
                  <button type="button" className="arm-btn-principal" title="Em breve">
                    Abrir inventário
                  </button>
                </div>
              </section>

              {divergencias.map((d) => (
                <section key={d.codigo} className="dash-card arm-alerta">
                  <strong>
                    <Icone nome="aviso" tamanho={16} />
                    Divergência na bipagem
                  </strong>
                  <p>{d.texto}</p>
                  <button type="button" className="dash-chip perigo" onClick={() => onNavegar('relatorios')}>
                    Ver ocorrência
                  </button>
                </section>
              ))}

              <section className="dash-card arm-ocupacao">
                <span className="arm-rotulo">Ocupação geral</span>
                <strong>{percentualOcupado}%</strong>
                <small>
                  {ocupadas} de {posicoes.length} posições ocupadas
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
