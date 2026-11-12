import { useState } from 'react'
import Icone from '../../components/Icone'
import { formatarHora } from '../../utils/formatar'
import { corredoresDoPedido, numeroPedido, progressoPedido } from '../../utils/coleta'

// Lista de pedidos do coletor (GET /picker/orders): o em andamento primeiro e depois a fila,
// cada pendente com o botão "Iniciar".
function PedidosColetor({ pedidoAtual, fila, carregando, onIniciar, onContinuar, onAtualizar }) {
  const [iniciando, setIniciando] = useState(null)
  const [erros, setErros] = useState({})
  const [atualizando, setAtualizando] = useState(false)

  async function iniciar(pedido) {
    setIniciando(pedido.id)
    setErros((atual) => ({ ...atual, [pedido.id]: '' }))
    try {
      await onIniciar(pedido)
    } catch (e) {
      setErros((atual) => ({ ...atual, [pedido.id]: e.message }))
      onAtualizar()
    } finally {
      setIniciando(null)
    }
  }

  async function atualizar() {
    setAtualizando(true)
    await onAtualizar()
    setAtualizando(false)
  }

  return (
    <div className="clt-pedidos">
      <div className="clt-titulo-secao">
        <div>
          <h1>Meus pedidos</h1>
          <p className="clt-texto-fraco">
            {pedidoAtual ? '1 em andamento · ' : ''}
            {fila.length} na fila
          </p>
        </div>
        <button type="button" className="clt-botao secundario" onClick={atualizar} disabled={atualizando}>
          {atualizando ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {carregando && <p className="clt-texto-fraco">Carregando seus pedidos...</p>}

      {pedidoAtual && (
        <>
          <h2 className="clt-subtitulo">Em andamento</h2>
          <CartaoPedido pedido={pedidoAtual} emAndamento>
            <button type="button" className="clt-botao principal largo" onClick={onContinuar}>
              Continuar coleta
              <Icone nome="seta" tamanho={18} />
            </button>
          </CartaoPedido>
        </>
      )}

      {!carregando && (
        <>
          <h2 className="clt-subtitulo">Na fila</h2>
          {fila.length === 0 && (
            <div className="clt-vazio">
              <strong>Fila vazia</strong>
              <p>Assim que o gestor atribuir um pedido a você, ele aparece aqui.</p>
            </div>
          )}

          <ul className="clt-lista-pedidos">
            {fila.map((pedido) => (
              <li key={pedido.id}>
                <CartaoPedido pedido={pedido}>
                  {erros[pedido.id] && (
                    <p className="clt-aviso erro" role="alert">
                      {erros[pedido.id]}
                    </p>
                  )}
                  <button
                    type="button"
                    className="clt-botao principal largo"
                    disabled={Boolean(pedidoAtual) || iniciando !== null}
                    onClick={() => iniciar(pedido)}
                  >
                    <Icone nome="play" tamanho={16} />
                    {iniciando === pedido.id ? 'Iniciando...' : 'Iniciar'}
                  </button>
                  {pedidoAtual && (
                    <p className="clt-dica">Conclua o pedido em andamento antes de iniciar outro.</p>
                  )}
                </CartaoPedido>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CartaoPedido({ pedido, emAndamento = false, children }) {
  const progresso = progressoPedido(pedido)
  const itens = pedido.items?.length ?? 0

  return (
    <article className={`clt-card clt-pedido ${emAndamento ? 'em-andamento' : ''}`}>
      <div className="clt-pedido-topo">
        <strong className="clt-numero">{numeroPedido(pedido)}</strong>
        {pedido.requires_forklift && (
          <span className="clt-tag empilhadeira" title="Tem itens grandes, coletados com empilhadeira">
            <Icone nome="empilhadeira" tamanho={14} /> Empilhadeira
          </span>
        )}
        <span className={`clt-tag ${emAndamento ? 'andamento' : 'pendente'}`}>
          {emAndamento ? 'Em andamento' : 'Pendente'}
        </span>
      </div>

      <dl className="clt-pedido-dados">
        <div>
          <dt>Itens</dt>
          <dd>
            {itens} {itens === 1 ? 'produto' : 'produtos'} · {progresso.total} un.
          </dd>
        </div>
        <div>
          <dt>Corredores</dt>
          <dd>{corredoresDoPedido(pedido) || '—'}</dd>
        </div>
        <div>
          <dt>{emAndamento ? 'Iniciado' : 'Criado'}</dt>
          <dd>{formatarHora(emAndamento && pedido.started_at ? pedido.started_at : pedido.created_at)}</dd>
        </div>
      </dl>

      {emAndamento && (
        <>
          <div className="clt-barra" aria-hidden="true">
            <span style={{ width: `${progresso.percentual}%` }} />
          </div>
          <p className="clt-atual-numeros">
            <span>
              {progresso.coletados} de {progresso.total} un. coletadas
            </span>
            <span>{progresso.percentual}%</span>
          </p>
        </>
      )}

      {children}
    </article>
  )
}

export default PedidosColetor
