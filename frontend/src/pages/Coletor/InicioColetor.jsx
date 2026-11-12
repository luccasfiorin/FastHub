import Icone from '../../components/Icone'
import { formatarHora, turnoAtual } from '../../utils/formatar'
import {
  corredoresDoPedido,
  duracaoEmMinutos,
  numeroPedido,
  primeiroNome,
  progressoPedido,
  resumoDoDia,
} from '../../utils/coleta'

function dataDeHoje() {
  const texto = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const frasesStatus = {
  active: 'Você está ativo e recebendo pedidos.',
  paused: 'Você está em pausa.',
  offline: 'Você está offline. Toque em "Ficar ativo" para começar.',
}

// Início do coletor: pedido em andamento, números do dia e o que já foi concluído hoje.
function InicioColetor({ usuario, status, pedidoAtual, fila, concluidos, carregando, onIrPara }) {
  const resumo = resumoDoDia(concluidos, pedidoAtual)
  const progresso = pedidoAtual ? progressoPedido(pedidoAtual) : null

  return (
    <div className="clt-inicio">
      <section className="clt-saudacao">
        <h1>Olá, {primeiroNome(usuario.name)}!</h1>
        <p>
          {dataDeHoje()} · {turnoAtual()}
        </p>
        <p className={`clt-saudacao-status ${status}`}>{frasesStatus[status] ?? ''}</p>
      </section>

      <section className="clt-card clt-atual" aria-label="Pedido em andamento">
        <div className="clt-card-topo">
          <h2>Pedido em andamento</h2>
          {pedidoAtual?.requires_forklift && (
            <span className="clt-tag empilhadeira">
              <Icone nome="empilhadeira" tamanho={14} /> Empilhadeira
            </span>
          )}
        </div>

        {carregando && <p className="clt-texto-fraco">Carregando seus pedidos...</p>}

        {!carregando && pedidoAtual && (
          <>
            <div className="clt-atual-linha">
              <strong className="clt-numero-grande">{numeroPedido(pedidoAtual)}</strong>
              <span className="clt-texto-fraco">
                {pedidoAtual.started_at ? `iniciado às ${formatarHora(pedidoAtual.started_at)}` : 'iniciado'}
              </span>
            </div>

            <div className="clt-barra" aria-hidden="true">
              <span style={{ width: `${progresso.percentual}%` }} />
            </div>
            <p className="clt-atual-numeros">
              <strong>
                {progresso.coletados} de {progresso.total} unidades
              </strong>
              <span>{progresso.percentual}%</span>
            </p>
            <p className="clt-texto-fraco">
              {progresso.itensFaltando > 0
                ? `${progresso.itensFaltando} ${progresso.itensFaltando === 1 ? 'item falta' : 'itens faltam'} · corredores ${corredoresDoPedido(pedidoAtual)}`
                : 'Todos os itens coletados. Falta concluir o pedido.'}
            </p>

            <button type="button" className="clt-botao principal largo" onClick={() => onIrPara('coleta')}>
              Continuar coleta
              <Icone nome="seta" tamanho={18} />
            </button>
          </>
        )}

        {!carregando && !pedidoAtual && (
          <div className="clt-atual-vazio">
            <p>
              {fila.length > 0
                ? `Nenhum pedido em andamento. Você tem ${fila.length} ${fila.length === 1 ? 'pedido' : 'pedidos'} na fila.`
                : 'Nenhum pedido em andamento e a fila está vazia. Assim que o gestor atribuir um pedido, ele aparece aqui.'}
            </p>
            {fila.length > 0 && (
              <button type="button" className="clt-botao principal largo" onClick={() => onIrPara('pedidos')}>
                Ver fila de pedidos
                <Icone nome="seta" tamanho={18} />
              </button>
            )}
          </div>
        )}
      </section>

      <section className="clt-metricas" aria-label="Seu dia">
        <div className="clt-metrica">
          <Icone nome="alvo" tamanho={20} />
          <strong>{resumo.concluidosHoje.length}</strong>
          <span>pedidos concluídos hoje</span>
        </div>
        <div className="clt-metrica">
          <Icone nome="caixa" tamanho={20} />
          <strong>{resumo.unidadesHoje}</strong>
          <span>unidades coletadas hoje</span>
        </div>
        <div className="clt-metrica">
          <Icone nome="pedidos" tamanho={20} />
          <strong>{fila.length}</strong>
          <span>pedidos na fila</span>
        </div>
        <div className="clt-metrica">
          <Icone nome="relogio" tamanho={20} />
          <strong>{resumo.minutosMedios == null ? '—' : `${Math.round(resumo.minutosMedios)} min`}</strong>
          <span>tempo médio por pedido</span>
        </div>
      </section>

      <section className="clt-card" aria-label="Concluídos hoje">
        <div className="clt-card-topo">
          <h2>Concluídos hoje</h2>
          <span className="clt-texto-fraco">{resumo.concluidosHoje.length}</span>
        </div>

        {resumo.concluidosHoje.length === 0 ? (
          <p className="clt-texto-fraco">Nenhum pedido concluído hoje ainda.</p>
        ) : (
          <ul className="clt-concluidos">
            {resumo.concluidosHoje.slice(0, 6).map((pedido) => {
              const minutos = duracaoEmMinutos(pedido.started_at, pedido.completed_at)
              return (
                <li key={pedido.id}>
                  <span className="clt-check">
                    <Icone nome="check" tamanho={14} />
                  </span>
                  <strong>{numeroPedido(pedido)}</strong>
                  <span className="clt-texto-fraco">
                    {progressoPedido(pedido).total} un.{minutos != null ? ` · ${minutos} min` : ''}
                  </span>
                  <span className="clt-concluidos-hora">{formatarHora(pedido.completed_at)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default InicioColetor
