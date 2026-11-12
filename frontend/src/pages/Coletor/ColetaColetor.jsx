import { useEffect, useMemo, useRef, useState } from 'react'
import Icone from '../../components/Icone'
import MapaRota from '../Pedidos/MapaRota'
import { useRotaColeta } from '../../hooks/useColetor'
import { biparItem, concluirPedido } from '../../services/api'
import { formatarHora } from '../../utils/formatar'
import { posicoesDaApi, rotaDaApi } from '../../utils/rotaApi'
import { itemParaBipar, montarColeta, numeroPedido } from '../../utils/coleta'
import '../Pedidos/Pedidos.css'

// Tela de coleta do pedido em andamento: próxima parada, campo de bipagem e mapa da rota.
// O leitor de código de barras funciona como teclado (digita o código e manda Enter),
// então o campo fica sempre com o foco.
function ColetaColetor({
  usuario,
  pedido,
  fila,
  posicoes,
  emPausa,
  carregando,
  onPedidoMudou,
  onIniciar,
  onIrPara,
  onRetomar,
}) {
  const { resposta, erro: erroRota, recarregar } = useRotaColeta(pedido?.id ?? null)
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [retorno, setRetorno] = useState(null)
  const [concluindo, setConcluindo] = useState(false)
  const [concluido, setConcluido] = useState(null)
  const [verParadas, setVerParadas] = useState(false)
  const campo = useRef(null)

  const coleta = useMemo(
    () => (resposta && pedido ? montarColeta(resposta, pedido, usuario.picker_type) : null),
    [resposta, pedido, usuario.picker_type],
  )
  const rota = useMemo(() => (resposta ? rotaDaApi(resposta) : null), [resposta])
  const planta = useMemo(() => posicoesDaApi(posicoes), [posicoes])

  // Novo pedido na tela: limpa os avisos do anterior (o "concluído" fica até começar outro).
  const [pedidoNaTela, setPedidoNaTela] = useState(pedido?.id ?? null)
  if ((pedido?.id ?? null) !== pedidoNaTela) {
    setPedidoNaTela(pedido?.id ?? null)
    setRetorno(null)
    setVerParadas(false)
    if (pedido) setConcluido(null)
  }

  // Foco automático no campo de bipagem (ao abrir, depois de cada bipagem e ao sair da pausa).
  useEffect(() => {
    if (!enviando && !emPausa && coleta && !coleta.tudoColetado) campo.current?.focus()
  }, [enviando, emPausa, coleta])

  async function bipar(e) {
    e.preventDefault()
    const lido = codigo.trim()
    if (!lido || enviando || emPausa || !coleta) return

    const { item, confere, foraDaParada } = itemParaBipar(coleta, lido)
    if (!item) return

    setEnviando(true)
    try {
      await biparItem(item.id, lido)
      const faltam = item.faltam - 1
      setRetorno({
        tipo: 'ok',
        titulo: `+1 ${item.nome}`,
        texto: [
          faltam > 0 ? `Faltam ${faltam} un. deste item.` : 'Item completo.',
          foraDaParada ? 'Era de outra parada; a rota foi recalculada.' : '',
        ]
          .filter(Boolean)
          .join(' '),
      })
      await Promise.all([recarregar(), onPedidoMudou()])
    } catch (erro) {
      if (erro.status === 422 && !confere) {
        // Código errado: a API grava a divergência e o item não conta.
        setRetorno({
          tipo: 'divergencia',
          titulo: 'Divergência: o código não confere',
          texto: `Lido ${lido}. Esperado ${item.nome}${item.codigoBarras ? ` (${item.codigoBarras})` : ''}${
            coleta.proxima ? ` na posição ${coleta.proxima.codigo}` : ''
          }. Confira o produto e bipe de novo.`,
        })
        navigator.vibrate?.([180, 80, 180])
      } else {
        setRetorno({ tipo: 'erro', titulo: 'Bipagem não registrada', texto: erro.message })
        // pedido mudou por fora (ex.: concluído ou cancelado pelo gestor)
        if (erro.status === 409 || erro.status === 403) onPedidoMudou()
      }
    } finally {
      setCodigo('')
      setEnviando(false)
    }
  }

  async function concluir() {
    setConcluindo(true)
    try {
      await concluirPedido(pedido.id)
      setConcluido({ numero: numeroPedido(pedido), unidades: coleta.total, paradas: coleta.paradas.length })
      setRetorno(null)
      await onPedidoMudou()
    } catch (erro) {
      setRetorno({ tipo: 'erro', titulo: 'Não foi possível concluir', texto: erro.message })
      await Promise.all([recarregar(), onPedidoMudou()])
    } finally {
      setConcluindo(false)
    }
  }

  // Sem pedido em andamento -------------------------------------------------------------------
  if (!pedido) {
    if (carregando) return <p className="clt-texto-fraco">Carregando...</p>
    const proximo = fila[0]

    return (
      <div className="clt-coleta-vazia">
        {concluido ? (
          <section className="clt-card clt-concluido">
            <span className="clt-concluido-icone">
              <Icone nome="check" tamanho={28} />
            </span>
            <h1>Pedido {concluido.numero} concluído!</h1>
            <p className="clt-texto-fraco">
              {concluido.unidades} unidades em {concluido.paradas} {concluido.paradas === 1 ? 'parada' : 'paradas'}.
            </p>
          </section>
        ) : (
          <div className="clt-vazio">
            <strong>Nenhum pedido em andamento</strong>
            <p>Inicie um pedido da fila para ver a rota e começar a bipar.</p>
          </div>
        )}

        {proximo ? (
          <section className="clt-card">
            <p className="clt-texto-fraco">Próximo da fila</p>
            <p className="clt-proximo-fila">
              <strong className="clt-numero-grande">{numeroPedido(proximo)}</strong>
              <span>{proximo.items?.length ?? 0} produtos</span>
            </p>
            <BotaoIniciar pedido={proximo} onIniciar={onIniciar} />
            <button type="button" className="clt-botao secundario largo" onClick={() => onIrPara('pedidos')}>
              Ver todos os pedidos
            </button>
          </section>
        ) : (
          <p className="clt-texto-fraco clt-centro">Sua fila está vazia.</p>
        )}
      </div>
    )
  }

  // Com pedido em andamento -------------------------------------------------------------------
  const proxima = coleta?.proxima
  const pendentesDaParada = proxima?.itens.filter((item) => !item.coletado) ?? []

  return (
    <div className="clt-coleta">
      <section className="clt-coleta-cabecalho">
        <div className="clt-coleta-cabecalho-linha">
          <div>
            <h1>Pedido {numeroPedido(pedido)}</h1>
            <p className="clt-texto-fraco">
              {pedido.started_at ? `Iniciado às ${formatarHora(pedido.started_at)}` : 'Em andamento'}
              {rota && !coleta?.tudoColetado ? ` · cerca de ${rota.minutosFaltando} min para terminar` : ''}
            </p>
          </div>
          {coleta && (
            <span className="clt-paradas-contador">
              <strong>
                {coleta.feitas}/{coleta.paradas.length}
              </strong>
              paradas
            </span>
          )}
        </div>
        {coleta && (
          <>
            <div className="clt-barra" aria-hidden="true">
              <span style={{ width: `${coleta.percentual}%` }} />
            </div>
            <p className="clt-atual-numeros">
              <span>
                {coleta.coletados} de {coleta.total} unidades
              </span>
              <span>{coleta.percentual}%</span>
            </p>
          </>
        )}
      </section>

      {erroRota && !coleta && (
        <div className="clt-aviso erro" role="alert">
          Não foi possível carregar a rota: {erroRota}
          <button type="button" onClick={recarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {!coleta && !erroRota && <p className="clt-texto-fraco">Calculando a rota...</p>}

      {coleta && (
        <div className="clt-coleta-grade">
          <div className="clt-coleta-esquerda">
            {/* Próxima parada */}
            {proxima && (
              <section className={`clt-card clt-proxima ${proxima.empilhadeira ? 'empilhadeira' : ''}`}>
                <div className="clt-proxima-topo">
                  <span>
                    Próxima parada · {coleta.proximaNumero} de {coleta.paradas.length}
                  </span>
                  {proxima.empilhadeira && (
                    <span className="clt-tag empilhadeira">
                      <Icone nome="empilhadeira" tamanho={14} /> Empilhadeira
                    </span>
                  )}
                </div>
                <p className="clt-proxima-posicao" aria-label={`Posição ${proxima.codigo}`}>
                  {proxima.codigo}
                </p>

                <ul className="clt-proxima-itens">
                  {pendentesDaParada.map((item) => (
                    <li key={item.id}>
                      <div className="clt-proxima-produto">
                        <strong>{item.nome}</strong>
                        <span className="clt-faltam">
                          Faltam <b>{item.faltam}</b> {item.faltam === 1 ? 'unidade' : 'unidades'}
                          {item.coletados > 0 ? ` (${item.coletados} de ${item.quantidade} já bipadas)` : ''}
                        </span>
                      </div>
                      <CodigoDeBarras item={item} onUsar={(valor) => {
                        setCodigo(valor)
                        campo.current?.focus()
                      }} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!proxima && coleta.pendentes.length > 0 && (
              <section className="clt-card clt-proxima">
                <div className="clt-proxima-topo">
                  <span>Itens sem posição cadastrada</span>
                </div>
                <p className="clt-texto-fraco">Estes itens não aparecem no mapa. Procure-os e bipe normalmente.</p>
                <ul className="clt-proxima-itens">
                  {coleta.pendentes.map((item) => (
                    <li key={item.id}>
                      <div className="clt-proxima-produto">
                        <strong>{item.nome}</strong>
                        <span className="clt-faltam">
                          Faltam <b>{item.faltam}</b> un.
                        </span>
                      </div>
                      <CodigoDeBarras item={item} onUsar={setCodigo} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Tudo coletado: concluir */}
            {coleta.tudoColetado && (
              <section className="clt-card clt-pronto">
                <span className="clt-concluido-icone">
                  <Icone nome="check" tamanho={26} />
                </span>
                <div>
                  <h2>Todos os itens coletados</h2>
                  <p className="clt-texto-fraco">Leve os itens até a doca e conclua o pedido.</p>
                </div>
                <button
                  type="button"
                  className="clt-botao sucesso largo grande"
                  onClick={concluir}
                  disabled={concluindo}
                >
                  <Icone nome="check" tamanho={20} />
                  {concluindo ? 'Concluindo...' : 'Concluir pedido'}
                </button>
              </section>
            )}

            {/* Bipagem */}
            {!coleta.tudoColetado && (
              <form className="clt-card clt-bipagem" onSubmit={bipar}>
                <label htmlFor="clt-codigo">
                  <Icone nome="codigo" tamanho={18} />
                  Bipe o código do produto
                </label>
                <div className="clt-bipagem-linha">
                  <input
                    id="clt-codigo"
                    ref={campo}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="send"
                    placeholder={emPausa ? 'Em pausa' : 'Código de barras'}
                    value={codigo}
                    disabled={emPausa}
                    onChange={(e) => setCodigo(e.target.value)}
                    aria-describedby="clt-retorno"
                  />
                  <button type="submit" className="clt-botao principal" disabled={emPausa || enviando || !codigo.trim()}>
                    {enviando ? '...' : 'Bipar'}
                  </button>
                </div>
                {emPausa && (
                  <p className="clt-dica">
                    Você está em pausa.{' '}
                    <button type="button" className="clt-link" onClick={() => onRetomar().catch(() => {})}>
                      Retomar agora
                    </button>
                  </p>
                )}
              </form>
            )}

            <div id="clt-retorno" aria-live="assertive">
              {retorno && (
                <div className={`clt-retorno ${retorno.tipo}`} role={retorno.tipo === 'ok' ? 'status' : 'alert'}>
                  <Icone nome={retorno.tipo === 'ok' ? 'check' : 'aviso'} tamanho={22} />
                  <div>
                    <strong>{retorno.titulo}</strong>
                    <p>{retorno.texto}</p>
                  </div>
                  <button type="button" aria-label="Fechar aviso" onClick={() => setRetorno(null)}>
                    <Icone nome="fechar" tamanho={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Todas as paradas */}
            <section className="clt-card clt-paradas">
              <button
                type="button"
                className="clt-paradas-botao"
                aria-expanded={verParadas}
                onClick={() => setVerParadas(!verParadas)}
              >
                <span>Todas as paradas ({coleta.paradas.length})</span>
                <span className="clt-texto-fraco">{verParadas ? 'Esconder' : 'Ver'}</span>
              </button>

              {verParadas && (
                <ol className="clt-paradas-lista">
                  {coleta.paradas.map((parada, i) => {
                    const ehProxima = parada === proxima
                    const classe = parada.coletada ? 'feita' : ehProxima ? 'proxima' : 'falta'
                    return (
                      <li key={parada.chave} className={classe}>
                        <span className={`clt-paradas-numero ${parada.empilhadeira ? 'empilhadeira' : ''}`}>
                          {parada.coletada ? <Icone nome="check" tamanho={13} /> : i + 1}
                        </span>
                        <div>
                          <strong>{parada.codigo}</strong>
                          {ehProxima && <span className="clt-tag andamento">Próxima</span>}
                          <ul>
                            {parada.itens.map((item) => (
                              <li key={item.id}>
                                {item.nome} · {item.coletados}/{item.quantidade} un.
                                {item.codigoBarras && <code>{item.codigoBarras}</code>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>

          {/* Mapa da rota */}
          <section className="clt-mapa" aria-label="Mapa da rota">
            <div className="clt-mapa-topo">
              <span>Rota do pedido</span>
              {proxima && (
                <span className="clt-mapa-proxima">
                  Próxima: <strong>{proxima.codigo}</strong>
                </span>
              )}
            </div>
            {rota && (
              <MapaRota
                posicoes={planta}
                paradas={rota.paradas}
                feitas={rota.feitas}
                concluido={false}
                doca={rota.doca}
                retorno={rota.retorno}
                empilhadeira={rota.empilhadeira}
                ajustarLargura
              />
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// Código de barras do item, para testar digitando sem leitor. Tocar preenche o campo de bipagem.
function CodigoDeBarras({ item, onUsar }) {
  if (!item.codigoBarras) return <span className="clt-texto-fraco">Sem código cadastrado</span>
  return (
    <button
      type="button"
      className="clt-codigo-barras"
      title="Preencher no campo de bipagem"
      onClick={() => onUsar(item.codigoBarras)}
    >
      <Icone nome="codigo" tamanho={14} />
      <code>{item.codigoBarras}</code>
    </button>
  )
}

function BotaoIniciar({ pedido, onIniciar }) {
  const [iniciando, setIniciando] = useState(false)
  const [erro, setErro] = useState('')

  async function iniciar() {
    setIniciando(true)
    setErro('')
    try {
      await onIniciar(pedido)
    } catch (e) {
      setErro(e.message)
      setIniciando(false)
    }
  }

  return (
    <>
      {erro && (
        <p className="clt-aviso erro" role="alert">
          {erro}
        </p>
      )}
      <button type="button" className="clt-botao principal largo" onClick={iniciar} disabled={iniciando}>
        <Icone nome="play" tamanho={16} />
        {iniciando ? 'Iniciando...' : `Iniciar ${numeroPedido(pedido)}`}
      </button>
    </>
  )
}

export default ColetaColetor
