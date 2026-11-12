import { juntarTrechos } from '../../utils/rotaApi'

// Desenho da planta com a rota do pedido, a partir das coordenadas das posições cadastradas.
// Todas as posições do armazém aparecem como pequenos quadrados; as do pedido viram paradas numeradas.
// O caminho não é calculado aqui: é o traçado que veio da API (trecho de cada parada + volta à doca),
// o mesmo que o backend usou para medir a distância. A doca fica embaixo, como no Mapa do armazém.

const LARGURA = 600
const ALTURA_MAXIMA = 420
const MARGEM = 36
const TAMANHO_POSICAO = 14

function limites(pontos) {
  const xs = pontos.map((p) => p.x)
  const ys = pontos.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

// `doca` é o ponto da expedição, que vem da API (dock) junto com a rota.
// `retorno` é o caminho da última parada de volta à doca.
// `empilhadeira` ({ paradas, feitas, retorno }) é a rota própria dos itens grandes (RN04), desenhada em outra cor.
function MapaRota({ posicoes, paradas, feitas, concluido, doca, retorno = [], empilhadeira = null }) {
  const paradasEmpilhadeira = empilhadeira?.paradas ?? []
  const pontosDaPlanta = [
    doca,
    ...posicoes.map((p) => p.ponto),
    ...paradas.map((p) => p.ponto),
    ...paradasEmpilhadeira.map((p) => p.ponto),
  ]
  const { minX, maxX, minY, maxY } = limites(pontosDaPlanta)
  const larguraUtil = LARGURA - MARGEM * 2
  const escala = Math.min(
    larguraUtil / Math.max(maxX - minX, 1),
    (ALTURA_MAXIMA - MARGEM * 2) / Math.max(maxY - minY, 1),
  )
  const altura = Math.max(220, (maxY - minY) * escala + MARGEM * 2)

  // y em metros cresce para cima (a doca fica em y baixo); na tela, y cresce para baixo
  const tela = (ponto) => [MARGEM + (ponto.x - minX) * escala, MARGEM + (maxY - ponto.y) * escala]

  function linha(pontos) {
    if (pontos.length < 2) return ''
    return pontos.map((p) => tela(p).join(',')).join(' ')
  }

  // feito: trechos até a última parada coletada; falta: o resto e a volta à doca
  const caminhoFeito = linha(juntarTrechos(paradas.slice(0, feitas).map((p) => p.trecho)))
  const caminhoFalta = linha(juntarTrechos([...paradas.slice(feitas).map((p) => p.trecho), retorno]))
  const pontos = paradas.map((p) => p.ponto)

  // nome do corredor escrito em cima da primeira posição dele
  const corredores = new Map()
  for (const posicao of posicoes) {
    const atual = corredores.get(posicao.corredor)
    if (!atual || posicao.ponto.y > atual.y || (posicao.ponto.y === atual.y && posicao.ponto.x < atual.x)) {
      corredores.set(posicao.corredor, posicao.ponto)
    }
  }

  const [docaX, docaY] = tela(doca)

  // Rota da empilhadeira: mesmo desenho, com caminho e paradas próprios.
  const feitasEmp = empilhadeira?.feitas ?? 0
  const caminhoEmpFeito = linha(juntarTrechos(paradasEmpilhadeira.slice(0, feitasEmp).map((p) => p.trecho)))
  const caminhoEmpFalta = paradasEmpilhadeira.length
    ? linha(juntarTrechos([...paradasEmpilhadeira.slice(feitasEmp).map((p) => p.trecho), empilhadeira.retorno ?? []]))
    : ''

  // Se a empilhadeira para na mesma posição que o coletor a pé, desloca o marcador para não sobrepor.
  const ocupados = new Set(pontos.map((p) => `${p.x},${p.y}`))
  const DESLOCAMENTO = 13

  return (
    <div className="ped-mapa">
      <svg
        viewBox={`0 0 ${LARGURA} ${altura}`}
        className="ped-mapa-svg"
        role="img"
        aria-label={`Rota com ${paradas.length} paradas, ${feitas} já coletadas${
          empilhadeira ? `; rota da empilhadeira com ${paradasEmpilhadeira.length} paradas` : ''
        }`}
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

        {caminhoEmpFalta && <polyline points={caminhoEmpFalta} className="ped-caminho empilhadeira falta" />}
        {caminhoEmpFeito && <polyline points={caminhoEmpFeito} className="ped-caminho empilhadeira feito" />}

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

        {paradasEmpilhadeira.map((parada, i) => {
          let [x, y] = tela(parada.ponto)
          if (ocupados.has(`${parada.ponto.x},${parada.ponto.y}`)) {
            x += DESLOCAMENTO
            y -= DESLOCAMENTO
          }
          const proxima = !concluido && i === feitasEmp
          let classe = i < feitasEmp ? 'feita' : 'falta'
          if (proxima) classe = 'proxima'

          return (
            <g key={`emp-${parada.id}`} className={`ped-parada empilhadeira ${classe}`}>
              {proxima && <circle cx={x} cy={y} r={17} className="ped-parada-halo" />}
              <rect x={x - 11} y={y - 10} width={22} height={20} rx={5} />
              <text x={x} y={y + 3.5}>E{i + 1}</text>
              <title>
                Empilhadeira {i + 1}: {parada.codigo} · {parada.produto}
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
        {empilhadeira && (
          <li>
            <span className="ped-legenda-ponto empilhadeira" /> Empilhadeira (itens grandes)
          </li>
        )}
      </ul>
    </div>
  )
}

export default MapaRota
