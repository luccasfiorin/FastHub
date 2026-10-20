import { rotas } from './dados'

// Mapa simplificado do armazém: 5 corredores (A–E), cada um com 2 blocos de prateleira.
// A rota do pedido selecionado é desenhada por cima: trecho já coletado em linha cheia,
// trecho que falta em linha tracejada.

const corredores = ['A', 'B', 'C', 'D', 'E']
const larguraPrateleira = 30

function pontosParaTexto(pontos) {
  return pontos.map(([x, y]) => `${x},${y}`).join(' ')
}

function MapaArmazem({ pedido }) {
  const pontos = rotas[pedido.rota]
  const totalParadas = pontos.length - 1
  const coletados = Math.round((pedido.progresso / 100) * totalParadas)
  const concluido = coletados === totalParadas

  const trechoFeito = pontos.slice(0, coletados + 1)
  const trechoFalta = pontos.slice(coletados)

  return (
    <div className="mapa">
      <svg
        viewBox="0 0 340 262"
        className="mapa-svg"
        role="img"
        aria-label={`Rota do pedido ${pedido.numero}: ${coletados} de ${totalParadas} paradas coletadas`}
      >
        {corredores.map((letra, i) => {
          const x = 32.5 + i * 65
          return (
            <g key={letra}>
              <rect
                x={x}
                y={18}
                width={larguraPrateleira}
                height={100}
                rx={4}
                className="mapa-prateleira"
              />
              <rect
                x={x}
                y={142}
                width={larguraPrateleira}
                height={90}
                rx={4}
                className="mapa-prateleira"
              />
              <text x={x + 15} y={252} className="mapa-letra">
                {letra}
              </text>
            </g>
          )
        })}

        <rect x={2} y={236} width={22} height={12} rx={2} className="mapa-doca" />
        <text x={2} y={230} className="mapa-doca-texto">
          Doca
        </text>

        {trechoFalta.length > 1 && (
          <polyline points={pontosParaTexto(trechoFalta)} className="mapa-rota falta" />
        )}
        {trechoFeito.length > 1 && (
          <polyline points={pontosParaTexto(trechoFeito)} className="mapa-rota feita" />
        )}

        {pontos.slice(1).map(([x, y], i) => {
          const parada = i + 1
          const atual = parada === coletados && !concluido
          let classe = parada <= coletados ? 'coletado' : 'proximo'
          if (atual) classe = 'atual'

          return (
            <g key={`${x}-${y}`}>
              {atual && <circle cx={x} cy={y} r={11} className="mapa-pulso" />}
              <circle cx={x} cy={y} r={atual ? 7 : 5} className={`mapa-ponto ${classe}`}>
                <title>
                  Parada {parada} de {totalParadas}
                  {atual ? ' · coletor está aqui' : ''}
                </title>
              </circle>
            </g>
          )
        })}
      </svg>

      <ul className="mapa-legenda">
        <li>
          <span className="mapa-legenda-ponto coletado" /> Coletado
        </li>
        <li>
          <span className="mapa-legenda-ponto proximo" /> Próximo
        </li>
        <li>
          <span className="mapa-legenda-ponto atual" /> Coletor agora
        </li>
      </ul>
    </div>
  )
}

export default MapaArmazem
