// Gráfico de linhas em SVG: período atual (linha cheia) x período anterior (tracejada).

const LARGURA = 680
const ALTURA = 250
const MARGEM = { topo: 12, direita: 16, baixo: 30, esquerda: 40 }

function topoDaEscala(maior) {
  const passo = maior > 60 ? 50 : 10
  return Math.max(passo, Math.ceil((maior * 1.05) / passo) * passo)
}

function GraficoLinha({ pontos, nomeAtual, nomeAnterior, unidade }) {
  const maior = Math.max(1, ...pontos.flatMap((p) => [p.atual, p.anterior]))
  const topo = topoDaEscala(maior)
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo

  const x = (i) => MARGEM.esquerda + (pontos.length === 1 ? larguraUtil / 2 : (i / (pontos.length - 1)) * larguraUtil)
  const y = (valor) => MARGEM.topo + alturaUtil - (valor / topo) * alturaUtil

  const linha = (campo) => pontos.map((p, i) => `${x(i)},${y(p[campo])}`).join(' ')
  const marcas = [0, 1, 2, 3].map((i) => (topo / 3) * i)

  // até 5 rótulos no eixo de baixo, sempre com o primeiro e o último
  const quantosRotulos = Math.min(5, pontos.length)
  const indicesRotulo = new Set(
    Array.from({ length: quantosRotulos }, (_, i) =>
      Math.round((i * (pontos.length - 1)) / Math.max(1, quantosRotulos - 1)),
    ),
  )
  const ultimo = pontos.length - 1

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="rel-grafico-linha"
      role="img"
      aria-label={`${nomeAtual}: ${pontos.map((p) => `${p.rotulo} ${p.atual}`).join(', ')}`}
    >
      {marcas.map((valor) => (
        <g key={valor}>
          <line x1={MARGEM.esquerda} x2={LARGURA - MARGEM.direita} y1={y(valor)} y2={y(valor)} className="rel-grade" />
          <text x={MARGEM.esquerda - 10} y={y(valor) + 4} className="rel-eixo-y">
            {Math.round(valor)}
          </text>
        </g>
      ))}

      {pontos.map(
        (p, i) =>
          indicesRotulo.has(i) && (
            <text key={p.rotulo} x={x(i)} y={ALTURA - 8} className="rel-eixo-x">
              {p.rotulo}
            </text>
          ),
      )}

      <polyline points={linha('anterior')} className="rel-linha anterior" />
      <polyline points={linha('atual')} className="rel-linha atual" />

      {pontos.map((p, i) => (
        <circle key={p.rotulo} cx={x(i)} cy={y(p.atual)} r={8} className="rel-ponto-area">
          <title>
            {p.rotulo}: {p.atual} {unidade} ({nomeAnterior.toLowerCase()}: {p.anterior})
          </title>
        </circle>
      ))}

      <circle cx={x(ultimo)} cy={y(pontos[ultimo].atual)} r={5} className="rel-ponto-final" />
    </svg>
  )
}

export default GraficoLinha
