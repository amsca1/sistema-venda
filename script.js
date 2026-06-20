// A variável global 'db' (firebase.database()) é inicializada no script do index.html.
const STORE_PRODUTOS = 'produtos';
const STORE_VENDAS = 'vendas';
const STORE_MESAS = 'mesas';

// CONSTANTES DE TAXA
const TAXA_DEBITO = 0.0199;  // 1.99%
const TAXA_CREDITO = 0.0499; // 4.99%

let mesasCadastradas = [];
let mesaAtiva = null;
let vendaAtual = [];
let subtotalBruto = 0.0;

// SISTEMA DE NOTIFICAÇÃO PROFISSIONAL (Substitui os alerts nativos)
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

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
    
    if(produtos.length === 0) {
        listaUl.innerHTML = '<li style="color: var(--text-muted)">Nenhum item cadastrado</li>';
        return;
    }

    produtos.forEach(p => {
        listaUl.innerHTML += `
            <li>
                <span><strong>${p.nome}</strong> - R$ ${p.preco.toFixed(2)}</span>
                <button onclick="removerCadastroProduto('${p.id}')" class="btn-remover">Remover</button>
            </li>
        `;
    });
}

async function removerCadastroProduto(id) {
    if (!confirm("Tem certeza que deseja remover este produto permanentemente?")) return;
    try {
        await deletarDados(STORE_PRODUTOS, id);
        showToast("Produto removido com sucesso!", "success");
        await carregarEAtualizarProdutos();
    } catch (error) {
        console.error("Erro ao remover produto:", error);
        showToast("Erro ao remover produto.", "error");
    }
}

async function cadastrarNovoProduto() {
    const nomeInput = document.getElementById('nome-item');
    const precoInput = document.getElementById('preco-item');
    const nome = nomeInput.value.trim();
    const preco = parseFloat(precoInput.value);
    
    if (!nome || isNaN(preco) || preco <= 0) {
        showToast("Preencha o nome e um preço válido.", "warning");
        return;
    }

    const novoProduto = { nome, preco }; 

    try {
        await inserirDados(STORE_PRODUTOS, novoProduto);
        nomeInput.value = '';
        precoInput.value = '';
        showToast(`Item "${nome}" adicionado com sucesso!`, "success");
        await carregarEAtualizarProdutos(); 
    } catch (error) {
        console.error("Erro ao cadastrar produto:", error);
        showToast("Erro ao cadastrar produto.", "error");
    }
}

function popularSeletorVendas(produtos) {
    const select = document.getElementById('select-produto');
    select.innerHTML = '<option value="">-- Selecione um Produto --</option>';
    produtos.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = `${p.nome} (R$ ${p.preco.toFixed(2)})`;
        select.appendChild(option);
    });
}

// --- MESAS ---
async function carregarEAtualizarMesas() {
    mesasCadastradas = await consultarTodos(STORE_MESAS);
    renderizarMesas();
    popularSeletorMesas(mesasCadastradas);
}

function renderizarMesas() {
    const listaUl = document.getElementById('lista-mesas');
    listaUl.innerHTML = '';
    
    if(mesasCadastradas.length === 0) {
        listaUl.innerHTML = '<li style="color: var(--text-muted)">Nenhuma mesa cadastrada</li>';
        return;
    }

    mesasCadastradas.forEach(m => {
        const status = m.pedido && m.pedido.length > 0 ? '⚠️ ABERTA' : '✅ LIVRE';
        listaUl.innerHTML += `
            <li>
                <span><strong>${m.nome}</strong> <small style="margin-left: 8px; color: var(--text-muted)">[${status}]</small></span>
                <button onclick="removerCadastroMesa('${m.id}')" class="btn-remover">Remover</button>
            </li>
        `;
    });
}

function popularSeletorMesas(mesas) {
    const select = document.getElementById('select-mesa-ativa');
    select.innerHTML = '<option value="">-- Selecione a Mesa --</option>';
    mesas.forEach(m => {
        const statusText = m.pedido && m.pedido.length > 0 ? ' (ABERTA)' : ' (LIVRE)';
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
        showToast("Mesa removida com sucesso!", "success");
        await carregarEAtualizarMesas();
    } catch (error) {
        console.error("Erro ao remover mesa:", error);
        showToast("Erro ao remover a mesa.", "error");
    }
}

async function cadastrarNovaMesa() {
    const mesaInput = document.getElementById('nome-mesa');
    const nome = mesaInput.value.trim();
    if (!nome) {
        showToast("Por favor, preencha o nome da mesa.", "warning");
        return;
    }
    const novaMesa = { nome, pedido: [], descricao: '' }; 

    try {
        await inserirDados(STORE_MESAS, novaMesa);
        mesaInput.value = '';
        showToast(`Mesa "${nome}" cadastrada com sucesso!`, "success");
        await carregarEAtualizarMesas(); 
    } catch (error) {
        console.error("Erro ao cadastrar mesa:", error);
        showToast("Erro ao cadastrar mesa.", "error");
    }
}

function abrirMesaParaVenda() {
    const mesaId = document.getElementById('select-mesa-ativa').value;
    if (!mesaId) {
        showToast("Selecione uma mesa para iniciar/abrir a venda.", "warning");
        return;
    }

    const mesaSelecionada = mesasCadastradas.find(m => m.id === mesaId);

    if (!mesaSelecionada) {
        showToast("Mesa não encontrada.", "error");
        return;
    }

    mesaAtiva = mesaSelecionada;
    vendaAtual = mesaAtiva.pedido || []; 

    const descricaoMesaEl = document.getElementById('descricao-mesa');
    descricaoMesaEl.value = mesaAtiva.descricao || '';
    descricaoMesaEl.disabled = false;

    document.getElementById('mesa-ativa-status').textContent = `Mesa Ativa: ${mesaAtiva.nome} (ID: ${mesaAtiva.id.substring(mesaAtiva.id.length - 4).toUpperCase()})`;
    document.getElementById('select-forma-pagamento').disabled = false;

    renderizarVendaAtual();
    calcularTotalPagamento(); 
    showToast(`Mesa ${mesaAtiva.nome} carregada com sucesso!`, "success");
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

// --- LANÇAR VENDAS ---
async function adicionarItemVenda() {
    if (!mesaAtiva) {
        showToast("Por favor, selecione e abra uma mesa primeiro!", "warning");
        return;
    }
    const produtoId = document.getElementById('select-produto').value;
    const quantidadeInput = document.getElementById('quantidade');
    const quantidade = parseInt(quantidadeInput.value) || 1;

    if (!produtoId || isNaN(quantidade) || quantidade <= 0) {
        showToast("Selecione um produto e uma quantidade válida.", "warning");
        return;
    }

    const produtosCadastrados = await consultarTodos(STORE_PRODUTOS);
    const produtoBase = produtosCadastrados.find(p => p.id === produtoId);

    if (!produtoBase) {
        showToast("Produto não encontrado.", "error");
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
    quantidadeInput.value = 1; // Reseta indicador para 1
    showToast("Item adicionado ao pedido!", "success");
}

async function removerItemVenda(index) {
    if (index > -1) {
        vendaAtual.splice(index, 1);
        await salvarEstadoDaMesa();
        renderizarVendaAtual();
        showToast("Item removido do pedido.", "info");
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
    subtotalBruto = vendaAtual.reduce((total, item) => total + item.totalItem, 0) || 0;
    const formaPagamento = document.getElementById('select-forma-pagamento').value;
    let taxaPercentual = 0;

    if (formaPagamento === 'debito') {
        taxaPercentual = TAXA_DEBITO;
    } else if (formaPagamento === 'credito') {
        taxaPercentual = TAXA_CREDITO;
    } 

    const valorTaxa = subtotalBruto * taxaPercentual;
    const totalFinal = subtotalBruto + valorTaxa;

    // Injeta na UI
    document.getElementById('subtotal-bruto').textContent = `R$ ${subtotalBruto.toFixed(2)}`;
    document.getElementById('taxa-aplicada').textContent = `${(taxaPercentual * 100).toFixed(2)}%`;
    document.getElementById('valor-taxa').textContent = `R$ ${valorTaxa.toFixed(2)}`;
    document.getElementById('total-final').textContent = `R$ ${totalFinal.toFixed(2)}`;

    return { subtotalBruto, formaPagamento, taxaPercentual, valorTaxa, totalFinal };
}

function renderizarVendaAtual() {
    const tbody = document.getElementById('tabela-venda').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    
    if(vendaAtual.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Nenhum item lançado nesta mesa.</td></tr>';
        calcularTotalPagamento();
        return;
    }

    vendaAtual.forEach((item, i) => { 
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><strong>${item.nome}</strong></td>
            <td>${item.quantidade}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td style="color: var(--gold)">R$ ${item.totalItem.toFixed(2)}</td>
            <td style="text-align: center;"><button onclick="removerItemVenda(${i})" class="btn-remover">Remover</button></td> 
        `;
    });

    calcularTotalPagamento();
}

async function finalizarVenda() {
    if (!mesaAtiva) {
        showToast("Nenhuma mesa está ativa para ser finalizada.", "warning");
        return;
    }
    if (vendaAtual.length === 0) {
        showToast("A venda desta mesa não tem itens para finalizar.", "warning");
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
        
        // Limpa e libera a mesa de volta para o Firebase
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
        
        showToast(`Mesa finalizada com sucesso! Total: R$ ${totalFinal.toFixed(2)}`, "success");

    } catch (error) {
        console.error("Erro ao finalizar venda:", error);
        showToast("Erro ao fechar a venda.", "error");
    }
}

// --- HISTÓRICO ---
async function carregarEAtualizarHistorico() {
    const historicoVendas = await consultarTodos(STORE_VENDAS);
    const listaUl = document.getElementById('lista-historico');
    listaUl.innerHTML = '';
    
    if(historicoVendas.length === 0) {
        listaUl.innerHTML = '<li style="color: var(--text-muted)">Nenhuma venda registrada no histórico.</li>';
        return;
    }

    // Ordenar do mais novo para o mais antigo
    historicoVendas.sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(venda => { 
        const idCurto = venda.id.substring(venda.id.length - 4).toUpperCase();
        const descricaoTexto = venda.descricao ? `<br><small style="color: var(--accent)">📝 Obs: ${venda.descricao}</small>` : '';
        const taxaDetalhe = venda.valorTaxa > 0 ? ` + Taxa (${(venda.taxaAplicada * 100).toFixed(2)}%): R$ ${venda.valorTaxa.toFixed(2)}` : '';
        
        listaUl.innerHTML += `
            <li>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-bottom: 5px;">
                    <span style="color: var(--gold)">📌 ID: ${idCurto} | Mesa: ${venda.mesa}</span>
                    <span style="color: var(--text-muted)">⏰ ${venda.data}</span>
                </div>
                <span>Bruto: R$ ${venda.subtotalBruto.toFixed(2)}${taxaDetalhe}</span><br>
                <span>Pagamento: <strong>${venda.formaPagamento.toUpperCase()}</strong> | <strong style="color: var(--success)">Líquido: R$ ${venda.totalFinal.toFixed(2)}</strong></span>
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
        console.warn("Aviso: O carregamento inicial pode ter falhado por falta de dados no Firebase. Prossiga cadastrando um produto.");
        console.error("Detalhes do erro:", error);
    }
    
    // Listeners do Painel Operacional
    document.getElementById('select-forma-pagamento').addEventListener('change', calcularTotalPagamento);
    document.getElementById('descricao-mesa').addEventListener('change', salvarDescricaoMesa);

    document.getElementById('descricao-mesa').disabled = true;
    document.getElementById('select-forma-pagamento').disabled = true;

    // Mapeamento dos Botões da Interface
    document.getElementById('btn-cadastrar').addEventListener('click', cadastrarNovoProduto);
    document.getElementById('btn-cadastrar-mesa').addEventListener('click', cadastrarNovaMesa); 
    document.getElementById('btn-nova-mesa').addEventListener('click', abrirMesaParaVenda);   
    document.getElementById('btn-adicionar').addEventListener('click', adicionarItemVenda);
    document.getElementById('btn-finalizar').addEventListener('click', finalizarVenda);

    calcularTotalPagamento();
});
