import { useState } from 'react'
import Icone from './Icone'
import { formatarHora, formatarKm, formatarPercentual, iniciais, semDado } from '../utils/formatar'

const nomesStatus = { active: 'Ativo', paused: 'Em pausa', offline: 'Offline' }

function funcao(coletor) {
  if (coletor.picker_type === 'forklift') {
    return coletor.operator_name ? `Operador: ${coletor.operator_name}` : 'Empilhadeira'
  }
  return 'Coleta a pé'
}

// Cor da barra de progresso: vermelha com divergência, verde quase pronto, amarela no resto.
function corDaBarra(pedido) {
  if (pedido?.has_mismatch) return 'erro'
  if (pedido?.progress >= 80) return 'ok'
  return 'atencao'
}

function CartaoColetor({ coletor, onEditar, onExcluir }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const pedido = coletor.current_order
  const ultimo = coletor.last_order
  const divergencia = pedido?.has_mismatch
  const tomBarra = corDaBarra(pedido)
  const offline = coletor.status === 'offline'

  return (
    <article className={`col-card ${divergencia ? 'divergente' : ''}`}>
      <div className="col-card-topo">
        <span className="col-avatar">
          {iniciais(coletor.name)}
          <i className={`col-ponto ${coletor.status}`} />
        </span>

        <div className="col-card-nome">
          <strong>
            {coletor.name}
            {coletor.is_demo && <em className="col-demo">Demo</em>}
          </strong>
          <small>{funcao(coletor)}</small>
        </div>

        <span className={`col-status ${coletor.status}`}>{nomesStatus[coletor.status]}</span>

        <div className="col-menu-area">
          <button
            type="button"
            className="col-menu-btn"
            aria-label={`Opções de ${coletor.name}`}
            aria-expanded={menuAberto}
            onClick={() => setMenuAberto(!menuAberto)}
          >
            <Icone nome="opcoes" tamanho={16} />
          </button>
          {menuAberto && (
            <div className="col-menu">
              <button
                type="button"
                onClick={() => {
                  setMenuAberto(false)
                  onEditar(coletor)
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="perigo"
                onClick={() => {
                  setMenuAberto(false)
                  onExcluir(coletor)
                }}
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`col-agora ${divergencia ? 'divergente' : ''}`}>
        <small>Agora</small>
        {pedido ? (
          <>
            <strong>
              {pedido.number} · {divergencia ? 'divergência' : `${pedido.picked}/${pedido.total} itens`}
            </strong>
            <div className="col-progresso">
              <div className="col-barra">
                <span className={tomBarra} style={{ width: `${pedido.progress}%` }} />
              </div>
              <small>{pedido.progress}%</small>
            </div>
          </>
        ) : (
          <strong>
            {ultimo
              ? `Último pedido ${ultimo.number} às ${formatarHora(ultimo.completed_at)}`
              : 'Sem pedido em andamento'}
          </strong>
        )}
      </div>

      <dl className="col-numeros">
        <div>
          <dt>Itens/h</dt>
          <dd>{coletor.metrics.items_per_hour == null ? semDado : Math.round(coletor.metrics.items_per_hour)}</dd>
        </div>
        <div>
          <dt>Acurácia</dt>
          <dd>{formatarPercentual(coletor.metrics.accuracy)}</dd>
        </div>
        <div>
          <dt>Distância</dt>
          <dd>{formatarKm(coletor.metrics.distance_km)}</dd>
        </div>
      </dl>

      <div className="col-acoes">
        <button type="button" disabled title="Em breve">
          {offline ? 'Ver histórico' : 'Ver no mapa'}
        </button>
        <button type="button" disabled title="Em breve">
          Enviar mensagem
        </button>
      </div>
    </article>
  )
}

export default CartaoColetor
