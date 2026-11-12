import { iniciais } from '../../utils/formatar'
import { juntarTrechos } from '../../utils/rotaApi'

// Planta vista de cima: 1 estante por corredor, bloco de cima (prateleira 1) e de baixo (prateleira 2).
// O coletor anda pelo vão à direita de cada estante e troca de corredor pelo corredor
// transversal (entre os dois blocos) ou pela frente, junto à doca.
// As rotas não são calculadas aqui: o traçado vem da API em metros e é só convertido para o desenho.

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

// Interpolação linear por partes entre pares [valor em metros, valor no desenho].
// Fora da faixa conhecida, continua a reta das duas pontas.
function interpolador(pares) {
  const porValor = new Map()
  for (const [metros, tela] of pares) {
    const chave = Math.round(metros * 100) / 100
    const lista = porValor.get(chave) ?? []
    lista.push(tela)
    porValor.set(chave, lista)
  }
  const pontos = [...porValor]
    .map(([metros, lista]) => [metros, lista.reduce((s, v) => s + v, 0) / lista.length])
    .sort((p, q) => p[0] - q[0])

  return (valor) => {
    if (pontos.length === 0) return 0
    if (pontos.length === 1) return pontos[0][1]
    let i = pontos.findIndex(([metros]) => metros >= valor)
    if (i === -1) i = pontos.length - 1
    if (i === 0) i = 1
    const [m0, t0] = pontos[i - 1]
    const [m1, t1] = pontos[i]
    return t0 + ((valor - m0) / (m1 - m0)) * (t1 - t0)
  }
}

// Converte um ponto em metros (coord_x, coord_y) para o desenho, usando as posições cadastradas
// como referência: cada corredor vira o vão dele, cada altura vira a linha da posição,
// a travessa do meio vira o corredor transversal e a frente (altura da doca) vira a doca.
function criarConversor(posicoes, planta, geometria) {
  const doca = geometria?.doca ?? { x: 0, y: 0 }
  const travessas = geometria?.travessas ?? []

  const xs = [[doca.x, xDoVao(-1)], ...posicoes.map((p) => [p.ponto.x, xDoVao(p.corredor)])]
  const ys = [
    [doca.y, Y_DOCA],
    ...posicoes.map((p) => [p.ponto.y, yDaCelula(p.posicao, planta.limiteBloco) + ALTURA_POSICAO / 2]),
    ...travessas.filter((t) => Math.abs(t - doca.y) > 0.01).map((t) => [t, Y_TRANSVERSAL]),
  ]
  const paraX = interpolador(xs)
  const paraY = interpolador(ys)

  return (ponto, desvio = 0) => [paraX(ponto.x) + desvio, paraY(ponto.y) + desvio]
}

function linha(pontos, converter, desvio) {
  if (pontos.length < 2) return ''
  return pontos.map((p) => converter(p, desvio).join(',')).join(' ')
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
  geometria,
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
  const converter = criarConversor(posicoes, planta, geometria)
  const doca = geometria?.doca ?? { x: 0, y: 0 }

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
    const atual = c.feitas > 0 ? c.paradas[c.feitas - 1].ponto : doca
    const [x, y] = converter(atual, c.desvio)
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
          // mesmo traçado que o backend mediu: trechos até a última coletada e o que falta + volta
          const feito = linha(juntarTrechos(c.paradas.slice(0, c.feitas).map((p) => p.trecho)), converter, c.desvio)
          const falta = linha(
            juntarTrechos([...c.paradas.slice(c.feitas).map((p) => p.trecho), c.retorno]),
            converter,
            c.desvio,
          )
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
