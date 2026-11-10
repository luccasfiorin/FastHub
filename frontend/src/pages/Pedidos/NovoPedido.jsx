import { useEffect, useMemo, useState } from 'react'
import Icone from '../../components/Icone'
import {
  criarCorredor,
  criarPedido,
  criarPosicao,
  criarProduto,
  listarColetores,
  listarCorredores,
  listarPosicoes,
  listarProdutos,
} from '../../services/api'

// Formulário de novo pedido. Como ainda não há integração com o ERP, produtos, posições
// e corredores que não existem podem ser cadastrados aqui mesmo, item por item.
// Ao salvar: cria o que for novo (corredor → posição → produto) e depois o pedido.

const NOVO = 'novo'

let proximaChave = 1

function linhaVazia() {
  return {
    chave: proximaChave++,
    produtoId: '',
    produto: { name: '', sku: '', barcode_primary: '', requires_forklift: false },
    posicaoId: '',
    posicao: { aisle_id: '', aisle_code: '', shelf: '', position: '', coord_x: '', coord_y: '' },
    quantidade: '1',
  }
}

// "A" + prateleira "1" + posição "3" vira "A-1-3"
function codigoPosicao(location, corredores) {
  const corredor = location.aisle?.code ?? corredores.find((c) => c.id === location.aisle_id)?.code
  return [corredor, location.shelf, location.position].filter(Boolean).join('-')
}

// Algumas validações do backend (produto e pedido) ainda respondem em inglês.
// Aqui elas viram uma frase em português; as que já vêm em português passam direto.
function traduzir(campo, mensagem) {
  if (!mensagem) return ''
  if (/taken/i.test(mensagem)) {
    if (campo === 'sku') return 'Já existe um produto com esse SKU.'
    if (campo === 'barcode_primary') return 'Já existe um produto com esse código de barras.'
    return 'Esse valor já está em uso.'
  }
  if (/required/i.test(mensagem)) return 'Campo obrigatório.'
  if (/must be at least/i.test(mensagem)) return 'Informe um valor maior que zero.'
  if (/must be an integer/i.test(mensagem)) return 'Informe um número inteiro.'
  if (/must be a number|numeric/i.test(mensagem)) return 'Informe um número.'
  if (/invalid/i.test(mensagem)) return 'Valor inválido. Escolha de novo na lista.'
  if (/may not be greater|must not be greater/i.test(mensagem)) return 'Texto muito longo.'
  return mensagem
}

// Primeiro erro de cada campo da resposta da API, já traduzido.
function errosDaApi(erros, prefixo = '') {
  const resultado = {}
  for (const [campo, mensagens] of Object.entries(erros ?? {})) {
    resultado[prefixo + campo] = traduzir(campo.split('.').pop(), mensagens[0])
  }
  return resultado
}

const ehNumero = (valor) => String(valor).trim() !== '' && !Number.isNaN(Number(valor))

// Validação feita antes de enviar, para não criar nada pela metade quando falta campo.
function validar(linhas) {
  const erros = {}

  linhas.forEach((linha, i) => {
    const p = `itens.${i}.`

    if (!linha.produtoId) erros[p + 'produto'] = 'Escolha um produto.'
    if (linha.produtoId === NOVO) {
      if (!linha.produto.name.trim()) erros[p + 'produto.name'] = 'Informe o nome do produto.'
      if (!linha.produto.sku.trim()) erros[p + 'produto.sku'] = 'Informe o SKU.'
      if (!linha.produto.barcode_primary.trim()) erros[p + 'produto.barcode_primary'] = 'Informe o código de barras.'
    }

    if (!linha.posicaoId) erros[p + 'posicao'] = 'Escolha a posição do produto.'
    if (linha.posicaoId === NOVO) {
      const pos = linha.posicao
      if (!pos.aisle_id) erros[p + 'posicao.aisle_id'] = 'Escolha o corredor.'
      if (pos.aisle_id === NOVO && !pos.aisle_code.trim()) erros[p + 'posicao.aisle_code'] = 'Informe o código do corredor.'
      if (!pos.shelf.trim()) erros[p + 'posicao.shelf'] = 'Informe a prateleira.'
      if (!pos.position.trim()) erros[p + 'posicao.position'] = 'Informe a posição.'
      if (!ehNumero(pos.coord_x)) erros[p + 'posicao.coord_x'] = 'Informe a coordenada X em metros.'
      if (!ehNumero(pos.coord_y)) erros[p + 'posicao.coord_y'] = 'Informe a coordenada Y em metros.'
    }

    const quantidade = Number(linha.quantidade)
    if (!Number.isInteger(quantidade) || quantidade < 1) erros[p + 'quantidade'] = 'Informe uma quantidade de 1 ou mais.'
  })

  return erros
}

function NovoPedido({ onCriado, onFechar }) {
  const [produtos, setProdutos] = useState([])
  const [posicoes, setPosicoes] = useState([])
  const [corredores, setCorredores] = useState([])
  const [coletores, setColetores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')

  const [linhas, setLinhas] = useState(() => [linhaVazia()])
  const [coletorId, setColetorId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [erros, setErros] = useState({})

  useEffect(() => {
    let ativo = true

    Promise.all([listarProdutos(), listarPosicoes(), listarCorredores()])
      .then(([listaProdutos, listaPosicoes, listaCorredores]) => {
        if (!ativo) return
        setProdutos(listaProdutos)
        setPosicoes(listaPosicoes)
        setCorredores(listaCorredores)
      })
      .catch((e) => ativo && setErroCarga(e.message))
      .finally(() => ativo && setCarregando(false))

    // sem a lista de coletores o pedido ainda pode ser criado, só sem coletor
    listarColetores()
      .then((resposta) => ativo && setColetores(resposta.pickers ?? []))
      .catch(() => ativo && setColetores([]))

    return () => {
      ativo = false
    }
  }, [])

  // fecha com Esc, como o modal de coletores
  useEffect(() => {
    function aoTeclar(e) {
      if (e.key === 'Escape' && !salvando) onFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [onFechar, salvando])

  // posições agrupadas por corredor para o <select>
  const gruposPosicoes = useMemo(() => {
    const grupos = new Map()
    for (const posicao of posicoes) {
      const corredor = posicao.aisle?.code ?? corredores.find((c) => c.id === posicao.aisle_id)?.code ?? 'Sem corredor'
      if (!grupos.has(corredor)) grupos.set(corredor, [])
      grupos.get(corredor).push(posicao)
    }
    return [...grupos]
  }, [posicoes, corredores])

  const produtoDaLinha = (linha) =>
    linha.produtoId === NOVO ? linha.produto : produtos.find((p) => p.id === Number(linha.produtoId))

  // RN04: o pedido precisa de empilhadeira se algum produto precisar
  const precisaEmpilhadeira = linhas.some((linha) => produtoDaLinha(linha)?.requires_forklift)

  function mudarLinha(chave, mudanca) {
    setLinhas((atuais) => atuais.map((linha) => (linha.chave === chave ? { ...linha, ...mudanca(linha) } : linha)))
  }

  function escolherProduto(linha, valor) {
    mudarLinha(linha.chave, () => {
      const mudanca = { produtoId: valor }
      // produto já guardado numa posição: preenche a posição sozinho (dá para trocar depois)
      const produto = produtos.find((p) => p.id === Number(valor))
      if (produto?.location_id) mudanca.posicaoId = String(produto.location_id)
      return mudanca
    })
  }

  const mudarProduto = (linha, campo, valor) =>
    mudarLinha(linha.chave, (l) => ({ produto: { ...l.produto, [campo]: valor } }))

  const mudarPosicao = (linha, campo, valor) =>
    mudarLinha(linha.chave, (l) => ({ posicao: { ...l.posicao, [campo]: valor } }))

  function removerLinha(chave) {
    setLinhas((atuais) => atuais.filter((linha) => linha.chave !== chave))
    setErros({})
  }

  async function enviar(e) {
    e.preventDefault()
    setErro('')

    const errosLocais = validar(linhas)
    if (Object.keys(errosLocais).length) {
      setErros(errosLocais)
      setErro('Confira os campos destacados.')
      return
    }

    setErros({})
    setSalvando(true)

    // Trabalha numa cópia: o que for sendo criado vira "existente" na linha, assim,
    // se algo falhar no meio, tentar de novo não cadastra o mesmo item duas vezes.
    const atuais = linhas.map((linha) => ({ ...linha }))
    let etapa = ''
    let indice = 0

    try {
      for (indice = 0; indice < atuais.length; indice++) {
        const linha = atuais[indice]

        if (linha.posicaoId === NOVO) {
          if (linha.posicao.aisle_id === NOVO) {
            const codigo = linha.posicao.aisle_code.trim().toUpperCase()
            etapa = 'corredor'
            const corredor = await criarCorredor({ code: codigo, name: `Corredor ${codigo}` })
            setCorredores((lista) => [...lista, corredor])
            // todas as linhas que pediram esse mesmo corredor novo passam a usar o que acabou de ser criado
            for (const outra of atuais) {
              if (outra.posicao.aisle_id === NOVO && outra.posicao.aisle_code.trim().toUpperCase() === codigo) {
                outra.posicao = { ...outra.posicao, aisle_id: String(corredor.id) }
              }
            }
          }

          etapa = 'posicao'
          const posicao = await criarPosicao({
            aisle_id: Number(linha.posicao.aisle_id),
            shelf: linha.posicao.shelf.trim(),
            position: linha.posicao.position.trim(),
            coord_x: Number(linha.posicao.coord_x),
            coord_y: Number(linha.posicao.coord_y),
          })
          setPosicoes((lista) => [...lista, posicao])
          linha.posicaoId = String(posicao.id)
        }

        if (linha.produtoId === NOVO) {
          etapa = 'produto'
          const produto = await criarProduto({
            name: linha.produto.name.trim(),
            sku: linha.produto.sku.trim(),
            barcode_primary: linha.produto.barcode_primary.trim(),
            requires_forklift: linha.produto.requires_forklift,
            // o produto novo fica guardado na posição escolhida para ele
            location_id: Number(linha.posicaoId),
          })
          setProdutos((lista) => [...lista, produto])
          linha.produtoId = String(produto.id)
        }
      }

      etapa = 'pedido'
      const pedido = await criarPedido({
        picker_id: coletorId ? Number(coletorId) : null,
        requires_forklift: precisaEmpilhadeira,
        items: atuais.map((linha) => ({
          product_id: Number(linha.produtoId),
          location_id: Number(linha.posicaoId),
          quantity: Number(linha.quantidade),
        })),
      })

      onCriado(pedido)
    } catch (err) {
      setLinhas(atuais)
      setSalvando(false)

      const p = `itens.${indice}.`
      let errosCampos = {}
      if (etapa === 'corredor') {
        // o único campo do corredor no formulário é o código
        const mensagem = err.erros?.code?.[0]
        if (mensagem) errosCampos[p + 'posicao.aisle_code'] = mensagem
      } else if (etapa === 'posicao') {
        errosCampos = errosDaApi(err.erros, p + 'posicao.')
      } else if (etapa === 'produto') {
        errosCampos = errosDaApi(err.erros, p + 'produto.')
      } else {
        // erros do pedido: items.0.product_id → itens.0.produto, etc.
        for (const [campo, mensagens] of Object.entries(err.erros ?? {})) {
          const mensagem = traduzir(campo.split('.').pop(), mensagens[0])
          const item = campo.match(/^items\.(\d+)\.(\w+)$/)
          if (item) {
            const nome = { product_id: 'produto', location_id: 'posicao', quantity: 'quantidade' }[item[2]] ?? item[2]
            errosCampos[`itens.${item[1]}.${nome}`] = mensagem
          } else if (campo === 'picker_id') {
            errosCampos.coletor = mensagem
          }
        }
      }

      setErros(errosCampos)
      if (Object.keys(errosCampos).length) {
        setErro('Confira os campos destacados.')
      } else if (err.status >= 500) {
        // o Laravel responde "Server Error" em inglês; o que foi criado antes da falha já ficou salvo
        setErro('O servidor não conseguiu salvar agora. Tente de novo em instantes.')
      } else {
        setErro(err.message || 'Não foi possível criar o pedido. Tente de novo.')
      }
    }
  }

  const campoErro = (chave) => erros[chave] && <small className="col-erro-campo">{erros[chave]}</small>
  const invalido = (chave) => (erros[chave] ? 'true' : undefined)

  return (
    <div
      className="col-fundo"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && !salvando && onFechar()}
    >
      <form
        className="col-modal ped-novo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ped-novo-titulo"
        onSubmit={enviar}
        noValidate
      >
        <div className="col-modal-topo">
          <h2 id="ped-novo-titulo">Novo pedido</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} disabled={salvando}>
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>

        {carregando && <p className="col-aviso">Carregando produtos e posições...</p>}
        {erroCarga && <p className="col-aviso erro">{erroCarga}</p>}

        {!carregando && !erroCarga && (
          <>
            <ol className="ped-novo-itens">
              {linhas.map((linha, i) => {
                const p = `itens.${i}.`
                const pos = linha.posicao

                return (
                  <li key={linha.chave} className="ped-novo-item">
                    <div className="ped-novo-item-topo">
                      <strong>Item {i + 1}</strong>
                      {linhas.length > 1 && (
                        <button type="button" onClick={() => removerLinha(linha.chave)} disabled={salvando}>
                          Remover
                        </button>
                      )}
                    </div>

                    <div className="col-modal-linha">
                      <label className="ped-novo-largo">
                        Produto
                        <select
                          value={linha.produtoId}
                          onChange={(e) => escolherProduto(linha, e.target.value)}
                          aria-invalid={invalido(p + 'produto')}
                        >
                          <option value="">Escolha um produto</option>
                          {produtos.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                              {produto.name} · {produto.sku}
                              {produto.requires_forklift ? ' · empilhadeira' : ''}
                            </option>
                          ))}
                          <option value={NOVO}>+ Cadastrar novo produto</option>
                        </select>
                        {campoErro(p + 'produto')}
                      </label>

                      <label className="ped-novo-qtd">
                        Quantidade
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={linha.quantidade}
                          onChange={(e) => mudarLinha(linha.chave, () => ({ quantidade: e.target.value }))}
                          aria-invalid={invalido(p + 'quantidade')}
                        />
                        {campoErro(p + 'quantidade')}
                      </label>
                    </div>

                    {linha.produtoId === NOVO && (
                      <fieldset className="ped-novo-cadastro">
                        <legend>Novo produto</legend>
                        <label>
                          Nome
                          <input
                            value={linha.produto.name}
                            onChange={(e) => mudarProduto(linha, 'name', e.target.value)}
                            placeholder="Ex.: Caixa de parafusos"
                            aria-invalid={invalido(p + 'produto.name')}
                          />
                          {campoErro(p + 'produto.name')}
                        </label>
                        <div className="col-modal-linha">
                          <label>
                            SKU
                            <input
                              value={linha.produto.sku}
                              onChange={(e) => mudarProduto(linha, 'sku', e.target.value)}
                              placeholder="Ex.: PAR-001"
                              aria-invalid={invalido(p + 'produto.sku')}
                            />
                            {campoErro(p + 'produto.sku')}
                          </label>
                          <label>
                            Código de barras
                            <input
                              value={linha.produto.barcode_primary}
                              onChange={(e) => mudarProduto(linha, 'barcode_primary', e.target.value)}
                              inputMode="numeric"
                              placeholder="Ex.: 7891234567890"
                              aria-invalid={invalido(p + 'produto.barcode_primary')}
                            />
                            {campoErro(p + 'produto.barcode_primary')}
                          </label>
                        </div>
                        <label className="ped-novo-check">
                          <input
                            type="checkbox"
                            checked={linha.produto.requires_forklift}
                            onChange={(e) => mudarProduto(linha, 'requires_forklift', e.target.checked)}
                          />
                          Item grande, precisa de empilhadeira
                        </label>
                      </fieldset>
                    )}

                    <label>
                      Posição no armazém
                      <select
                        value={linha.posicaoId}
                        onChange={(e) => mudarLinha(linha.chave, () => ({ posicaoId: e.target.value }))}
                        aria-invalid={invalido(p + 'posicao')}
                      >
                        <option value="">Escolha uma posição</option>
                        {gruposPosicoes.map(([corredor, lista]) => (
                          <optgroup key={corredor} label={`Corredor ${corredor}`}>
                            {lista.map((posicao) => (
                              <option key={posicao.id} value={posicao.id}>
                                {codigoPosicao(posicao, corredores)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                        <option value={NOVO}>+ Cadastrar nova posição</option>
                      </select>
                      {campoErro(p + 'posicao')}
                    </label>

                    {linha.posicaoId === NOVO && (
                      <fieldset className="ped-novo-cadastro">
                        <legend>Nova posição</legend>
                        <div className="col-modal-linha">
                          <label>
                            Corredor
                            <select
                              value={pos.aisle_id}
                              onChange={(e) => mudarPosicao(linha, 'aisle_id', e.target.value)}
                              aria-invalid={invalido(p + 'posicao.aisle_id')}
                            >
                              <option value="">Escolha</option>
                              {corredores.map((corredor) => (
                                <option key={corredor.id} value={corredor.id}>
                                  {corredor.code}
                                  {corredor.name ? ` · ${corredor.name}` : ''}
                                </option>
                              ))}
                              <option value={NOVO}>+ Novo corredor</option>
                            </select>
                            {campoErro(p + 'posicao.aisle_id')}
                          </label>
                          {pos.aisle_id === NOVO && (
                            <label>
                              Código do corredor
                              <input
                                value={pos.aisle_code}
                                onChange={(e) => mudarPosicao(linha, 'aisle_code', e.target.value)}
                                placeholder="Ex.: B"
                                maxLength={20}
                                aria-invalid={invalido(p + 'posicao.aisle_code')}
                              />
                              {campoErro(p + 'posicao.aisle_code')}
                            </label>
                          )}
                        </div>
                        <div className="col-modal-linha">
                          <label>
                            Prateleira
                            <input
                              value={pos.shelf}
                              onChange={(e) => mudarPosicao(linha, 'shelf', e.target.value)}
                              placeholder="Ex.: 1"
                              maxLength={20}
                              aria-invalid={invalido(p + 'posicao.shelf')}
                            />
                            {campoErro(p + 'posicao.shelf')}
                          </label>
                          <label>
                            Posição
                            <input
                              value={pos.position}
                              onChange={(e) => mudarPosicao(linha, 'position', e.target.value)}
                              placeholder="Ex.: 3"
                              maxLength={20}
                              aria-invalid={invalido(p + 'posicao.position')}
                            />
                            {campoErro(p + 'posicao.position')}
                          </label>
                        </div>
                        <div className="col-modal-linha">
                          <label>
                            Coordenada X (m)
                            <input
                              type="number"
                              step="0.1"
                              value={pos.coord_x}
                              onChange={(e) => mudarPosicao(linha, 'coord_x', e.target.value)}
                              placeholder="Ex.: 6"
                              aria-invalid={invalido(p + 'posicao.coord_x')}
                            />
                            {campoErro(p + 'posicao.coord_x')}
                          </label>
                          <label>
                            Coordenada Y (m)
                            <input
                              type="number"
                              step="0.1"
                              value={pos.coord_y}
                              onChange={(e) => mudarPosicao(linha, 'coord_y', e.target.value)}
                              placeholder="Ex.: 15"
                              aria-invalid={invalido(p + 'posicao.coord_y')}
                            />
                            {campoErro(p + 'posicao.coord_y')}
                          </label>
                        </div>
                        <p className="ped-novo-dica">Distância em metros a partir da expedição, que fica no ponto (0, 0).</p>
                      </fieldset>
                    )}
                  </li>
                )
              })}
            </ol>

            <button
              type="button"
              className="ped-novo-adicionar"
              onClick={() => setLinhas((atuais) => [...atuais, linhaVazia()])}
              disabled={salvando}
            >
              + Adicionar item
            </button>

            <label>
              Coletor (opcional)
              <select value={coletorId} onChange={(e) => setColetorId(e.target.value)} aria-invalid={invalido('coletor')}>
                <option value="">Sem coletor por enquanto</option>
                {coletores.map((coletor) => (
                  <option key={coletor.id} value={coletor.id}>
                    {coletor.name}
                    {coletor.picker_type === 'forklift' ? ' · empilhadeira' : ''}
                  </option>
                ))}
              </select>
              {campoErro('coletor')}
            </label>

            {precisaEmpilhadeira && (
              <p className="ped-novo-aviso">
                <Icone nome="empilhadeira" tamanho={15} /> Este pedido tem item grande e vai precisar de empilhadeira.
              </p>
            )}
          </>
        )}

        {erro && (
          <p className="col-aviso erro" role="alert">
            {erro}
          </p>
        )}

        <div className="col-modal-rodape">
          <button type="button" className="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" disabled={salvando || carregando || Boolean(erroCarga)}>
            {salvando ? 'Criando pedido...' : 'Criar pedido'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default NovoPedido
