import { useState } from 'react'
import Icone from '../../components/Icone'
import InicioColetor from './InicioColetor'
import PedidosColetor from './PedidosColetor'
import ColetaColetor from './ColetaColetor'
import { usePedidosColetor, usePosicoesArmazem } from '../../hooks/useColetor'
import { iniciarPedido, mudarMeuStatus } from '../../services/api'
import { iniciais } from '../../utils/formatar'
import './Coletor.css'

const abas = [
  { id: 'inicio', nome: 'Início', icone: 'inicio' },
  { id: 'pedidos', nome: 'Pedidos', icone: 'pedidos' },
  { id: 'coleta', nome: 'Coleta', icone: 'mapa' },
]

const nomesStatus = {
  active: 'Ativo',
  paused: 'Em pausa',
  offline: 'Offline',
}

// Tela do coletor (perfil picker): Início, Pedidos e Coleta (mapa da rota + bipagem).
// Feita primeiro para o celular; a partir de 768 px as abas sobem para o topo.
function AreaColetor({ usuario, onSair }) {
  const [aba, setAba] = useState('inicio')
  const [status, setStatus] = useState(usuario.work_status ?? 'offline')
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [erroStatus, setErroStatus] = useState('')
  const pedidos = usePedidosColetor()
  const posicoes = usePosicoesArmazem()

  const pedidoAtual = pedidos.abertos.find((p) => p.status === 'in_progress') ?? null
  const fila = pedidos.abertos.filter((p) => p.status === 'pending')
  const emPausa = status === 'paused'

  async function trocarStatus(novo) {
    setMudandoStatus(true)
    setErroStatus('')
    try {
      const resposta = await mudarMeuStatus(novo)
      setStatus(resposta.work_status ?? novo)
    } catch (e) {
      setErroStatus(e.message)
      throw e
    } finally {
      setMudandoStatus(false)
    }
  }

  // Quem inicia um pedido está trabalhando: fica ativo (sai da pausa ou do offline).
  async function iniciar(pedido) {
    if (status !== 'active') await trocarStatus('active')
    await iniciarPedido(pedido.id)
    await pedidos.recarregar()
    setAba('coleta')
  }

  async function sair() {
    try {
      await mudarMeuStatus('offline')
    } catch {
      // sem rede: sai do mesmo jeito
    }
    onSair()
  }

  const acaoStatus = emPausa
    ? { rotulo: 'Retomar', icone: 'play', novo: 'active' }
    : status === 'active'
      ? { rotulo: 'Pausar', icone: 'pausa', novo: 'paused' }
      : { rotulo: 'Ficar ativo', icone: 'play', novo: 'active' }

  return (
    <div className={`clt ${emPausa ? 'em-pausa' : ''}`}>
      <header className="clt-topo">
        <div className="clt-marca">
          <span className="clt-logo">FastHub</span>
        </div>

        <nav className="clt-abas" aria-label="Seções do coletor">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`clt-aba ${aba === item.id ? 'ativa' : ''}`}
              aria-current={aba === item.id ? 'page' : undefined}
              onClick={() => setAba(item.id)}
            >
              <Icone nome={item.icone} tamanho={20} />
              <span>{item.nome}</span>
              {item.id === 'pedidos' && fila.length > 0 && <span className="clt-aba-contador">{fila.length}</span>}
              {item.id === 'coleta' && pedidoAtual && <span className="clt-aba-ponto" aria-label="pedido em andamento" />}
            </button>
          ))}
        </nav>

        <div className="clt-topo-direita">
          <span className={`clt-status ${status}`}>{nomesStatus[status] ?? status}</span>
          <button
            type="button"
            className={`clt-botao-status ${acaoStatus.novo === 'paused' ? 'pausar' : 'retomar'}`}
            disabled={mudandoStatus}
            onClick={() => trocarStatus(acaoStatus.novo).catch(() => {})}
          >
            <Icone nome={acaoStatus.icone} tamanho={16} />
            {acaoStatus.rotulo}
          </button>

          <div className="clt-usuario" title={usuario.name}>
            <span className="clt-avatar">{iniciais(usuario.name)}</span>
            <div>
              <strong>{usuario.name}</strong>
              <small>{usuario.operator_name ?? usuario.job_title ?? 'Coletor'}</small>
            </div>
          </div>

          <button type="button" className="clt-sair" onClick={sair} aria-label="Sair" title="Sair">
            <Icone nome="sair" tamanho={18} />
          </button>
        </div>
      </header>

      {emPausa && (
        <div className="clt-faixa-pausa" role="status">
          <Icone nome="pausa" tamanho={18} />
          <p>
            <strong>Você está em pausa.</strong> A bipagem fica bloqueada até você retomar.
          </p>
          <button type="button" disabled={mudandoStatus} onClick={() => trocarStatus('active').catch(() => {})}>
            Retomar
          </button>
        </div>
      )}

      {erroStatus && (
        <div className="clt-aviso erro clt-aviso-topo" role="alert">
          Não foi possível mudar o status: {erroStatus}
          <button type="button" onClick={() => setErroStatus('')}>
            Fechar
          </button>
        </div>
      )}

      {pedidos.erro && (
        <div className="clt-aviso erro clt-aviso-topo" role="alert">
          {pedidos.erro}
          <button type="button" onClick={pedidos.recarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      <main className="clt-conteudo">
        {aba === 'inicio' && (
          <InicioColetor
            usuario={usuario}
            status={status}
            pedidoAtual={pedidoAtual}
            fila={fila}
            concluidos={pedidos.concluidos}
            carregando={pedidos.carregando}
            onIrPara={setAba}
          />
        )}

        {aba === 'pedidos' && (
          <PedidosColetor
            pedidoAtual={pedidoAtual}
            fila={fila}
            carregando={pedidos.carregando}
            onIniciar={iniciar}
            onContinuar={() => setAba('coleta')}
            onAtualizar={pedidos.recarregar}
          />
        )}

        {aba === 'coleta' && (
          <ColetaColetor
            usuario={usuario}
            pedido={pedidoAtual}
            fila={fila}
            posicoes={posicoes}
            emPausa={emPausa}
            carregando={pedidos.carregando}
            onPedidoMudou={pedidos.recarregar}
            onIniciar={iniciar}
            onIrPara={setAba}
            onRetomar={() => trocarStatus('active')}
          />
        )}
      </main>
    </div>
  )
}

export default AreaColetor
