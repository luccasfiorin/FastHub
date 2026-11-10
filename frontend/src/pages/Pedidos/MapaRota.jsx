import { DOCA } from '../../utils/rota'

// Desenho da planta com a rota do pedido, a partir das coordenadas das posições cadastradas.
// Todas as posições do armazém aparecem como pequenos quadrados; as do pedido viram paradas numeradas.
// O caminho anda primeiro na horizontal e depois na vertical, como pelos corredores.

const LARGURA = 600
const ALTURA_MAXIMA = 420
const MARGEM = 36
const TAMANHO_POSICAO = 14

function limites(pontos) {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

// `doca` é o ponto da expedição; vem da API (dock) e, sem ela, fica na origem da planta.
function MapaRota({ posicoes, paradas, feitas, concluido, doca = DOCA }) {
  const pontosDaPlanta = [doca, ...posicoes.map((p) => p.ponto), ...paradas.map((p) => p.ponto)]
  const { minX, maxX, minY, maxY } = limites(pontosDaPlanta)
  const larguraUtil = LARGURA - MARGEM * 2
  const escala = Math.min(
    larguraUtil / Math.max(maxX - minX, 1),
    (ALTURA_MAXIMA - MARGEM * 2) / Math.max(maxY - minY, 1),
  )
  const altura = Math.max(220, (maxY - minY) * escala + MARGEM * 2)

  const tela = (ponto) => [MARGEM + (ponto.x - minX) * escala, MARGEM + (ponto.y - minY) * escala]

  function caminho(pontos) {
    if (pontos.length < 2) return ''
    const linha = [tela(pontos[0])]
    for (let i = 1; i < pontos.length; i++) {
      const [ax, ay] = tela(pontos[i - 1])
      const [bx, by] = tela(pontos[i])
      if (ax !== bx && ay !== by) linha.push([bx, ay])
      linha.push([bx, by])
    }
    return linha.map(([x, y]) => `${x},${y}`).join(' ')
  }

  const pontos = paradas.map((p) => p.ponto)
  const ultimoFeito = feitas > 0 ? pontos[feitas - 1] : doca
  const caminhoFeito = caminho([doca, ...pontos.slice(0, feitas)])
  const caminhoFalta = caminho([ultimoFeito, ...pontos.slice(feitas), doca])

  // nome do corredor escrito em cima da primeira posição dele
  const corredores = new Map()
  for (const posicao of posicoes) {
    const atual = corredores.get(posicao.corredor)
    if (!atual || posicao.ponto.y < atual.y || (posicao.ponto.y === atual.y && posicao.ponto.x < atual.x)) {
      corredores.set(posicao.corredor, posicao.ponto)
    }
  }

  const [docaX, docaY] = tela(doca)

  return (
    <div className="ped-mapa">
      <svg
        viewBox={`0 0 ${LARGURA} ${altura}`}
        className="ped-mapa-svg"
        role="img"
        aria-label={`Rota com ${paradas.length} paradas, ${feitas} já coletadas`}
      >
        {posicoes.map((posicao) => {
          const [x, y] = tela(posicao.ponto)
          return (
            <rect
              key={posicao.id}
              x={x - TAMANHO_POSICAO / 2}
              y={y - TAMANHO_POSICAO / 2}
              width={TAMANHO_POSICAO}
              height={TAMANHO_POSICAO}
              rx={3}
              className="ped-estante"
            >
              <title>{posicao.codigo}</title>
            </rect>
          )
        })}

        {[...corredores].map(([corredor, ponto]) => {
          const [x, y] = tela(ponto)
          return (
            <text key={corredor} x={x} y={y - 14} className="ped-mapa-letra">
              {corredor}
            </text>
          )
        })}

        <rect x={docaX - 16} y={docaY - 7} width={32} height={14} rx={3} className="ped-doca" />
        <text x={docaX} y={docaY - 14} className="ped-mapa-letra pequena">
          Doca
        </text>

        {caminhoFalta && <polyline points={caminhoFalta} className="ped-caminho falta" />}
        {caminhoFeito && <polyline points={caminhoFeito} className="ped-caminho feito" />}

        {paradas.map((parada, i) => {
          const [x, y] = tela(parada.ponto)
          const numero = i + 1
          const proxima = !concluido && i === feitas
          let classe = i < feitas ? 'feita' : 'falta'
          if (proxima) classe = 'proxima'

          return (
            <g key={parada.id} className={`ped-parada ${classe}`}>
              {proxima && <circle cx={x} cy={y} r={17} className="ped-parada-halo" />}
              <circle cx={x} cy={y} r={proxima ? 12 : 10} />
              <text x={x} y={y + 3.5}>{numero}</text>
              <title>
                Parada {numero}: {parada.codigo} · {parada.produto}
              </title>
            </g>
          )
        })}
      </svg>

      <ul className="ped-legenda">
        <li>
          <span className="ped-legenda-ponto feita" /> Parada feita
        </li>
        <li>
          <span className="ped-legenda-ponto proxima" /> Próxima parada
        </li>
        <li>
          <span className="ped-legenda-ponto falta" /> Falta coletar
        </li>
      </ul>
    </div>
  )
}

export default MapaRota
