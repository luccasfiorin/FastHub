import { iniciais } from '../../utils/formatar'

// Planta vista de cima: 1 estante por corredor, bloco de cima (prateleira 1) e de baixo (prateleira 2).
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
// fim do texto "Doca de expedição": marcadores na doca ficam à direita disso
const LIMITE_DOCA = 200

// A doca fica à esquerda do primeiro corredor, embaixo.
const DOCA_NA_PLANTA = { corredor: -1, doca: true }

function xDaEstante(corredor) {
  return CENTRO_PRIMEIRO + corredor * ESPACO_CORREDOR - LARGURA_ESTANTE / 2
}

function yDaCelula(posicao, limiteBloco) {
  if (posicao <= limiteBloco) return TOPO_BLOCO_1 + (posicao - 1) * PASSO_POSICAO
  return TOPO_BLOCO_2 + (posicao - limiteBloco - 1) * PASSO_POSICAO
}

// vão à direita da estante; a doca usa o corredor -1 (à esquerda do A)
function xDoVao(corredor) {
  return CENTRO_PRIMEIRO + corredor * ESPACO_CORREDOR + ESPACO_CORREDOR / 2
}

function coordenada(ponto, limiteBloco, desvio = 0) {
  const y = ponto.doca ? Y_DOCA : yDaCelula(ponto.posicao, limiteBloco) + ALTURA_POSICAO / 2
  return [xDoVao(ponto.corredor) + desvio, y]
}

// Linha andando só pelos corredores. O desvio separa as linhas de coletores diferentes
// quando passam pelo mesmo vão.
function caminho(pontos, limiteBloco, desvio) {
  if (pontos.length < 2) return ''
  const linha = [coordenada(pontos[0], limiteBloco, desvio)]
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1]
    const b = pontos[i]
    const [ax] = coordenada(a, limiteBloco, desvio)
    const [bx, by] = coordenada(b, limiteBloco, desvio)
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
  planta,
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
  // Quem não cabe na faixa da doca entra só na contagem "+N aguardando".
  let vagaNaDoca = LARGURA - 44
  let foraDaDoca = 0
  const marcadores = coletoresVisiveis.map((c) => {
    if (c.aguardando) {
      const x = vagaNaDoca
      const largura = larguraDaEtiqueta(`${c.nome} · #${c.pedido}`) + 58
      if (x - largura + 40 < LIMITE_DOCA) {
        foraDaDoca += 1
        return null
      }
      vagaNaDoca -= largura
      return { coletor: c, x, y: Y_DOCA + 27, naDoca: true }
    }
    const atual = c.feitas > 0 ? c.paradas[c.feitas - 1].local : DOCA_NA_PLANTA
    const [x, y] = coordenada(atual, planta.limiteBloco, c.desvio)
    return { coletor: c, x, y, naDoca: false }
  }).filter(Boolean)

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      className="arm-planta"
      role="group"
      aria-label="Planta do armazém com as posições, os produtos e as rotas dos coletores"
    >
      {planta.corredores.map((letra, i) => (
        <text key={letra} x={xDaEstante(i) + LARGURA_ESTANTE / 2} y={16} className="arm-corredor">
          Corredor {letra}
        </text>
      ))}

      {posicoes.map((p) => {
        const x = xDaEstante(p.corredor)
        const y = yDaCelula(p.posicao, planta.limiteBloco)
        const ativa = p.id === selecionada
        const apagada =
          (camadas.alertas && !p.divergencia) || (buscaEmPosicoes && !combinaPosicao(p))
        const faixa = camadas.ocupacao || p.divergencia ? p.faixa : 'neutra'

        return (
          <g
            key={p.id}
            className={`arm-celula ${faixa} ${ativa ? 'ativa' : ''} ${apagada ? 'apagada' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={ativa}
            aria-label={`Posição ${p.codigo}, ${p.ocupada ? 'com produto' : 'sem produto'}${p.divergencia ? ', com divergência' : ''}`}
            onClick={() => onSelecionar(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelecionar(p.id)
              }
            }}
          >
            <title>
              {p.codigo} · {p.produtos.length ? p.produtos.map((prod) => prod.nome).join(', ') : 'sem produto'}
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
        {camadas.coletores && foraDaDoca > 0 && (
          <text x={62} y={Y_DOCA + 47} className="arm-doca-extra">
            +{foraDaDoca} {foraDaDoca === 1 ? 'pedido aguardando' : 'pedidos aguardando'}
          </text>
        )}
      </g>

      {camadas.rotas &&
        coletoresVisiveis.map((c) => {
          if (c.aguardando) return null
          const pontos = c.paradas.map((p) => p.local)
          const atual = c.feitas > 0 ? pontos[c.feitas - 1] : DOCA_NA_PLANTA
          const feito = caminho([DOCA_NA_PLANTA, ...pontos.slice(0, c.feitas)], planta.limiteBloco, c.desvio)
          const falta = caminho([atual, ...pontos.slice(c.feitas), DOCA_NA_PLANTA], planta.limiteBloco, c.desvio)
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
