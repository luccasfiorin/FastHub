import { DOCA, PLANTA } from '../../utils/rota'

// Desenho da planta com a rota do pedido.
// Estantes: 1 coluna por corredor, com um bloco em cima (posições 1–10) e outro embaixo (11–19).
// O coletor anda pelo vão à direita de cada estante; para trocar de corredor passa pelo transversal.

const LARGURA_ESTANTE = 34
const ESPACO_CORREDOR = 110
const INICIO_X = 60
const TOPO_BLOCO_1 = 20
const TOPO_BLOCO_2 = 260
const Y_TRANSVERSAL = 240
const ALTURA_POSICAO = 20

function xDoCorredor(corredor) {
  // vão à direita da estante (a doca usa corredor -1 e fica à esquerda do A)
  const xEstante = INICIO_X + corredor * ESPACO_CORREDOR
  return xEstante + LARGURA_ESTANTE + (ESPACO_CORREDOR - LARGURA_ESTANTE) / 2
}

function yDaPosicao(posicao) {
  if (posicao <= 10) return TOPO_BLOCO_1 + (posicao - 0.5) * ALTURA_POSICAO
  return TOPO_BLOCO_2 + (posicao - 10.5) * ALTURA_POSICAO
}

function coordenada(ponto) {
  return [xDoCorredor(ponto.corredor), yDaPosicao(ponto.posicao)]
}

// Liga dois pontos andando só por corredores (troca de corredor pelo transversal).
function trecho(a, b) {
  const [ax] = coordenada(a)
  const [bx, by] = coordenada(b)
  if (a.corredor === b.corredor) return [[bx, by]]
  return [
    [ax, Y_TRANSVERSAL],
    [bx, Y_TRANSVERSAL],
    [bx, by],
  ]
}

function caminho(pontos) {
  if (pontos.length < 2) return ''
  const linha = [coordenada(pontos[0])]
  for (let i = 1; i < pontos.length; i++) {
    linha.push(...trecho(pontos[i - 1], pontos[i]))
  }
  return linha.map(([x, y]) => `${x},${y}`).join(' ')
}

function MapaRota({ paradas, feitas, concluido }) {
  const pontos = paradas.map((p) => p.ponto)
  const ultimoFeito = feitas > 0 ? pontos[feitas - 1] : DOCA

  const caminhoFeito = caminho([DOCA, ...pontos.slice(0, feitas)])
  const caminhoFalta = caminho([ultimoFeito, ...pontos.slice(feitas), DOCA])

  const larguraTotal = INICIO_X + PLANTA.corredores.length * ESPACO_CORREDOR
  const [docaX, docaY] = coordenada(DOCA)

  return (
    <div className="ped-mapa">
      <svg
        viewBox={`0 0 ${larguraTotal} 480`}
        className="ped-mapa-svg"
        role="img"
        aria-label={`Rota com ${paradas.length} paradas, ${feitas} já coletadas`}
      >
        {PLANTA.corredores.map((letra, i) => {
          const x = INICIO_X + i * ESPACO_CORREDOR
          return (
            <g key={letra}>
              <rect x={x} y={TOPO_BLOCO_1} width={LARGURA_ESTANTE} height={200} rx={4} className="ped-estante" />
              <rect x={x} y={TOPO_BLOCO_2} width={LARGURA_ESTANTE} height={180} rx={4} className="ped-estante" />
              <text x={x + LARGURA_ESTANTE / 2} y={466} className="ped-mapa-letra">
                {letra}
              </text>
            </g>
          )
        })}

        <rect x={docaX - 16} y={docaY + 4} width={32} height={14} rx={3} className="ped-doca" />
        <text x={docaX} y={docaY + 34} className="ped-mapa-letra pequena">
          Doca
        </text>

        {caminhoFalta && <polyline points={caminhoFalta} className="ped-caminho falta" />}
        {caminhoFeito && <polyline points={caminhoFeito} className="ped-caminho feito" />}

        {paradas.map((parada, i) => {
          const [x, y] = coordenada(parada.ponto)
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
