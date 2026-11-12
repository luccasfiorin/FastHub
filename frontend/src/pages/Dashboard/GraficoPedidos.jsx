// Gráfico de barras simples (só HTML + CSS) com os pedidos concluídos por hora hoje.
// `porHora` vem de GET /dashboard: [{ hour: 13, orders: 11 }, ...], até a hora atual.
// A última barra é a hora atual, ainda em andamento, e fica destacada em amarelo.

function GraficoPedidos({ porHora }) {
  if (!porHora || porHora.length === 0) {
    return <p className="dash-vazio">Nenhum pedido concluído hoje ainda.</p>
  }

  const barras = porHora.map((item) => ({ hora: `${String(item.hour).padStart(2, '0')}h`, total: item.orders }))
  const maior = Math.max(...barras.map((item) => item.total), 1)
  const teto = Math.max(10, Math.ceil(maior / 10) * 10)
  const linhas = [teto, teto / 2, 0]
  const total = barras.reduce((soma, item) => soma + item.total, 0)
  const ultima = barras.length - 1

  return (
    <div className="grafico">
      <div className="grafico-resumo">
        <strong>{total}</strong>
        <span>pedidos separados desde as {barras[0].hora}</span>
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

          {barras.map((item, i) => {
            const atual = i === ultima
            const pico = item.total === maior && maior > 0
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
