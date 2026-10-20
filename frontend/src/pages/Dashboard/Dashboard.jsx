import { useState } from 'react'
import Icone from '../../components/Icone'
import MapaArmazem from './MapaArmazem'
import GraficoPedidos from './GraficoPedidos'
import {
  menu,
  indicadores,
  pedidos,
  nomesStatus,
  filtros,
  coletores,
  nomesEstado,
  alertas,
  eficienciaRota,
} from './dados'
import './Dashboard.css'

function dataDeHoje() {
  const agora = new Date()
  const texto = agora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const hora = agora.getHours()
  let turno = 'Turno da noite'
  if (hora >= 6 && hora < 12) turno = 'Turno da manhã'
  else if (hora >= 12 && hora < 18) turno = 'Turno da tarde'

  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} · ${turno}`
}

function Dashboard({ onSair }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [selecionado, setSelecionado] = useState('#4822')
  const [alertasAbertos, setAlertasAbertos] = useState(false)
  const [rotaLiberada, setRotaLiberada] = useState(false)

  const termo = busca.trim().toLowerCase()
  const pedidosFiltrados = pedidos.filter((pedido) => {
    const passaFiltro =
      filtro === 'todos' ||
      pedido.status === filtro ||
      (filtro === 'andamento' && pedido.status === 'iniciado')
    const passaBusca =
      !termo ||
      pedido.numero.toLowerCase().includes(termo) ||
      pedido.coletor.toLowerCase().includes(termo)
    return passaFiltro && passaBusca
  })

  const pedidoNoMapa = pedidos.find((pedido) => pedido.numero === selecionado)

  return (
    <div className="dashboard">
      <aside className="dash-sidebar">
        <span className="dash-logo">FastHub</span>
        <small className="dash-logo-sub">by Telecontrol</small>

        <nav className="dash-menu">
          {menu.map((item) => (
            <a
              key={item.id}
              href="#"
              className={`dash-menu-item ${item.id === 'inicio' ? 'ativo' : ''}`}
            >
              <Icone nome={item.id} className="dash-menu-icone" />
              {item.nome}
              {item.contador && <span className="dash-menu-contador">{item.contador}</span>}
            </a>
          ))}
        </nav>

        <div className="dash-erp">
          <span className="dash-erp-ponto" />
          <div>
            <strong>ERP conectado</strong>
            <small>Última sincronização há 4 min</small>
          </div>
        </div>

        <div className="dash-sidebar-rodape">
          <a href="#">
            <Icone nome="configuracoes" tamanho={16} />
            Configurações
          </a>
          <button type="button" onClick={onSair}>
            <Icone nome="sair" tamanho={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="dash-principal">
        <header className="dash-topo">
          <div>
            <h1>Olá, Luiz</h1>
            <p>{dataDeHoje()}</p>
          </div>

          <div className="dash-topo-acoes">
            <label className="dash-busca">
              <Icone nome="busca" tamanho={16} />
              <input
                type="search"
                placeholder="Buscar pedido, SKU ou coletor..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </label>

            <div className="dash-alerta-area">
              <button
                type="button"
                className="dash-alerta"
                aria-label="Alertas"
                aria-expanded={alertasAbertos}
                onClick={() => setAlertasAbertos(!alertasAbertos)}
              >
                !
              </button>

              {alertasAbertos && (
                <div className="dash-alertas">
                  <strong>Alertas recentes</strong>
                  <ul>
                    {alertas.map((alerta) => (
                      <li key={alerta.texto}>
                        <span className={`dash-alertas-icone ${alerta.tipo}`}>
                          <Icone nome={alerta.tipo === 'info' ? 'info' : 'aviso'} tamanho={14} />
                        </span>
                        <div>
                          <p>{alerta.texto}</p>
                          <small>{alerta.tempo}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="dash-usuario">
              <span className="dash-avatar">LA</span>
              <div>
                <strong>Luiz A.</strong>
                <small>Gestor de estoque</small>
              </div>
            </div>
          </div>
        </header>

        <main className="dash-conteudo">
          <div className="dash-titulo">
            <h2>Visão geral da operação</h2>
            <button type="button" className="dash-btn-importar">
              <Icone nome="importar" tamanho={16} />
              Importar pedidos do ERP
            </button>
          </div>

          <section className="dash-indicadores">
            {indicadores.map((card) => (
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
                <h3>Pedidos em andamento</h3>
                <a href="#">
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
                      <th>ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosFiltrados.map((pedido) => (
                      <tr
                        key={pedido.numero}
                        className={pedido.numero === selecionado ? 'selecionado' : ''}
                        onClick={() => setSelecionado(pedido.numero)}
                        title="Ver rota no mapa"
                      >
                        <td className="dash-numero">{pedido.numero}</td>
                        <td>
                          <span className="dash-coletor">
                            <span className="dash-coletor-icone">
                              <Icone
                                nome={pedido.tipo === 'empilhadeira' ? 'empilhadeira' : 'usuario'}
                                tamanho={14}
                              />
                            </span>
                            {pedido.coletor}
                          </span>
                        </td>
                        <td className="dash-cinza">{pedido.itens}</td>
                        <td>
                          <div className="dash-progresso">
                            <div className={`dash-barra ${pedido.status}`}>
                              <span style={{ width: `${pedido.progresso}%` }} />
                            </div>
                            <small>{pedido.progresso}%</small>
                          </div>
                        </td>
                        <td>
                          <span className={`dash-status ${pedido.status}`}>
                            {nomesStatus[pedido.status]}
                          </span>
                        </td>
                        <td>{pedido.eta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {pedidosFiltrados.length === 0 && (
                  <p className="dash-vazio">Nenhum pedido encontrado para essa busca.</p>
                )}
              </div>
            </section>

            <section className="dash-card dash-mapa">
              <div className="dash-mapa-topo">
                <div>
                  <h3>Mapa do armazém · rota ativa</h3>
                  <p>
                    Pedido {pedidoNoMapa.numero} · {pedidoNoMapa.coletor} · {pedidoNoMapa.itens}{' '}
                    itens
                  </p>
                </div>
                <span className="dash-mapa-ao-vivo">Ao vivo</span>
              </div>
              <MapaArmazem pedido={pedidoNoMapa} />
            </section>
          </div>

          <div className="dash-destaques">
            <article className="dash-card dash-destaque">
              <span className="dash-destaque-rotulo">
                <Icone nome="rotas" tamanho={15} />
                Eficiência de rota
              </span>
              {eficienciaRota ? (
                <>
                  <strong>−{eficienciaRota.reducao}% distância percorrida</strong>
                  <small>Comparado ao roteiro por lista de papel</small>
                  <div className="dash-destaque-barra">
                    <span style={{ width: `${100 - eficienciaRota.reducao}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <strong className="dash-sem-dados">—</strong>
                  <small>Aguardando dados da API</small>
                  <div className="dash-destaque-barra" />
                </>
              )}
            </article>

            <article className="dash-card dash-destaque">
              <span className="dash-destaque-rotulo">
                <Icone nome="empilhadeira" tamanho={15} />
                Rotas com empilhadeira
              </span>
              <strong>{rotaLiberada ? '2 aguardando' : '3 aguardando'}</strong>
              <small>Itens acima de 1,5 m agrupados em rota dedicada</small>
              <button
                type="button"
                className={`dash-chip ${rotaLiberada ? 'liberada' : ''}`}
                onClick={() => setRotaLiberada(true)}
                disabled={rotaLiberada}
              >
                {rotaLiberada ? (
                  <>
                    <Icone nome="check" tamanho={14} /> Rota liberada
                  </>
                ) : (
                  'Liberar rota'
                )}
              </button>
            </article>

            <article className="dash-card dash-destaque alerta">
              <span className="dash-destaque-rotulo">
                <Icone nome="aviso" tamanho={15} />
                Alerta de bipagem
              </span>
              <strong>Divergência de lote</strong>
              <small>Corredor B, Posição 14 · Pedido #4823</small>
              <button type="button" className="dash-chip perigo">
                Ver ocorrência
              </button>
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
              <GraficoPedidos />
            </section>

            <section className="dash-card dash-bloco">
              <div className="dash-bloco-topo">
                <h3>Coletores</h3>
                <a href="#">
                  Ver todos <Icone nome="seta" tamanho={14} />
                </a>
              </div>

              <ul className="dash-coletores">
                {coletores.map((coletor) => (
                  <li key={coletor.nome}>
                    <span className="dash-coletor-icone">
                      <Icone
                        nome={coletor.tipo === 'empilhadeira' ? 'empilhadeira' : 'usuario'}
                        tamanho={14}
                      />
                    </span>
                    <div className="dash-coletores-nome">
                      <strong>{coletor.nome}</strong>
                      <small className={`dash-estado ${coletor.estado}`}>
                        {nomesEstado[coletor.estado]}
                      </small>
                    </div>
                    <span className="dash-coletores-ritmo">
                      <strong>{coletor.itensHora}</strong> itens/h
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
