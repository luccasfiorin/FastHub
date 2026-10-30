import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import Header from '../../components/Header'
import CartaoMetrica from '../../components/CartaoMetrica'
import GradeColetores from '../../components/GradeColetores'
import TabelaRanking from '../../components/TabelaRanking'
import ModalColetor from '../../components/ModalColetor'
import { useColetores, useRanking } from '../../hooks/useColetores'
import { criarColetor, editarColetor, excluirColetor } from '../../services/api'
import { formatarInteiro, formatarKm, formatarPercentual, semDado, turnoAtual } from '../../utils/formatar'
import './Coletores.css'

const filtros = [
  { id: 'all', nome: 'Todos' },
  { id: 'active', nome: 'Ativos' },
  { id: 'paused', nome: 'Em pausa' },
  { id: 'offline', nome: 'Offline' },
]

function Coletores({ usuario, onNavegar, onSair }) {
  const { dados, carregando, erro, recarregar } = useColetores()
  const [periodo, setPeriodo] = useState('today')
  const ranking = useRanking(periodo, dados)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('all')
  const [modal, setModal] = useState(null) // null | { coletor: obj | null }
  const [aviso, setAviso] = useState('')

  const coletores = dados?.pickers ?? []
  const termo = busca.trim().toLowerCase()
  const visiveis = coletores.filter(
    (c) =>
      (filtro === 'all' || c.status === filtro) &&
      (!termo ||
        c.name.toLowerCase().includes(termo) ||
        c.current_order?.number.toLowerCase().includes(termo)),
  )

  const resumo = dados?.summary
  const delta = resumo?.items_per_hour_delta
  const ocioso = resumo?.idle_percent

  async function salvar(corpo) {
    if (modal.coletor) await editarColetor(modal.coletor.id, corpo)
    else await criarColetor(corpo)
    setModal(null)
    recarregar()
  }

  async function excluir(coletor) {
    if (!window.confirm(`Excluir o coletor ${coletor.name}? Essa ação não pode ser desfeita.`)) return
    try {
      await excluirColetor(coletor.id)
      setAviso('')
      recarregar()
    } catch (e) {
      setAviso(e.message)
    }
  }

  return (
    <div className="dashboard">
      <Sidebar ativo="coletores" pedidosAbertos={dados?.open_orders} onNavegar={onNavegar} onSair={onSair} />

      <div className="dash-principal">
        <Header
          titulo="Coletores"
          subtitulo={`${coletores.length} cadastrados · ${turnoAtual()}`}
          usuario={usuario}
          busca={busca}
          onBusca={setBusca}
          alertas={dados?.alerts}
        />

        <main className="dash-conteudo">
          {erro && (
            <div className="col-aviso erro" role="alert">
              {erro}
              <button type="button" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          )}
          {aviso && (
            <div className="col-aviso erro" role="alert">
              {aviso}
            </div>
          )}
          {coletores.some((c) => c.is_demo) && (
            <div className="col-aviso demo">
              Há coletores de demonstração (e-mail @demo.fasthub) misturados à lista. Eles não são dados reais.
            </div>
          )}

          <div className="col-barra-topo">
            <div className="col-filtros" role="tablist">
              {filtros.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === item.id}
                  className={filtro === item.id ? 'ativo' : ''}
                  onClick={() => setFiltro(item.id)}
                >
                  {item.nome} <span>{dados?.counts[item.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <button type="button" className="col-adicionar" onClick={() => setModal({ coletor: null })}>
              + Adicionar coletor
            </button>
          </div>

          <section className="col-metricas">
            <CartaoMetrica
              titulo="Itens por hora (média)"
              valor={formatarInteiro(resumo?.items_per_hour)}
              detalhe={
                delta == null ? 'sem comparação com ontem' : `${delta > 0 ? '+' : ''}${formatarInteiro(delta)} vs ontem`
              }
              positivo={delta > 0}
            />
            <CartaoMetrica
              titulo="Acurácia do turno"
              valor={formatarPercentual(resumo?.accuracy)}
              detalhe={resumo ? `${resumo.mismatches} divergências` : semDado}
            />
            <CartaoMetrica
              titulo="Tempo ocioso"
              valor={formatarPercentual(ocioso, 0)}
              detalhe={`meta: abaixo de ${resumo?.idle_target_percent ?? 10}%`}
              positivo={ocioso != null && ocioso < resumo.idle_target_percent}
            />
            <CartaoMetrica
              titulo="Distância percorrida"
              valor={resumo?.distance_km ? formatarKm(resumo.distance_km) : semDado}
              detalhe="todos os coletores"
            />
          </section>

          {carregando && <p className="col-aviso">Carregando coletores...</p>}

          {!carregando && !erro && coletores.length === 0 && (
            <div className="col-vazio">
              <strong>Nenhum coletor cadastrado</strong>
              <p>Cadastre o primeiro coletor para acompanhar pedidos e desempenho.</p>
              <button type="button" className="col-adicionar" onClick={() => setModal({ coletor: null })}>
                + Adicionar coletor
              </button>
            </div>
          )}

          {coletores.length > 0 && visiveis.length === 0 && (
            <p className="col-aviso">Nenhum coletor encontrado para esse filtro ou busca.</p>
          )}

          <GradeColetores
            coletores={visiveis}
            onEditar={(coletor) => setModal({ coletor })}
            onExcluir={excluir}
          />

          <TabelaRanking linhas={ranking.linhas} erro={ranking.erro} periodo={periodo} onPeriodo={setPeriodo} />
        </main>
      </div>

      {modal && (
        <ModalColetor coletor={modal.coletor} onSalvar={salvar} onFechar={() => setModal(null)} />
      )}
    </div>
  )
}

export default Coletores
