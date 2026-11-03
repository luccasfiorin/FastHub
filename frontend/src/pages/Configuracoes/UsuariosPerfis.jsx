import { useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { iniciais } from '../../utils/formatar'
import { nomesPerfil } from './dadosConfiguracoes'

const conviteVazio = { nome: '', email: '', perfil: 'coletor' }

function UsuariosPerfis({ usuarios, idAtual, onAlterar }) {
  const [convite, setConvite] = useState(null) // null = formulário fechado
  const [erroConvite, setErroConvite] = useState('')
  const [menuAberto, setMenuAberto] = useState(null)

  // fecha o menu "..." ao clicar fora dele
  useEffect(() => {
    if (!menuAberto) return undefined
    const fechar = (e) => {
      if (!e.target.closest('.cfg-menu-area')) setMenuAberto(null)
    }
    document.addEventListener('click', fechar)
    return () => document.removeEventListener('click', fechar)
  }, [menuAberto])

  function enviarConvite(e) {
    e.preventDefault()
    const nome = convite.nome.trim()
    const email = convite.email.trim().toLowerCase()

    if (!nome) return setErroConvite('Informe o nome da pessoa.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErroConvite('Informe um e-mail válido.')
    if (usuarios.some((u) => u.email.toLowerCase() === email)) {
      return setErroConvite('Já existe um usuário com esse e-mail.')
    }

    onAlterar([...usuarios, { id: email, nome, email, perfil: convite.perfil, ultimoAcesso: 'Convite enviado' }])
    setConvite(null)
    setErroConvite('')
  }

  function mudarPerfil(id, perfil) {
    onAlterar(usuarios.map((u) => (u.id === id ? { ...u, perfil } : u)))
    setMenuAberto(null)
  }

  function remover(id) {
    onAlterar(usuarios.filter((u) => u.id !== id))
    setMenuAberto(null)
  }

  return (
    <section id="cfg-usuarios" className="dash-card cfg-secao cfg-usuarios">
      <div className="cfg-secao-topo">
        <h2>Usuários e perfis</h2>
        {!convite && (
          <button type="button" className="cfg-btn-principal" onClick={() => setConvite(conviteVazio)}>
            <Icone nome="mais" tamanho={16} />
            Convidar usuário
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
              placeholder="Ex.: Bruna S."
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
            <button type="submit" className="cfg-btn-principal">
              Enviar convite
            </button>
          </div>
          {erroConvite && <p className="cfg-erro">{erroConvite}</p>}
        </form>
      )}

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
                      <span className={`cfg-avatar ${u.perfil === 'gestor' ? 'gestor' : ''}`}>{iniciais(u.nome)}</span>
                      {u.nome}
                    </span>
                  </td>
                  <td className="cfg-cinza">{u.email}</td>
                  <td>
                    <span className={`cfg-perfil ${u.perfil}`}>{nomesPerfil[u.perfil]}</span>
                  </td>
                  <td className="cfg-cinza">{u.ultimoAcesso}</td>
                  <td className="cfg-acoes-celula">
                    {!souEu && (
                      <div className="cfg-menu-area">
                        <button
                          type="button"
                          className="cfg-menu-botao"
                          aria-label={`Opções de ${u.nome}`}
                          aria-expanded={menuAberto === u.id}
                          onClick={() => setMenuAberto(menuAberto === u.id ? null : u.id)}
                        >
                          <Icone nome="opcoes" tamanho={18} />
                        </button>
                        {menuAberto === u.id && (
                          <ul className="cfg-menu">
                            {Object.entries(nomesPerfil)
                              .filter(([id]) => id !== u.perfil)
                              .map(([id, nome]) => (
                                <li key={id}>
                                  <button type="button" onClick={() => mudarPerfil(u.id, id)}>
                                    Mudar para {nome}
                                  </button>
                                </li>
                              ))}
                            <li>
                              <button type="button" className="perigo" onClick={() => remover(u.id)}>
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
    </section>
  )
}

export default UsuariosPerfis
