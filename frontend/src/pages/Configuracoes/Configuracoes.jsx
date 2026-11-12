import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import UsuariosPerfis from './UsuariosPerfis'
import { buscarConfiguracoes, salvarConfiguracoes } from '../../services/api'
import './Configuracoes.css'

// Configurações salvas no banco (GET/PUT /settings). Corredores e posições são contados
// a partir do que está cadastrado e aparecem só para leitura.

const secoes = [
  { id: 'armazem', nome: 'Armazém', icone: 'mapa' },
  { id: 'regras', nome: 'Regras de rota', icone: 'rotas' },
  { id: 'usuarios', nome: 'Usuários e perfis', icone: 'usuario' },
  { id: 'notificacoes', nome: 'Notificações', icone: 'sino', emBreve: true },
  { id: 'dispositivos', nome: 'Dispositivos', icone: 'coletores', emBreve: true },
]

const opcoesDoca = [
  { id: 'left', nome: 'Lateral esquerda, junto ao primeiro corredor' },
  { id: 'right', nome: 'Lateral direita, junto ao último corredor' },
  { id: 'back', nome: 'Fundo do armazém, no meio dos corredores' },
]

// campo da tela -> campo da API e se é número decimal (mostrado com vírgula)
const campos = {
  nomeArmazem: { api: 'warehouse_name' },
  niveisPorEstante: { api: 'levels_per_rack', numero: true },
  alturaPorNivel: { api: 'level_height_m', numero: true, decimal: true },
  posicaoDoca: { api: 'dock_position' },
  alturaEmpilhadeira: { api: 'forklift_height_m', numero: true, decimal: true },
  pesoEmpilhadeira: { api: 'forklift_weight_kg', numero: true },
  maxItensPorRota: { api: 'max_items_per_route', numero: true },
  agruparPedidos: { api: 'group_orders' },
  pedidosPorGrupo: { api: 'orders_per_group', numero: true },
}

// "1,50" vira 1.5; devolve NaN se não for número
function lerNumero(texto) {
  const limpo = String(texto).trim().replace(',', '.')
  return limpo === '' ? NaN : Number(limpo)
}

function daApi(settings) {
  const config = {}
  for (const [campo, { api, numero, decimal }] of Object.entries(campos)) {
    const valor = settings[api]
    if (!numero) config[campo] = valor
    else config[campo] = decimal ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : String(valor)
  }
  return config
}

function paraApi(config) {
  const corpo = {}
  for (const [campo, { api, numero }] of Object.entries(campos)) {
    corpo[api] = numero ? lerNumero(config[campo]) : config[campo]
  }
  return corpo
}

// erros da API (por campo da API) para os campos da tela
function errosDaApi(erros) {
  const resultado = {}
  for (const [campo, { api }] of Object.entries(campos)) {
    if (erros[api]) resultado[campo] = erros[api][0]
  }
  return resultado
}

function validar(config) {
  const erros = {}
  const inteiro = (campo, minimo, maximo, mensagem) => {
    const valor = lerNumero(config[campo])
    if (!Number.isInteger(valor) || valor < minimo || valor > maximo) erros[campo] = mensagem
  }
  const decimal = (campo, maximo, mensagem) => {
    const valor = lerNumero(config[campo])
    if (Number.isNaN(valor) || valor <= 0 || valor > maximo) erros[campo] = mensagem
  }

  if (!config.nomeArmazem.trim()) erros.nomeArmazem = 'Informe o nome do armazém.'
  inteiro('niveisPorEstante', 1, 10, 'Use de 1 a 10 níveis.')
  decimal('alturaPorNivel', 5, 'Informe uma altura entre 0 e 5 m.')
  decimal('alturaEmpilhadeira', 20, 'Informe uma altura válida em metros.')
  decimal('pesoEmpilhadeira', 2000, 'Informe um peso válido em kg.')
  inteiro('maxItensPorRota', 1, 500, 'Use de 1 a 500 itens.')
  inteiro('pedidosPorGrupo', 2, 20, 'Use de 2 a 20 pedidos por grupo.')
  return erros
}

function Campo({ id, rotulo, valor, onMudar, erro, unidade, inteiro = false, somenteLeitura = false }) {
  return (
    <label className={`cfg-campo ${erro ? 'com-erro' : ''}`} htmlFor={`cfg-campo-${id}`}>
      <span>{rotulo}</span>
      <span className="cfg-entrada">
        <input
          id={`cfg-campo-${id}`}
          value={valor}
          readOnly={somenteLeitura}
          inputMode={unidade ? 'decimal' : inteiro ? 'numeric' : undefined}
          aria-invalid={Boolean(erro)}
          onChange={(e) => onMudar?.(id, e.target.value)}
        />
        {unidade && <small>{unidade}</small>}
      </span>
      {erro && <em>{erro}</em>}
    </label>
  )
}

function Configuracoes({ usuario, onNavegar, onSair }) {
  const [busca, setBusca] = useState('')
  const [salva, setSalva] = useState(null)
  const [config, setConfig] = useState(null)
  const [planta, setPlanta] = useState(null)
  const [erroCarga, setErroCarga] = useState('')
  const [erros, setErros] = useState({})
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto }
  const [salvando, setSalvando] = useState(false)
  const [secaoAtiva, setSecaoAtiva] = useState('armazem')

  useEffect(() => {
    buscarConfiguracoes()
      .then((resposta) => {
        const valores = daApi(resposta.settings)
        setSalva(valores)
        setConfig(valores)
        setPlanta(resposta.layout)
      })
      .catch((e) => setErroCarga(e.message))
  }, [])

  // a mensagem de "salvo" some sozinha depois de alguns segundos
  useEffect(() => {
    if (aviso?.tipo !== 'ok') return undefined
    const tempo = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(tempo)
  }, [aviso])

  const alterado = config && JSON.stringify(config) !== JSON.stringify(salva)

  function mudar(campo, valor) {
    setConfig((atual) => ({ ...atual, [campo]: valor }))
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  function irPara(secao) {
    if (secao.emBreve) return
    setSecaoAtiva(secao.id)
    document.getElementById(`cfg-${secao.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function salvar() {
    const encontrados = validar(config)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      setAviso({ tipo: 'erro', texto: 'Corrija os campos destacados antes de salvar.' })
      return
    }

    setSalvando(true)
    try {
      const resposta = await salvarConfiguracoes(paraApi(config))
      const valores = daApi(resposta.settings)
      setSalva(valores)
      setConfig(valores)
      setPlanta(resposta.layout)
      setAviso({ tipo: 'ok', texto: 'Alterações salvas.' })
    } catch (e) {
      setErros(errosDaApi(e.erros ?? {}))
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setSalvando(false)
    }
  }

  function descartar() {
    setConfig(salva)
    setErros({})
    setAviso(null)
  }

  const campo = (id, rotulo, extras = {}) => (
    <Campo id={id} rotulo={rotulo} valor={config[id]} onMudar={mudar} erro={erros[id]} {...extras} />
  )

  return (
    <div className="dashboard">
      <Sidebar ativo="configuracoes" onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Configurações"
          subtitulo="Armazém, rotas e usuários"
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
        />

        <main className="dash-conteudo">
          <div className="cfg-grade">
            <nav className="dash-card cfg-nav" aria-label="Seções das configurações">
              {secoes.map((secao) => (
                <button
                  key={secao.id}
                  type="button"
                  className={`${secaoAtiva === secao.id ? 'ativo' : ''} ${secao.emBreve ? 'em-breve' : ''}`}
                  aria-current={secaoAtiva === secao.id ? 'true' : undefined}
                  aria-disabled={secao.emBreve || undefined}
                  title={secao.emBreve ? 'Em breve' : undefined}
                  onClick={() => irPara(secao)}
                >
                  <Icone nome={secao.icone} tamanho={17} />
                  {secao.nome}
                </button>
              ))}
            </nav>

            <div className="cfg-secoes">
              {erroCarga && <div className="col-aviso erro">Não foi possível carregar as configurações: {erroCarga}</div>}
              {!config && !erroCarga && <p className="col-aviso">Carregando configurações...</p>}

              {config && (
                <>
                  <section id="cfg-armazem" className="dash-card cfg-secao">
                    <div className="cfg-secao-topo">
                      <div>
                        <h2>Planta do armazém</h2>
                        <p>Usada no mapa e no cálculo das rotas. Corredores e posições vêm do cadastro.</p>
                      </div>
                    </div>

                    <div className="cfg-campos cfg-campos-planta">
                      <div className="cfg-largo">{campo('nomeArmazem', 'Nome do armazém')}</div>
                      <Campo id="corredores" rotulo="Corredores cadastrados" valor={planta?.aisles ?? 0} somenteLeitura />
                      <Campo
                        id="posicoes"
                        rotulo="Posições no maior corredor"
                        valor={planta?.max_locations_per_aisle ?? 0}
                        somenteLeitura
                      />
                      {campo('niveisPorEstante', 'Níveis por estante', { inteiro: true })}
                      {campo('alturaPorNivel', 'Altura por nível', { unidade: 'm' })}
                      <label className="cfg-campo cfg-largo" htmlFor="cfg-campo-posicaoDoca">
                        <span>Posição da doca</span>
                        <span className="cfg-entrada">
                          <select
                            id="cfg-campo-posicaoDoca"
                            value={config.posicaoDoca}
                            onChange={(e) => mudar('posicaoDoca', e.target.value)}
                          >
                            {opcoesDoca.map((opcao) => (
                              <option key={opcao.id} value={opcao.id}>
                                {opcao.nome}
                              </option>
                            ))}
                          </select>
                        </span>
                      </label>
                    </div>
                  </section>

                  <section id="cfg-regras" className="dash-card cfg-secao">
                    <h2>Regras de rota</h2>
                    <p>O FastHub usa o algoritmo do vizinho mais próximo, refinado com 2-opt, para ordenar as paradas.</p>

                    <div className="cfg-algoritmo">
                      <span className="cfg-algoritmo-icone">
                        <Icone nome="rotas" tamanho={20} />
                      </span>
                      <div className="cfg-algoritmo-texto">
                        <strong>
                          Vizinho mais próximo <span>Algoritmo único</span>
                        </strong>
                        <p>
                          Saindo da doca, o coletor sempre vai para a posição ainda não visitada mais perto de onde
                          está. Ao terminar, a rota volta para a doca.
                        </p>
                      </div>
                      <ol className="cfg-passos">
                        <li>Parte da doca</li>
                        <li>Escolhe a posição mais próxima</li>
                        <li>Repete até a última e volta à doca</li>
                      </ol>
                    </div>

                    <div className="cfg-campos cfg-campos-regras">
                      {campo('alturaEmpilhadeira', 'Altura que exige empilhadeira', { unidade: 'm' })}
                      {campo('pesoEmpilhadeira', 'Peso que exige empilhadeira', { unidade: 'kg' })}
                      {campo('maxItensPorRota', 'Máx. de itens por rota', { inteiro: true })}
                      <div className="cfg-campo">
                        <span id="cfg-agrupar-rotulo">Agrupar pedidos pequenos</span>
                        <span className="cfg-chave-linha">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={config.agruparPedidos}
                            aria-labelledby="cfg-agrupar-rotulo"
                            className={`cfg-chave ${config.agruparPedidos ? 'ligada' : ''}`}
                            onClick={() => mudar('agruparPedidos', !config.agruparPedidos)}
                          >
                            <span />
                          </button>
                          <small>
                            {config.agruparPedidos ? `até ${config.pedidosPorGrupo} por rota` : 'um pedido por rota'}
                          </small>
                        </span>
                      </div>
                      {config.agruparPedidos && campo('pedidosPorGrupo', 'Pedidos por grupo', { inteiro: true })}
                    </div>
                  </section>
                </>
              )}

              <UsuariosPerfis idAtual={usuario.id} />

              {config && (
                <div className="cfg-rodape">
                  {aviso && (
                    <span className={`cfg-aviso ${aviso.tipo}`} role="status">
                      {aviso.tipo === 'ok' && <Icone nome="check" tamanho={15} />}
                      {aviso.texto}
                    </span>
                  )}
                  <button type="button" className="cfg-btn-secundario" onClick={descartar} disabled={!alterado || salvando}>
                    Descartar
                  </button>
                  <button type="button" className="cfg-btn-principal" onClick={salvar} disabled={!alterado || salvando}>
                    {salvando ? 'Salvando...' : 'Salvar alterações'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Configuracoes
