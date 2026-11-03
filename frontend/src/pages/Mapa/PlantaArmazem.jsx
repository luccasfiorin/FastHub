import { DOCA_NA_PLANTA, PLANTA } from './dadosMapa'
import { iniciais } from '../../utils/formatar'

// Planta vista de cima: 1 estante por corredor, bloco de cima (posições 1–10) e de baixo (11–19).
// O coletor anda pelo vão à direita de cada estante e troca de corredor pelo corredor
// transversal, que fica entre os dois blocos.

const LARGURA = 752
const ALTURA = 714
const CENTRO_PRIMEIRO = 104
const ESPACO_CORREDOR = 136
const LARGURA_ESTANTE = 56
const ALTURA_POSICAO = 26
const PASSO_POSICAO = 29
const TOPO_BLOCO_1 = 30
const TOPO_BLOCO_2 = 367
const Y_TRANSVERSAL = 343
const Y_DOCA = 650

function xDaEstante(corredor) {
  return CENTRO_PRIMEIRO + corredor * ESPACO_CORREDOR - LARGURA_ESTANTE / 2
}

function yDaCelula(posicao) {
  if (posicao <= 10) return TOPO_BLOCO_1 + (posicao - 1) * PASSO_POSICAO
  return TOPO_BLOCO_2 + (posicao - 11) * PASSO_POSICAO
}

// vão à direita da estante; a doca usa o corredor -1 (à esquerda do A)
function xDoVao(corredor) {
  return CENTRO_PRIMEIRO + corredor * ESPACO_CORREDOR + ESPACO_CORREDOR / 2
}

function coordenada(ponto, desvio = 0) {
  const y = ponto === DOCA_NA_PLANTA ? Y_DOCA : yDaCelula(ponto.posicao) + ALTURA_POSICAO / 2
  return [xDoVao(ponto.corredor) + desvio, y]
}

// Linha andando só pelos corredores. O desvio separa as linhas de coletores diferentes
// quando passam pelo mesmo vão.
function caminho(pontos, desvio) {
  if (pontos.length < 2) return ''
  const linha = [coordenada(pontos[0], desvio)]
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]
    const b = pontos[i]
    const [ax] = coordenada(a, desvio)
    const [bx, by] = coordenada(b, desvio)
    if (a.corredor !== b.corredor) {
      linha.push([ax, Y_TRANSVERSAL + desvio], [bx, Y_TRANSVERSAL + desvio])
    }
    linha.push([bx, by])
  }
  return linha.map(([x, y]) => `${x},${y}`).join(' ')
}

// letra escura em cima de cor clara (ex.: amarelo), branca em cima de cor escura
function corDaSigla(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return r * 0.299 + g * 0.587 + b * 0.114 > 170 ? '#22253f' : '#fff'
}

function larguraDaEtiqueta(texto) {
  return texto.length * 6.3 + 16
}

function Etiqueta({ x, y, texto, esquerda = false }) {
  const largura = larguraDaEtiqueta(texto)
  const paraEsquerda = esquerda || x + 18 + largura > LARGURA - 4
  const inicio = paraEsquerda ? x - 18 - largura : x + 18

  return (
    <g className="arm-etiqueta">
      <rect x={inicio} y={y - 11} width={largura} height={22} rx={4} />
      <text x={inicio + 8} y={y + 4}>
        {texto}
      </text>
    </g>
  )
}

function PlantaArmazem({
  posicoes,
  selecionada,
  onSelecionar,
  camadas,
  coletores,
  rotaSelecionada,
  onSelecionarRota,
  termo,
}) {
  const combinaPosicao = (p) =>
    p.codigo.toLowerCase().includes(termo) || p.produtos.some((prod) => prod.nome.toLowerCase().includes(termo))
  const combinaColetor = (c) => c.nome.toLowerCase().includes(termo) || `#${c.pedido}`.includes(termo)

  const buscaEmPosicoes = termo && posicoes.some(combinaPosicao)
  const buscaEmColetores = termo && coletores.some(combinaColetor)
  const coletoresVisiveis = buscaEmColetores ? coletores.filter(combinaColetor) : coletores

  // Onde fica cada marcador: na última parada coletada ou, para quem ainda não saiu,
  // esperando dentro da doca, um ao lado do outro a partir da direita.
  let vagaNaDoca = LARGURA - 44
  const marcadores = coletoresVisiveis.map((c) => {
    if (c.aguardando) {
      const x = vagaNaDoca
      vagaNaDoca -= larguraDaEtiqueta(`${c.nome} · #${c.pedido}`) + 58
      return { coletor: c, x, y: Y_DOCA + 27, naDoca: true }
    }
    const atual = c.feitas > 0 ? c.paradas[c.feitas - 1].local : DOCA_NA_PLANTA
    const [x, y] = coordenada(atual, c.desvio)
    return { coletor: c, x, y, naDoca: false }
  })

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="arm-planta"
      role="group"
      aria-label="Planta do armazém com a ocupação das posições e as rotas dos coletores"
    >
      {PLANTA.corredores.map((letra, i) => (
        <text key={letra} x={xDaEstante(i) + LARGURA_ESTANTE / 2} y={16} className="arm-corredor">
          Corredor {letra}
        </text>
      ))}

      {posicoes.map((p) => {
        const x = xDaEstante(p.corredor)
        const y = yDaCelula(p.posicao)
        const ativa = p.codigo === selecionada
        const apagada =
          (camadas.alertas && !p.divergencia) || (buscaEmPosicoes && !combinaPosicao(p))
        const faixa = camadas.ocupacao || p.divergencia ? p.faixa : 'neutra'

        return (
          <g
            key={p.codigo}
            className={`arm-celula ${faixa} ${ativa ? 'ativa' : ''} ${apagada ? 'apagada' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={ativa}
            aria-label={`Posição ${p.codigo}, ${p.ocupacao}% ocupada${p.divergencia ? ', com divergência' : ''}`}
            onClick={() => onSelecionar(p.codigo)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelecionar(p.codigo)
              }
            }}
          >
            <title>
              {p.codigo} · {p.ocupacao}% ocupada
            </title>
            {p.divergencia && camadas.alertas && (
              <rect
                x={x - 4}
                y={y - 4}
                width={LARGURA_ESTANTE + 8}
                height={ALTURA_POSICAO + 8}
                rx={6}
                className="arm-celula-pulso"
              />
            )}
            <rect x={x} y={y} width={LARGURA_ESTANTE} height={ALTURA_POSICAO} rx={3} />
            {p.divergencia && (
              <text x={x + LARGURA_ESTANTE / 2} y={y + 17} className="arm-celula-codigo">
                {p.codigo}
              </text>
            )}
          </g>
        )
      })}

      <g className="arm-doca">
        <rect x={16} y={Y_DOCA} width={LARGURA - 32} height={54} rx={8} />
        <g transform={`translate(34 ${Y_DOCA + 17}) scale(0.8)`} className="arm-doca-icone">
          <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </g>
        <text x={62} y={Y_DOCA + 32}>
          Doca de expedição
        </text>
      </g>

      {camadas.rotas &&
        coletoresVisiveis.map((c) => {
          if (c.aguardando) return null
          const pontos = c.paradas.map((p) => p.local)
          const atual = c.feitas > 0 ? pontos[c.feitas - 1] : DOCA_NA_PLANTA
          const feito = caminho([DOCA_NA_PLANTA, ...pontos.slice(0, c.feitas)], c.desvio)
          const falta = caminho([atual, ...pontos.slice(c.feitas), DOCA_NA_PLANTA], c.desvio)
          const mostrarFalta = c.pedido === rotaSelecionada

          return (
            <g key={c.pedido} style={{ '--cor-coletor': c.cor }}>
              {mostrarFalta && falta && <polyline points={falta} className="arm-rota falta" />}
              {feito && <polyline points={feito} className="arm-rota feita" />}
            </g>
          )
        })}

      {camadas.coletores &&
        marcadores.map(({ coletor: c, x, y, naDoca }) => {
          const selecionado = c.pedido === rotaSelecionada

          return (
            <g
              key={c.pedido}
              className={`arm-coletor ${selecionado ? 'selecionado' : ''}`}
              style={{ '--cor-coletor': c.cor, '--cor-sigla': corDaSigla(c.cor) }}
              role="button"
              tabIndex={0}
              aria-pressed={selecionado}
              aria-label={`${c.nome}, pedido ${c.pedido}${c.aguardando ? ', aguardando na doca' : ''}. Mostrar rota`}
              onClick={() => onSelecionarRota(c.pedido)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelecionarRota(c.pedido)
                }
              }}
            >
              <circle cx={x} cy={y} r={13} />
              <text x={x} y={y + 4} className="arm-coletor-sigla">
                {iniciais(c.nome)}
              </text>
              <Etiqueta x={x} y={y} texto={`${c.nome} · #${c.pedido}`} esquerda={naDoca} />
            </g>
          )
        })}
    </svg>
  )
}

export default PlantaArmazem
