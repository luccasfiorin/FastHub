// Barras lado a lado: distância média por pedido com lista de papel x com a rota otimizada.

const LARGURA = 340
const ALTURA = 230
const BASE = 200
const TOPO = 24
const LARGURA_BARRA = 24

function GraficoDistancia({ grupos }) {
  const maior = Math.max(1, ...grupos.flatMap((g) => [g.papel, g.otimizada]))
  const espaco = (LARGURA - 20) / grupos.length
  const altura = (valor) => ((BASE - TOPO) * valor) / (maior * 1.05)

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="rel-grafico-barras"
      role="img"
      aria-label={grupos
        .map((g) => `${g.rotulo}: lista de papel ${g.papel} m, rota otimizada ${g.otimizada} m`)
        .join('; ')}
    >
      <line x1={10} x2={LARGURA - 10} y1={BASE} y2={BASE} className="rel-grade" />

      {grupos.map((g, i) => {
        const centro = 10 + espaco * i + espaco / 2
        const alturaPapel = altura(g.papel)
        const alturaOtimizada = altura(g.otimizada)

        return (
          <g key={g.rotulo}>
            <title>
              {g.titulo}: lista de papel {g.papel} m · rota otimizada {g.otimizada} m
            </title>
            <rect
              x={centro - LARGURA_BARRA - 2}
              y={BASE - alturaPapel}
              width={LARGURA_BARRA}
              height={alturaPapel}
              rx={2}
              className="rel-barra papel"
            />
            <rect
              x={centro + 2}
              y={BASE - alturaOtimizada}
              width={LARGURA_BARRA}
              height={alturaOtimizada}
              rx={2}
              className="rel-barra otimizada"
            />
            <text x={centro + 2 + LARGURA_BARRA / 2} y={BASE - alturaOtimizada - 8} className="rel-valor-barra">
              {g.otimizada}
            </text>
            <text x={centro} y={BASE + 20} className="rel-eixo-x">
              {g.rotulo}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default GraficoDistancia
