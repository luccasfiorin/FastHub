import CartaoColetor from './CartaoColetor'

function GradeColetores({ coletores, onEditar, onExcluir }) {
  return (
    <div className="col-grade">
      {coletores.map((coletor) => (
        <CartaoColetor key={coletor.id} coletor={coletor} onEditar={onEditar} onExcluir={onExcluir} />
      ))}
    </div>
  )
}

export default GradeColetores
