import { useState } from 'react'
import Icone from './Icone'
import { formatarHora, iniciais } from '../utils/formatar'

function Header({ titulo, subtitulo, usuario, busca, onBusca, alertas = [] }) {
  const [aberto, setAberto] = useState(false)

  return (
    <header className="dash-topo">
      <div>
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
      </div>

      <div className="dash-topo-acoes">
        <label className="dash-busca">
          <Icone nome="busca" tamanho={16} />
          <input
            type="search"
            placeholder="Buscar pedido ou coletor..."
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
          />
        </label>

        <div className="dash-alerta-area">
          <button
            type="button"
            className={`dash-alerta col-sino ${alertas.length ? 'com-alerta' : ''}`}
            aria-label="Notificações"
            aria-expanded={aberto}
            onClick={() => setAberto(!aberto)}
          >
            <Icone nome="sino" tamanho={18} />
          </button>

          {aberto && (
            <div className="dash-alertas">
              <strong>Alertas de hoje</strong>
              {alertas.length === 0 ? (
                <p className="col-alertas-vazio">Nenhuma divergência registrada hoje.</p>
              ) : (
                <ul>
                  {alertas.map((alerta) => (
                    <li key={alerta.id}>
                      <span className="dash-alertas-icone erro">
                        <Icone nome="aviso" tamanho={14} />
                      </span>
                      <div>
                        <p>{alerta.text}</p>
                        <small>às {formatarHora(alerta.at)}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="dash-usuario">
          <span className="dash-avatar">{usuario ? iniciais(usuario.name) : ''}</span>
          <div>
            <strong>{usuario?.name}</strong>
            <small>{usuario?.job_title ?? 'Gestor'}</small>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
