import Icone from './Icone'
import '../pages/Dashboard/Dashboard.css'

const menu = [
  { id: 'inicio', nome: 'Início' },
  { id: 'pedidos', nome: 'Pedidos' },
  { id: 'mapa', nome: 'Mapa do armazém' },
  { id: 'coletores', nome: 'Coletores' },
  { id: 'relatorios', nome: 'Relatórios' },
]

function Sidebar({ ativo, pedidosAbertos, onNavegar, onSair }) {
  return (
    <aside className="dash-sidebar">
      <span className="dash-logo">FastHub</span>
      <small className="dash-logo-sub">by Telecontrol</small>

      <nav className="dash-menu">
        {menu.map((item) => (
          <a
            key={item.id}
            href="#"
            className={`dash-menu-item ${item.id === ativo ? 'ativo' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              onNavegar(item.id)
            }}
          >
            <Icone nome={item.id} className="dash-menu-icone" />
            {item.nome}
            {item.id === 'pedidos' && pedidosAbertos > 0 && (
              <span className="dash-menu-contador">{pedidosAbertos}</span>
            )}
          </a>
        ))}
      </nav>

      <div className="dash-sidebar-rodape">
        <a
          href="#"
          className={ativo === 'configuracoes' ? 'ativo' : ''}
          onClick={(e) => {
            e.preventDefault()
            onNavegar('configuracoes')
          }}
        >
          <Icone nome="configuracoes" tamanho={16} />
          Configurações
        </a>
        <button type="button" onClick={onSair}>
          <Icone nome="sair" tamanho={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
