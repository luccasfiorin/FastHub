function CartaoMetrica({ titulo, valor, detalhe, positivo = false }) {
  return (
    <article className="col-metrica">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small className={positivo ? 'positivo' : ''}>{detalhe}</small>
    </article>
  )
}

export default CartaoMetrica
