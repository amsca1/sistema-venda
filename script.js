// A variável global 'db' (firebase.database()) é inicializada no script do index.html.

const STORE_PRODUTOS = 'produtos';
const STORE_VENDAS = 'vendas';
const STORE_MESAS = 'mesas'; 

// CONSTANTES DE TAXA
const TAXA_DEBITO = 0.0199;  // 1.99%
const TAXA_CREDITO = 0.0499; // 🛑 4.99% (Corrigido)

let mesasCadastradas = [];
let mesaAtiva = null; 
let vendaAtual = [];  
let subtotalBruto = 0.0; // Inicializado com 0.0

// =========================================================
// 1. FUNÇÕES DO REALTIME DATABASE (CRUD)
// =========================================================

function snapshotToArray(snapshot) {
    const list = [];
    snapshot.forEach((childSnapshot) => {
        list.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
        });
    });
    return list;
}

async function inserirDados(collectionName, data) {
    return db.ref(collectionName).push(data);
}

async function atualizarDados(collectionName, id, data) {
    return db.ref(`${collectionName}/${id}`).set(data);
}

async function consultarTodos(collectionName) {
    // Tratamento de Erro Adicional para garantir que o array é retornado mesmo sem dados
    try {
        const snapshot = await db.ref(collectionName).once('value');
        if (snapshot.exists()) {
            return snapshotToArray(snapshot);
        }
        return [];
    } catch (error) {
        console.error(`Erro ao consultar coleção ${collectionName}:`, error);
        return [];
    }
}

async function deletarDados(collectionName, id) {
    return db.ref(`${collectionName}/${id}`).remove();
}

// =========================================================
// 2. FUNÇÕES DE LÓGICA E RENDERIZAÇÃO
// =========================================================

// --- PRODUTOS ---

async function carregarEAtualizarProdutos() {
    const produtosCadastrados = await consultarTodos(STORE_PRODUTOS);
    renderizarProdutos(produtosCadastrados);
    popularSeletorVendas(produtosCadastrados);
}

function renderizarProdutos(produtos) {
    const listaUl = document.getElementById('lista-produtos');
    listaUl.innerHTML = ''; 
    produtos.forEach(p => {
        listaUl.innerHTML += `
            <li>
                ${p.nome} - R$ ${p.preco.toFixed(2)} 
                <button onclick="removerCadastroProduto('${p.id}')" class="btn-remover">X</button>
            </li>
        `;
    });
}

async function removerCadastroProduto(id) {
    if (!confirm("Tem certeza que deseja remover este produto permanentemente?")) return;
    try {
        await deletarDados(STORE_PRODUTOS, id);
        alert("Produto removido com sucesso!");
        await carregarEAtualizarProdutos();
    } catch (error) {
        console.error("Erro ao remover produto:", error);
    }
}

async function cadastrarNovoProduto() {
    const nome = document.getElementById('nome-item').value.trim();
    const preco = parseFloat(document.getElementById('preco-item').value);
    
    if (!nome || isNaN(preco) || preco <= 0) {
        alert("Preencha o nome e um preço válido.");
        return;
    }

    const novoProduto = { nome, preco }; 
    
    try {
        await inserirDados(STORE_PRODUTOS, novoProduto);
        document.getElementById('nome-item').value = '';
        document.getElementById('preco-item').value = '';
        await carregarEAtualizarProdutos(); 
    } catch (error) {
        console.error("Erro ao cadastrar produto:", error);
    }
}

function popularSeletorVendas(produtos) {
    const select = document.getElementById('select-produto');
    select.innerHTML = '<option value="">-- Selecione um Produto --</option>';
    produtos.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id; 
        option.textContent = p.nome;
        select.appendChild(option);
    });
}


// --- MESAS (COM DESCRIÇÃO) ---

async function carregarEAtualizarMesas() {
    mesasCadastradas = await consultarTodos(STORE_MESAS);
    renderizarMesas();
    popularSeletorMesas(mesasCadastradas);
}

function renderizarMesas() {
    const listaUl = document.getElementById('lista-mesas');
    listaUl.innerHTML = ''; 
    mesasCadastradas.forEach(m => {
        const status = m.pedido && m.pedido.length > 0 ? ' (ABERTA)' : '';
        listaUl.innerHTML += `
            <li>
                ${m.nome} ${status}
                <button onclick="removerCadastroMesa('${m.id}')" class="btn-remover">X</button>
            </li>
        `;
    });
}

function popularSeletorMesas(mesas) {
    const select = document.getElementById('select-mesa-ativa');
    select.innerHTML = '<option value="">-- Selecione a Mesa --</option>';
    mesas.forEach(m => {
        const statusText = m.pedido && m.pedido.length > 0 ? ' (ABERTA)' : '';
        const option = document.createElement('option');
        option.value = m.id; 
        option.textContent = m.nome + statusText;
        select.appendChild(option);
    });
}

async function removerCadastroMesa(id) {
    if (!confirm("Tem certeza que deseja remover esta mesa permanentemente?")) return;
    try {
        await deletarDados(STORE_MESAS, id);
        alert("Mesa removida com sucesso!");
        await carregarEAtualizarMesas();
    } catch (error) {
        console.error("Erro ao remover mesa:", error);
        alert("Erro ao remover a mesa.");
    }
}

async function cadastrarNovaMesa() {
    const nome = document.getElementById('nome-mesa').value.trim();
    if (!nome) {
        alert("Por favor, preencha o nome da mesa.");
        return;
    }
    
    const novaMesa = { nome, pedido: [], descricao: '' }; 
    
    try {
        await inserirDados(STORE_MESAS, novaMesa);
        document.getElementById('nome-mesa').value = '';
        await carregarEAtualizarMesas(); 
        alert(`Mesa "${nome}" cadastrada!`);
    } catch (error) {
        console.error("Erro ao cadastrar mesa:", error);
    }
}

function abrirMesaParaVenda() {
    const mesaId = document.getElementById('select-mesa-ativa').value; 

    if (!mesaId) {
        alert("Selecione uma mesa para iniciar/abrir a venda.");
        return;
    }

    const mesaSelecionada = mesasCadastradas.find(m => m.id === mesaId);

    if (!mesaSelecionada) {
        alert("Mesa não encontrada.");
        return;
    }
    
    mesaAtiva = mesaSelecionada;
    vendaAtual = mesaAtiva.pedido || []; 
    
    const descricaoMesaEl = document.getElementById('descricao-mesa');
    descricaoMesaEl.value = mesaAtiva.descricao || '';
    descricaoMesaEl.disabled = false;
    
    document.getElementById('mesa-ativa-status').textContent = `Mesa Ativa: ${mesaAtiva.nome} (ID: ${mesaAtiva.id.substring(mesaAtiva.id.length - 4)})`;
    document.getElementById('select-forma-pagamento').disabled = false;
    
    renderizarVendaAtual();
    calcularTotalPagamento(); 
}

async function salvarDescricaoMesa() {
    if (!mesaAtiva) return;
    
    const novaDescricao = document.getElementById('descricao-mesa').value;
    
    mesaAtiva.descricao = novaDescricao;
    
    try {
        await atualizarDados(STORE_MESAS, mesaAtiva.id, { ...mesaAtiva, descricao: novaDescricao });
    } catch (error) {
        console.error("Erro ao salvar descrição da mesa:", error);
    }
}

// --- VENDAS (AGRUPAMENTO) ---

async function adicionarItemVenda() {
    if (!mesaAtiva) {
        alert("Por favor, selecione e abra uma mesa primeiro!");
        return;
    }

    const produtoId = document.getElementById('select-produto').value;
    const quantidade = parseInt(document.getElementById('quantidade').value) || 1;

    if (!produtoId || isNaN(quantidade) || quantidade <= 0) {
        alert("Selecione um produto e uma quantidade válida.");
        return;
    }

    const produtosCadastrados = await consultarTodos(STORE_PRODUTOS);
    const produtoBase = produtosCadastrados.find(p => p.id === produtoId);
    
    if (!produtoBase) {
        alert("Produto não encontrado.");
        return;
    }

    const itemExistenteIndex = vendaAtual.findIndex(item => item.id === produtoId);

    if (itemExistenteIndex > -1) {
        const itemExistente = vendaAtual[itemExistenteIndex];
        itemExistente.quantidade += quantidade;
        itemExistente.totalItem = itemExistente.preco * itemExistente.quantidade;
    } else {
        const totalItem = produtoBase.preco * quantidade; 
        vendaAtual.push({
            ...produtoBase, 
            quantidade,
            totalItem
        });
    }
    
    await salvarEstadoDaMesa(); 
    renderizarVendaAtual();
}

async function removerItemVenda(index) {
    if (index > -1) { 
        vendaAtual.splice(index, 1); 
        await salvarEstadoDaMesa(); 
        renderizarVendaAtual(); 
    }
}

async function salvarEstadoDaMesa() {
    if (!mesaAtiva) return;
    
    const descricaoMesa = document.getElementById('descricao-mesa').value;
    const mesaParaAtualizar = { ...mesaAtiva, pedido: vendaAtual, descricao: descricaoMesa };
    
    try {
        await atualizarDados(STORE_MESAS, mesaAtiva.id, mesaParaAtualizar);
        await carregarEAtualizarMesas(); 
    } catch (error) {
        console.error("Erro ao salvar o estado da mesa:", error);
    }
}

function calcularTotalPagamento() {
    // 1. Calcular Subtotal Bruto
    // Garante que o subtotal é 0.00 se a lista estiver vazia (para evitar NaN)
    subtotalBruto = vendaAtual.reduce((total, item) => total + item.totalItem, 0) || 0; 
    
    // 2. Definir Taxa
    const formaPagamento = document.getElementById('select-forma-pagamento').value;
    let taxaPercentual = 0;
    
    if (formaPagamento === 'debito') {
        taxaPercentual = TAXA_DEBITO;
    } else if (formaPagamento === 'credito') {
        taxaPercentual = TAXA_CREDITO;
    } 
    
    // 3. Calcular Valores
    const valorTaxa = subtotalBruto * taxaPercentual;
    const totalFinal = subtotalBruto + valorTaxa;

    // 4. Renderizar
    document.getElementById('subtotal-bruto').textContent = `R$ ${subtotalBruto.toFixed(2)}`;
    document.getElementById('taxa-aplicada').textContent = `${(taxaPercentual * 100).toFixed(2)}%`;
    document.getElementById('valor-taxa').textContent = `R$ ${valorTaxa.toFixed(2)}`;
    document.getElementById('total-final').textContent = `R$ ${totalFinal.toFixed(2)}`;
    
    return { subtotalBruto, formaPagamento, taxaPercentual, valorTaxa, totalFinal };
}

function renderizarVendaAtual() {
    const tbody = document.getElementById('tabela-venda').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    
    vendaAtual.forEach((item, i) => { 
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${item.nome}</td>
            <td>${item.quantidade}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>R$ ${item.totalItem.toFixed(2)}</td>
            <td><button onclick="removerItemVenda(${i})" class="btn-remover">Remover</button></td> 
        `;
    });

    calcularTotalPagamento();
}

async function finalizarVenda() {
    if (!mesaAtiva) {
        alert("Nenhuma mesa está ativa para ser finalizada.");
        return;
    }
    if (vendaAtual.length === 0) {
        alert("A venda desta mesa não tem itens para finalizar.");
        return;
    }

    const { subtotalBruto, formaPagamento, taxaPercentual, valorTaxa, totalFinal } = calcularTotalPagamento();
    
    const novaVenda = {
        data: new Date().toLocaleString('pt-BR'),
        mesa: mesaAtiva.nome,
        descricao: mesaAtiva.descricao || '', 
        itens: vendaAtual,
        subtotalBruto: subtotalBruto,
        formaPagamento: formaPagamento,
        taxaAplicada: taxaPercentual,
        valorTaxa: valorTaxa,
        totalFinal: totalFinal,
    };

    try {
        await inserirDados(STORE_VENDAS, novaVenda);
        
        const mesaFechada = { ...mesaAtiva, pedido: [], descricao: '' };
        await atualizarDados(STORE_MESAS, mesaAtiva.id, mesaFechada);
        
        vendaAtual = [];
        mesaAtiva = null;
        document.getElementById('mesa-ativa-status').textContent = `Nenhuma mesa ativa.`;
        document.getElementById('descricao-mesa').value = '';
        document.getElementById('descricao-mesa').disabled = true;
        document.getElementById('select-forma-pagamento').disabled = true;
        
        renderizarVendaAtual(); 
        await carregarEAtualizarHistorico();
        await carregarEAtualizarMesas(); 
        
        alert(`Venda da Mesa ${novaVenda.mesa} finalizada! Total: R$ ${totalFinal.toFixed(2)} (${formaPagamento.toUpperCase()})`);

    } catch (error) {
        console.error("Erro ao finalizar venda:", error);
    }
}

// --- HISTÓRICO ---

async function carregarEAtualizarHistorico() {
    const historicoVendas = await consultarTodos(STORE_VENDAS);
    const listaUl = document.getElementById('lista-historico');
    listaUl.innerHTML = '';

    historicoVendas.sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(venda => { 
        const idCurto = venda.id.substring(venda.id.length - 4);
        const descricaoTexto = venda.descricao ? ` | Descrição: ${venda.descricao.substring(0, 50)}...` : '';
        const taxaDetalhe = venda.valorTaxa > 0 ? ` + Taxa (${(venda.taxaAplicada * 100).toFixed(2)}%): R$ ${venda.valorTaxa.toFixed(2)}` : '';
        
        listaUl.innerHTML += `
            <li>
                [ID ${idCurto}] - ${venda.data} - Mesa: ${venda.mesa}
                <br>Subtotal Bruto: R$ ${venda.subtotalBruto.toFixed(2)}${taxaDetalhe}
                <br>Forma de Pagamento: ${venda.formaPagamento.toUpperCase()} | Total Final: R$ ${venda.totalFinal.toFixed(2)}
                ${descricaoTexto}
            </li>
        `;
    });
}

// =========================================================
// 3. INICIALIZAÇÃO DA APLICAÇÃO
// =========================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await carregarEAtualizarProdutos(); 
        await carregarEAtualizarMesas(); 
        await carregarEAtualizarHistorico(); 
        console.log("Conexão e carregamento de dados do Firebase realizados com sucesso.");
    } catch (error) {
        // MANTÉM O LOG, mas REMOVE O ALERT pop-up.
        console.warn("Aviso: O carregamento inicial pode ter falhado por falta de dados no Firebase. Prossiga cadastrando um produto.");
        console.error("Detalhes do erro:", error);
    }
    
    document.getElementById('select-forma-pagamento').addEventListener('change', calcularTotalPagamento);
    document.getElementById('descricao-mesa').addEventListener('change', salvarDescricaoMesa);

    document.getElementById('descricao-mesa').disabled = true;
    document.getElementById('select-forma-pagamento').disabled = true;
    
    document.getElementById('btn-cadastrar').addEventListener('click', cadastrarNovoProduto);
    document.getElementById('btn-cadastrar-mesa').addEventListener('click', cadastrarNovaMesa); 
    document.getElementById('btn-nova-mesa').addEventListener('click', abrirMesaParaVenda);   
    document.getElementById('btn-adicionar').addEventListener('click', adicionarItemVenda);
    document.getElementById('btn-finalizar').addEventListener('click', finalizarVenda);
    
    // Garante que o total é R$ 0.00 ao invés de NaN na inicialização.
    calcularTotalPagamento();
});