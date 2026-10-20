import { pedidosPorHora } from './dados'

// Gráfico de barras simples (só HTML + CSS) com os pedidos separados por hora.
// A última barra é a hora atual, ainda em andamento, e fica destacada em amarelo.

function GraficoPedidos() {
  const maior = Math.max(...pedidosPorHora.map((item) => item.total))
  const teto = Math.ceil(maior / 10) * 10
  const linhas = [teto, teto / 2, 0]
  const total = pedidosPorHora.reduce((soma, item) => soma + item.total, 0)
  const ultima = pedidosPorHora.length - 1

  return (
    <div className="grafico">
      <div className="grafico-resumo">
        <strong>{total}</strong>
        <span>pedidos separados desde as 08h</span>
      </div>

      <div className="grafico-area">
        <div className="grafico-eixo">
          {linhas.map((valor) => (
            <span key={valor}>{valor}</span>
          ))}
        </div>

        <div className="grafico-barras">
          {linhas.map((valor) => (
            <span
              key={valor}
              className="grafico-grade"
              style={{ bottom: `calc(22px + (100% - 22px) * ${valor / teto})` }}
            />
          ))}

          {pedidosPorHora.map((item, i) => {
            const atual = i === ultima
            const pico = item.total === maior
            return (
              <div key={item.hora} className="grafico-coluna" tabIndex={0}>
                <div
                  className={`grafico-barra ${atual ? 'atual' : ''}`}
                  style={{ height: `${(item.total / teto) * 100}%` }}
                >
                  {(pico || atual) && <small className="grafico-valor">{item.total}</small>}
                  <span className={`grafico-dica ${i > ultima / 2 ? 'direita' : 'esquerda'}`}>
                    {item.hora}: {item.total} pedidos{atual ? ' (em andamento)' : ''}
                  </span>
                </div>
                <span className="grafico-hora">{item.hora}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default GraficoPedidos
