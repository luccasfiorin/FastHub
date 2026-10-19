import { useState } from 'react'
import './Login.css'

function Login() {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')

  function handleSubmit(e) {
    e.preventDefault()

    if (!usuario.trim() || !senha) {
      setErro('Preencha o usuário e a senha para continuar.')
      return
    }

    setErro('')
  }

  return (
    <div className="login">
      <aside className="login-banner">
        <div className="login-circulos" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <span className="login-logo">Telecontrol</span>

        <div className="login-banner-texto">
          <h1>
            Sistema
            <br />
            Pós-venda
          </h1>
          <p>Gerencie atendimento, ordens de serviço e assistências técnicas em um só lugar.</p>
          <span className="login-barra" />
        </div>

        <small className="login-rodape">© 2026 Telecontrol · Marília - SP</small>
      </aside>

      <main className="login-conteudo">
        <div className="login-box">
          <h2>Bem-vindo de volta</h2>
          <p className="login-subtitulo">Acesse o sistema com seus dados de login</p>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="campo">
              <label htmlFor="usuario">Usuário ou e-mail</label>
              <input
                id="usuario"
                type="text"
                placeholder="seu.usuario@empresa.com.br"
                autoComplete="username"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
            </div>

            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <div className="campo-senha">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-mostrar"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="login-opcoes">
              <label className="lembrar">
                <input
                  type="checkbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                />
                Lembrar de mim
              </label>
              <a href="#" className="esqueci">
                Esqueci minha senha
              </a>
            </div>

            {erro && <p className="login-erro">{erro}</p>}

            <button type="submit" className="btn btn-entrar">
              Entrar
            </button>
          </form>

          <div className="divisor">ou</div>

          <button type="button" className="btn btn-credenciamento">
            Auto Credenciamento
          </button>

          <p className="login-ajuda">
            Precisa de ajuda? <a href="#">Fale com o suporte</a>
          </p>
        </div>
      </main>
    </div>
  )
}

export default Login
