import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import Icone from '../../components/Icone'
import UsuariosPerfis from './UsuariosPerfis'
import { configuracaoPadrao, opcoesDoca, usuariosExemplo } from './dadosConfiguracoes'
import './Configuracoes.css'

const CHAVE_CONFIGURACOES = 'fasthub_configuracoes'

const secoes = [
  { id: 'armazem', nome: 'Armazém', icone: 'mapa' },
  { id: 'regras', nome: 'Regras de rota', icone: 'rotas' },
  { id: 'usuarios', nome: 'Usuários e perfis', icone: 'usuario' },
  { id: 'notificacoes', nome: 'Notificações', icone: 'sino', emBreve: true },
  { id: 'dispositivos', nome: 'Dispositivos', icone: 'coletores', emBreve: true },
]

function lerConfiguracaoSalva() {
  try {
    const salva = JSON.parse(localStorage.getItem(CHAVE_CONFIGURACOES))
    return salva ? { ...configuracaoPadrao, ...salva } : configuracaoPadrao
  } catch {
    return configuracaoPadrao
  }
}

// "1,50" vira 1.5; devolve NaN se não for número
function lerNumero(texto) {
  const limpo = String(texto).trim().replace(',', '.')
  return limpo === '' ? NaN : Number(limpo)
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
  inteiro('corredores', 1, 26, 'Use de 1 a 26 corredores (A a Z).')
  inteiro('posicoesPorCorredor', 1, 99, 'Use de 1 a 99 posições.')
  inteiro('niveisPorEstante', 1, 10, 'Use de 1 a 10 níveis.')
  decimal('alturaPorNivel', 5, 'Informe uma altura entre 0 e 5 m.')
  decimal('alturaEmpilhadeira', 20, 'Informe uma altura válida em metros.')
  decimal('pesoEmpilhadeira', 2000, 'Informe um peso válido em kg.')
  inteiro('maxItensPorRota', 1, 500, 'Use de 1 a 500 itens.')
  return erros
}

function Campo({ id, rotulo, valor, onMudar, erro, unidade, inteiro = false }) {
  return (
    <label className={`cfg-campo ${erro ? 'com-erro' : ''}`} htmlFor={`cfg-campo-${id}`}>
      <span>{rotulo}</span>
      <span className="cfg-entrada">
        <input
          id={`cfg-campo-${id}`}
          value={valor}
          inputMode={unidade ? 'decimal' : inteiro ? 'numeric' : undefined}
          aria-invalid={Boolean(erro)}
          onChange={(e) => onMudar(id, e.target.value)}
        />
        {unidade && <small>{unidade}</small>}
      </span>
      {erro && <em>{erro}</em>}
    </label>
  )
}

function Configuracoes({ usuario, onNavegar, onSair }) {
  const [busca, setBusca] = useState('')
  const [salva, setSalva] = useState(lerConfiguracaoSalva)
  const [config, setConfig] = useState(salva)
  const [erros, setErros] = useState({})
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto }
  const [secaoAtiva, setSecaoAtiva] = useState('armazem')
  const [usuarios, setUsuarios] = useState(() => [
    {
      id: 'eu',
      nome: usuario.name,
      email: usuario.email,
      perfil: usuario.role === 'picker' ? 'coletor' : 'gestor',
      ultimoAcesso: 'agora',
    },
    ...usuariosExemplo,
  ])

  const alterado = JSON.stringify(config) !== JSON.stringify(salva)

  // a mensagem de "salvo" some sozinha depois de alguns segundos
  useEffect(() => {
    if (aviso?.tipo !== 'ok') return undefined
    const tempo = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(tempo)
  }, [aviso])

  function mudar(campo, valor) {
    setConfig((atual) => ({ ...atual, [campo]: valor }))
    if (erros[campo]) setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  function irPara(secao) {
    if (secao.emBreve) return
    setSecaoAtiva(secao.id)
    document.getElementById(`cfg-${secao.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function salvar() {
    const encontrados = validar(config)
    setErros(encontrados)
    if (Object.keys(encontrados).length > 0) {
      setAviso({ tipo: 'erro', texto: 'Corrija os campos destacados antes de salvar.' })
      return
    }
    try {
      localStorage.setItem(CHAVE_CONFIGURACOES, JSON.stringify(config))
      setAviso({ tipo: 'ok', texto: 'Alterações salvas neste navegador.' })
    } catch {
      setAviso({ tipo: 'erro', texto: 'O navegador bloqueou o salvamento. As alterações valem até recarregar a página.' })
    }
    setSalva(config)
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
          <div className="col-aviso demo">
            Prévia: as configurações ficam salvas só neste navegador até a API ter a rota de configurações.
          </div>

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
              <section id="cfg-armazem" className="dash-card cfg-secao">
                <div className="cfg-secao-topo">
                  <div>
                    <h2>Planta do armazém</h2>
                    <p>Usada no mapa e no cálculo das rotas.</p>
                  </div>
                  <button type="button" className="cfg-btn-secundario" title="Em breve">
                    <Icone nome="editar" tamanho={15} />
                    Editar planta
                  </button>
                </div>

                <div className="cfg-campos cfg-campos-planta">
                  <div className="cfg-largo">{campo('nomeArmazem', 'Nome do armazém')}</div>
                  {campo('corredores', 'Corredores', { inteiro: true })}
                  {campo('posicoesPorCorredor', 'Posições por corredor', { inteiro: true })}
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
                <p>O FastHub usa o algoritmo do vizinho mais próximo para ordenar as paradas.</p>

                <div className="cfg-algoritmo">
                  <span className="cfg-algoritmo-icone">
                    <Icone nome="rotas" tamanho={20} />
                  </span>
                  <div className="cfg-algoritmo-texto">
                    <strong>
                      Vizinho mais próximo <span>Algoritmo único</span>
                    </strong>
                    <p>
                      Saindo da doca, o coletor sempre vai para a posição ainda não visitada mais perto de onde está.
                      Ao terminar, a rota volta para a doca.
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
                </div>
              </section>

              <UsuariosPerfis usuarios={usuarios} idAtual="eu" onAlterar={setUsuarios} />

              <div className="cfg-rodape">
                {aviso && (
                  <span className={`cfg-aviso ${aviso.tipo}`} role="status">
                    {aviso.tipo === 'ok' && <Icone nome="check" tamanho={15} />}
                    {aviso.texto}
                  </span>
                )}
                <button type="button" className="cfg-btn-secundario" onClick={descartar} disabled={!alterado}>
                  Descartar
                </button>
                <button type="button" className="cfg-btn-principal" onClick={salvar} disabled={!alterado}>
                  Salvar alterações
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default Configuracoes
