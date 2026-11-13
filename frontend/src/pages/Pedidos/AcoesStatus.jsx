import { useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { cancelarPedido, concluirPedido, iniciarPedido } from '../../services/api'

// Botões de status do pedido selecionado (o backend valida as transições):
//
//   pendente ──Iniciar──▶ em andamento ──Concluir──▶ concluído
//      │                      │
//      └──────Cancelar────────┴──▶ cancelado
//
// 409 (transição inválida, ex.: alguém já mudou o status) e 422 (ainda faltam itens)
// aparecem como aviso no painel, com a mensagem da API.

const acoes = {
  iniciar: { chamar: iniciarPedido, feito: 'Pedido iniciado.' },
  concluir: { chamar: concluirPedido, feito: 'Pedido concluído.' },
  cancelar: { chamar: cancelarPedido, feito: 'Pedido cancelado.' },
}

export function useAcoesStatus(pedido, onMudou) {
  const [executando, setExecutando] = useState(null) // 'iniciar' | 'concluir' | 'cancelar' | null
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'alerta' | 'erro', texto }

  // O botão fica travado até a lista recarregada trazer o status novo do pedido.
  useEffect(() => {
    setExecutando(null)
  }, [pedido.status])

  async function executar(acao) {
    setConfirmando(false)
    setAviso(null)
    setExecutando(acao)

    try {
      await acoes[acao].chamar(pedido.id)
      setAviso({ tipo: 'ok', texto: acoes[acao].feito })
      onMudou()
    } catch (err) {
      const regraDoPedido = err.status === 409 || err.status === 422
      setAviso({
        tipo: regraDoPedido ? 'alerta' : 'erro',
        texto: err.message || 'Não foi possível mudar o status do pedido. Tente de novo.',
      })
      setExecutando(null)
      // 409 = o status mudou por fora (ex.: o coletor iniciou): atualiza a tela para mostrar o atual
      if (err.status === 409) onMudou()
    }
  }

  return { executando, confirmando, setConfirmando, aviso, setAviso, executar }
}

// Botões que ficam no topo do painel, ao lado de "Trocar coletor".
export function BotoesStatus({ pedido, acoes: estado }) {
  const { executando, setConfirmando, executar } = estado
  const pendente = pedido.status === 'pending'
  const andamento = pedido.status === 'in_progress'
  const ocupado = executando !== null

  if (!pendente && !andamento) return null

  return (
    <>
      {pendente && (
        <button type="button" className="ped-btn-primario" onClick={() => executar('iniciar')} disabled={ocupado}>
          <Icone nome="play" tamanho={14} />
          {executando === 'iniciar' ? 'Iniciando...' : 'Iniciar'}
        </button>
      )}
      {andamento && (
        <button type="button" className="ped-btn-primario" onClick={() => executar('concluir')} disabled={ocupado}>
          <Icone nome="check" tamanho={14} />
          {executando === 'concluir' ? 'Concluindo...' : 'Concluir'}
        </button>
      )}
      <button
        type="button"
        className="ped-btn-secundario perigo"
        onClick={() => setConfirmando(true)}
        disabled={ocupado}
      >
        {executando === 'cancelar' ? 'Cancelando...' : 'Cancelar'}
      </button>
    </>
  )
}

// Confirmação do cancelamento e avisos, logo abaixo do topo do painel.
export function AvisosStatus({ pedido, numero, acoes: estado }) {
  const { executando, confirmando, setConfirmando, aviso, setAviso, executar } = estado

  return (
    <>
      {confirmando && (
        <div className="ped-confirmar" role="alertdialog" aria-label="Confirmar cancelamento">
          <p>
            Cancelar o pedido <strong>{numero}</strong>?
            {pedido.status === 'in_progress' && ' O coletor está com ele em andamento.'} Essa ação não pode ser desfeita.
          </p>
          <div>
            <button type="button" className="ped-btn-secundario" onClick={() => setConfirmando(false)} autoFocus>
              Voltar
            </button>
            <button
              type="button"
              className="ped-btn-perigo"
              onClick={() => executar('cancelar')}
              disabled={executando !== null}
            >
              Sim, cancelar pedido
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <div className={`ped-aviso-status ${aviso.tipo}`} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
          <span>{aviso.texto}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
            <Icone nome="fechar" tamanho={14} />
          </button>
        </div>
      )}
    </>
  )
}
