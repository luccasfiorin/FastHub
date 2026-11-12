import { useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { iniciais } from '../../utils/formatar'
import { criarUsuario, editarUsuario, excluirUsuario, listarUsuarios } from '../../services/api'

// Usuários de todos os perfis, lidos e salvos pela API (/users).

const nomesPerfil = {
  manager: 'Gestor',
  picker: 'Coletor',
  forklift: 'Coletor · empilhadeira',
}

// classe de cor da etiqueta de perfil (mesmos nomes do CSS)
const classesPerfil = { manager: 'gestor', picker: 'coletor', forklift: 'empilhadeira' }

const conviteVazio = { nome: '', email: '', senha: '', perfil: 'picker' }

function ultimoAcesso(iso) {
  if (!iso) return 'Nunca acessou'
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function UsuariosPerfis({ idAtual }) {
  const [usuarios, setUsuarios] = useState(null)
  const [erroLista, setErroLista] = useState('')
  const [convite, setConvite] = useState(null) // null = formulário fechado
  const [erroConvite, setErroConvite] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [menuAberto, setMenuAberto] = useState(null)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto }

  function carregar() {
    listarUsuarios()
      .then((lista) => {
        setUsuarios(lista)
        setErroLista('')
      })
      .catch((e) => setErroLista(e.message))
  }

  useEffect(carregar, [])

  // fecha o menu "..." ao clicar fora dele
  useEffect(() => {
    if (!menuAberto) return undefined
    const fechar = (e) => {
      if (!e.target.closest('.cfg-menu-area')) setMenuAberto(null)
    }
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [menuAberto])

  async function enviarConvite(e) {
    e.preventDefault()
    const nome = convite.nome.trim()
    const email = convite.email.trim().toLowerCase()

    if (!nome) return setErroConvite('Informe o nome da pessoa.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErroConvite('Informe um e-mail válido.')
    if (convite.senha.length < 8) return setErroConvite('A senha inicial precisa ter pelo menos 8 caracteres.')

    setEnviando(true)
    try {
      await criarUsuario({ name: nome, email, password: convite.senha, profile: convite.perfil })
      setConvite(null)
      setErroConvite('')
      setAviso({ tipo: 'ok', texto: `${nome} já pode entrar com o e-mail ${email}.` })
      carregar()
    } catch (erro) {
      const primeiro = Object.values(erro.erros ?? {})[0]?.[0]
      setErroConvite(primeiro ?? erro.message)
    } finally {
      setEnviando(false)
    }
  }

  async function mudarPerfil(id, perfil) {
    setMenuAberto(null)
    try {
      await editarUsuario(id, { profile: perfil })
      setAviso(null)
      carregar()
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message })
    }
  }

  async function remover(usuario) {
    setMenuAberto(null)
    if (!window.confirm(`Remover o acesso de ${usuario.name}?`)) return
    try {
      await excluirUsuario(usuario.id)
      setAviso({ tipo: 'ok', texto: `Acesso de ${usuario.name} removido.` })
      carregar()
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: erro.message })
    }
  }

  return (
    <section id="cfg-usuarios" className="dash-card cfg-secao cfg-usuarios">
      <div className="cfg-secao-topo">
        <h2>Usuários e perfis</h2>
        {!convite && (
          <button type="button" className="cfg-btn-principal" onClick={() => setConvite(conviteVazio)}>
            <Icone nome="mais" tamanho={16} />
            Adicionar usuário
          </button>
        )}
      </div>

      {convite && (
        <form className="cfg-convite" onSubmit={enviarConvite} noValidate>
          <label>
            Nome
            <input
              value={convite.nome}
              onChange={(e) => setConvite({ ...convite, nome: e.target.value })}
              placeholder="Ex.: Bruna Souza"
              autoFocus
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={convite.email}
              onChange={(e) => setConvite({ ...convite, email: e.target.value })}
              placeholder="nome@empresa.com.br"
            />
          </label>
          <label>
            Senha inicial
            <input
              type="password"
              value={convite.senha}
              onChange={(e) => setConvite({ ...convite, senha: e.target.value })}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
            />
          </label>
          <label>
            Perfil
            <select value={convite.perfil} onChange={(e) => setConvite({ ...convite, perfil: e.target.value })}>
              {Object.entries(nomesPerfil).map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
          </label>
          <div className="cfg-convite-acoes">
            <button
              type="button"
              className="cfg-btn-secundario"
              onClick={() => {
                setConvite(null)
                setErroConvite('')
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="cfg-btn-principal" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
          {erroConvite && <p className="cfg-erro">{erroConvite}</p>}
        </form>
      )}

      {aviso && <p className={aviso.tipo === 'erro' ? 'cfg-erro' : 'cfg-cinza'}>{aviso.texto}</p>}
      {erroLista && <p className="cfg-erro">Não foi possível carregar os usuários: {erroLista}</p>}
      {!usuarios && !erroLista && <p className="cfg-cinza">Carregando usuários...</p>}

      {usuarios && (
        <div className="cfg-tabela-area">
          <table className="cfg-tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Último acesso</th>
                <th>
                  <span className="cfg-oculto">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const souEu = u.id === idAtual
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="cfg-pessoa">
                        <span className={`cfg-avatar ${u.profile === 'manager' ? 'gestor' : ''}`}>{iniciais(u.name)}</span>
                        {u.name}
                        {souEu && ' (você)'}
                      </span>
                    </td>
                    <td className="cfg-cinza">{u.email}</td>
                    <td>
                      <span className={`cfg-perfil ${classesPerfil[u.profile]}`}>{nomesPerfil[u.profile]}</span>
                    </td>
                    <td className="cfg-cinza">{souEu ? 'agora' : ultimoAcesso(u.last_seen_at)}</td>
                    <td className="cfg-acoes-celula">
                      {!souEu && (
                        <div className="cfg-menu-area">
                          <button
                            type="button"
                            className="cfg-menu-botao"
                            aria-label={`Opções de ${u.name}`}
                            aria-expanded={menuAberto === u.id}
                            onClick={() => setMenuAberto(menuAberto === u.id ? null : u.id)}
                          >
                            <Icone nome="opcoes" tamanho={18} />
                          </button>
                          {menuAberto === u.id && (
                            <ul className="cfg-menu">
                              {Object.entries(nomesPerfil)
                                .filter(([id]) => id !== u.profile)
                                .map(([id, nome]) => (
                                  <li key={id}>
                                    <button type="button" onClick={() => mudarPerfil(u.id, id)}>
                                      Mudar para {nome}
                                    </button>
                                  </li>
                                ))}
                              <li>
                                <button type="button" className="perigo" onClick={() => remover(u)}>
                                  Remover acesso
                                </button>
                              </li>
                            </ul>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default UsuariosPerfis
