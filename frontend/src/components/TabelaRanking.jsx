import { formatarInteiro, formatarPercentual, semDado } from '../utils/formatar'

const periodos = [
  { id: 'today', nome: 'Hoje' },
  { id: 'week', nome: 'Esta semana' },
  { id: 'month', nome: 'Este mês' },
]

function TabelaRanking({ linhas, erro, periodo, onPeriodo }) {
  const maximo = Math.max(0, ...(linhas ?? []).map((l) => l.items_per_hour ?? 0))

  return (
    <section className="col-ranking">
      <div className="col-ranking-topo">
        <h3>Ranking do turno</h3>
        <label className="col-periodo">
          Período:
          <select value={periodo} onChange={(e) => onPeriodo(e.target.value)}>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erro && <p className="col-aviso erro">{erro}</p>}

      <div className="col-tabela-area">
        <table className="col-tabela">
          <thead>
            <tr>
              <th>#</th>
              <th>Coletor</th>
              <th>Pedidos</th>
              <th>Itens</th>
              <th>Itens/h</th>
              <th>Acurácia</th>
              <th>Divergências</th>
              <th>Desempenho</th>
            </tr>
          </thead>
          <tbody>
            {(linhas ?? []).map((linha, i) => (
              <tr key={linha.id}>
                <td className="col-pos">{i + 1}</td>
                <td>{linha.name}</td>
                <td>{linha.orders}</td>
                <td>{linha.items}</td>
                <td>
                  <strong>{linha.items_per_hour == null ? semDado : formatarInteiro(linha.items_per_hour)}</strong>
                </td>
                <td>{formatarPercentual(linha.accuracy)}</td>
                <td className={linha.mismatches > 0 ? 'perigo' : ''}>{linha.mismatches}</td>
                <td>
                  <div className="col-barra">
                    <span
                      className={i === 0 ? 'atencao' : 'base'}
                      style={{ width: maximo ? `${((linha.items_per_hour ?? 0) / maximo) * 100}%` : 0 }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {linhas?.length === 0 && !erro && (
          <p className="col-aviso">Nenhuma atividade registrada neste período.</p>
        )}
        {linhas === null && !erro && <p className="col-aviso">Carregando ranking...</p>}
      </div>
    </section>
  )
}

export default TabelaRanking
