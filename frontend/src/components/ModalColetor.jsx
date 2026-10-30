import { useState } from 'react'
import Icone from './Icone'

// Serve para cadastrar (coletor = null) e para editar.
function ModalColetor({ coletor, onSalvar, onFechar }) {
  const editando = Boolean(coletor)
  const [form, setForm] = useState({
    name: coletor?.name ?? '',
    email: coletor?.email ?? '',
    password: '',
    picker_type: coletor?.picker_type ?? 'foot',
    operator_name: coletor?.operator_name ?? '',
    work_status: coletor?.work_status ?? 'offline',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [erros, setErros] = useState({})

  const mudar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })

  async function enviar(e) {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    setErros({})

    const corpo = {
      ...form,
      operator_name: form.picker_type === 'forklift' ? form.operator_name || null : null,
    }
    if (editando && !corpo.password) delete corpo.password

    try {
      await onSalvar(corpo)
    } catch (err) {
      setErro(err.message)
      setErros(err.erros ?? {})
      setSalvando(false)
    }
  }

  const campoErro = (campo) => erros[campo] && <small className="col-erro-campo">{erros[campo][0]}</small>

  return (
    <div className="col-fundo" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form className="col-modal" role="dialog" aria-modal="true" aria-labelledby="col-modal-titulo" onSubmit={enviar}>
        <div className="col-modal-topo">
          <h2 id="col-modal-titulo">{editando ? 'Editar coletor' : 'Adicionar coletor'}</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar}>
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>

        <label>
          Nome
          <input value={form.name} onChange={mudar('name')} placeholder="Ex.: Ana P." required />
          {campoErro('name')}
        </label>

        <label>
          E-mail de acesso
          <input type="email" value={form.email} onChange={mudar('email')} required />
          {campoErro('email')}
        </label>

        <label>
          {editando ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
          <input
            type="password"
            value={form.password}
            onChange={mudar('password')}
            minLength={8}
            autoComplete="new-password"
            required={!editando}
          />
          {campoErro('password')}
        </label>

        <div className="col-modal-linha">
          <label>
            Função
            <select value={form.picker_type} onChange={mudar('picker_type')}>
              <option value="foot">Coleta a pé</option>
              <option value="forklift">Empilhadeira</option>
            </select>
          </label>

          <label>
            Status
            <select value={form.work_status} onChange={mudar('work_status')}>
              <option value="offline">Offline</option>
              <option value="active">Ativo</option>
              <option value="paused">Em pausa</option>
            </select>
          </label>
        </div>

        {form.picker_type === 'forklift' && (
          <label>
            Operador
            <input value={form.operator_name} onChange={mudar('operator_name')} placeholder="Ex.: Marcos T." />
            {campoErro('operator_name')}
          </label>
        )}

        {erro && <p className="col-aviso erro">{erro}</p>}

        <div className="col-modal-rodape">
          <button type="button" className="secundario" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar coletor'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ModalColetor
