// Variables globales
let currentPage = 0;
const pageSize = 20;
let currentData = []; 
let documentosSeleccionados = []; 
let montoLineaActual = 0; 
let fechaFilaActual = ""; 

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    cargarDatosBancarios();
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
});

// ==========================================
// FUNCIÓN DE NOTIFICACIONES (TOASTS)
// ==========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'check-circle-2' : type === 'error' ? 'alert-circle' : 'info';
    
    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.5s ease-in forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function initDashboard() {
    const displayEmail = document.getElementById('user-email-display');
    const userEmail = sessionStorage.getItem('user_email');
    if (displayEmail) displayEmail.textContent = userEmail || "Utilizador Ativo";

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'index.html';
        });
    }

    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 0) { currentPage--; cargarDatosBancarios(); }
    };
    document.getElementById('next-page').onclick = () => {
        currentPage++; cargarDatosBancarios();
    };

    document.getElementById('btn-filtrar').addEventListener('click', () => {
        currentPage = 0; cargarDatosBancarios();
    });
    
    document.getElementById('btn-limpar-filtro').addEventListener('click', () => {
        document.getElementById('filter-ano').value = '';
        document.getElementById('filter-mes').value = '';
        if (document.getElementById('filter-desc')) document.getElementById('filter-desc').value = '';
        if (document.getElementById('filter-estado')) document.getElementById('filter-estado').value = '';
        
        currentPage = 0; cargarDatosBancarios();
        showToast("Filtros limpos", "info");
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ==========================================
// 1. CARGAR DATOS BANCARIOS (CON FILTRO FLEXIBLE)
// ==========================================
async function cargarDatosBancarios() {
    const tbody = document.getElementById('table-body');
    const pageInfo = document.getElementById('page-info');
    const offset = currentPage * pageSize;
    
    const ano = document.getElementById('filter-ano').value;
    const mes = document.getElementById('filter-mes').value;
    const desc = document.getElementById('filter-desc') ? document.getElementById('filter-desc').value.trim() : '';
    const estadoFiltro = document.getElementById('filter-estado') ? document.getElementById('filter-estado').value : '';

    let extraFilters = '';
    
    // --- LÓGICA DE FECHA CORREGIDA Y COMPATIBLE ---
if (ano && mes) {
    // Caso 1: Año y Mes (Rango exacto)
    const mesStr = mes.padStart(2, '0');
    const ultimoDia = new Date(ano, mes, 0).getDate();
    extraFilters += `&data_valor=gte.${ano}-${mesStr}-01&data_valor=lte.${ano}-${mesStr}-${ultimoDia}`;
} else if (ano) {
    // Caso 2: Solo Año (Rango anual)
    extraFilters += `&data_valor=gte.${ano}-01-01&data_valor=lte.${ano}-12-31`;
} else if (mes) {
    // Caso 3: Solo Mes (Cualquier año)
    // Para evitar el 404/Error de tipo, usamos 'cd' (contained by) o 
    // preferiblemente buscamos en el año actual para evitar errores de casting de PostgREST
    const añoActual = new Date().getFullYear();
    const mesStr = mes.padStart(2, '0');
    const ultimoDia = new Date(añoActual, mes, 0).getDate();
    
    // Si realmente necesitas de TODOS los años, la columna debe ser casteada en Supabase 
    // pero como no podemos tocar la DB, limitamos al año actual o usamos:
    extraFilters += `&data_valor=gte.${añoActual}-${mesStr}-01&data_valor=lte.${añoActual}-${mesStr}-${ultimoDia}`;
    
    console.warn("Filtrando mes " + mesStr + " para o ano atual (" + añoActual + ")");
}

    if (desc) extraFilters += `&descricao=ilike.*${desc}*`;

    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">Carregando...</td></tr>`;

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.BANK_DETAILS}?select=*${extraFilters}&order=data_valor.desc&limit=${pageSize}&offset=${offset}`;
        const response = await fetch(url, {
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
        });
        let data = await response.json();

        // Obtener documentos para el mapeo de estados (validación de sumas)
        const resDocs = await fetch(`${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?select=id,gross_total`, {
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY }
        });
        const allDocs = await resDocs.json();
        const docsMap = {};
        if (Array.isArray(allDocs)) {
            allDocs.forEach(d => docsMap[d.id] = parseFloat(d.gross_total || 0));
        }

        if (response.ok) {
            // Filtro local por estado (Pendiente / Correcto)
            if (estadoFiltro) {
                data = data.filter(item => {
                    const montanteVal = parseFloat(item.montante) || 0;
                    const associatedIds = Array.isArray(item.associated_documents) ? item.associated_documents : [];
                    let sumaDocs = 0;
                    associatedIds.forEach(id => { sumaDocs += (docsMap[id] || 0); });
                    const diff = Math.abs(Math.abs(montanteVal) - sumaDocs);
                    const isValido = associatedIds.length > 0 && diff < 0.01;

                    if (estadoFiltro === 'pendente') return associatedIds.length === 0;
                    if (estadoFiltro === 'correcto') return isValido;
                    return true;
                });
            }

            currentData = data;
            tbody.innerHTML = '';
            if (pageInfo) pageInfo.textContent = `Pág. ${currentPage + 1}`;
            document.getElementById('prev-page').disabled = (currentPage === 0);
            document.getElementById('next-page').disabled = (data.length < pageSize);

            data.forEach((item, index) => {
                const montanteVal = parseFloat(item.montante) || 0;
                const associatedIds = Array.isArray(item.associated_documents) ? item.associated_documents : [];
                let sumaDocs = 0;
                associatedIds.forEach(id => { sumaDocs += (docsMap[id] || 0); });
                const diff = Math.abs(Math.abs(montanteVal) - sumaDocs);
                const isValido = associatedIds.length > 0 && diff < 0.01;

                let estadoHTML = !associatedIds.length ? `<span class="text-gray-300 italic text-[9px]">Pendente</span>` :
                    isValido ? `<div class="text-emerald-500 text-center"><i data-lucide="check-circle-2" class="w-4 h-4 mx-auto"></i></div>` :
                    `<div class="text-red-400 text-center" title="Dif: ${diff.toFixed(2)}€"><i data-lucide="x-circle" class="w-4 h-4 mx-auto"></i></div>`;

                const fila = document.createElement('tr');
                fila.className = "hover:bg-gray-50 border-b border-gray-50 transition-colors";
                fila.innerHTML = `
                    <td class="px-4 py-0.5 text-xs text-gray-500">${item.data_valor || ''}</td>
                    <td class="px-4 py-0.5 text-xs font-medium text-gray-800 truncate">${item.descricao || ''}</td>
                    <td class="px-4 py-0.5 text-xs text-right font-mono font-bold ${montanteVal >= 0 ? 'text-emerald-600' : 'text-red-600'}">${montanteVal.toFixed(2)}€</td>
                    <td class="px-4 py-0.5 text-xs text-gray-400 italic truncate">${item.notas || ''}</td>
                    <td class="px-4 py-0.5 text-[10px] font-mono text-blue-500 text-center font-bold">${associatedIds.join(", ")}</td>
                    <td class="px-4 py-0.5 text-center">${estadoHTML}</td>
                    <td class="px-4 py-0.5 text-center">
                        <button onclick="verDetalleByIndex(${index})" class="p-0.5 text-blue-500 hover:bg-blue-50 rounded">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(fila);
            });
            lucide.createIcons();
        }
    } catch (error) {
        console.error(error);
        showToast("Erro ao carregar datos", "error");
    }
}

// ==========================================
// 2. BUSCAR DOCUMENTOS (CORREGIDO TIPOS DATOS)
// ==========================================
window.buscarDocumentosEnTiempoReal = async function(query) {
    if (query.length < 2) return; 
    const datalist = document.getElementById('docs-datalist');
    const endpointDocs = window.AppConfig.ENDPOINTS.DOCUMENTS || '/rest/v1/documents';
    
    try {
        let orFilters = [];
        orFilters.push(`id.ilike.*${query}*`);

        const numQuery = query.replace(',', '.');
        if (!isNaN(numQuery) && numQuery.trim() !== "") {
            orFilters.push(`gross_total.eq.${numQuery}`);
        }

        let url = `${window.AppConfig.SUPABASE_URL}${endpointDocs}?select=id,gross_total,contribuinte1&or=(${orFilters.join(',')})&limit=10`;
        
        // El campo en documentos se llama 'date', usamos gte basado en la fecha de la fila bancaria
        if (fechaFilaActual) {
            url += `&date=gte.${fechaFilaActual}`;
        }

        const response = await fetch(url, { 
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } 
        });

        if (!response.ok) return;

        const docs = await response.json();
        if (!Array.isArray(docs)) return;

        datalist.innerHTML = ''; 
        docs.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.id; 
            option.textContent = `${parseFloat(doc.gross_total).toFixed(2)}€ | ID: ${doc.id} | ${doc.contribuinte1 || 'S/N'}`;
            datalist.appendChild(option);
        });
    } catch (e) { 
        console.error(e); 
    }
};

// ==========================================
// 3. LÓGICA DE FORMULARIO Y GUARDADO
// ==========================================
window.verDetalleByIndex = async function(index) {
    const item = currentData[index];
    if (!item) return;

    montoLineaActual = parseFloat(item.montante || 0);
    fechaFilaActual = item.data_valor || ""; 

    let idsExistentes = Array.isArray(item.associated_documents) ? item.associated_documents : [];
    
    const container = document.getElementById('form-container');
    container.innerHTML = `<div class="p-10 text-center text-slate-400">Carregando detalhes...</div>`;

    try {
        if (idsExistentes.length > 0) {
            const idList = idsExistentes.join('","');
            const res = await fetch(`${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?id=in.("${idList}")`, {
                headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY }
            });
            const docsDetails = await res.json();
            documentosSeleccionados = Array.isArray(docsDetails) ? docsDetails.map(d => ({ id: d.id, total: d.gross_total })) : [];
        } else {
            documentosSeleccionados = [];
        }
        renderFormulario(item);
    } catch (err) {
        console.error(err);
        renderFormulario(item);
    }
};

function renderFormulario(item) {
    const container = document.getElementById('form-container');
    container.className = "bg-white rounded-xl p-5 border border-blue-100 shadow-xl";
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div class="md:col-span-4 bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-3 h-full justify-between">
                <div>
                    <div class="flex items-center gap-2 border-b border-slate-200 pb-2 mb-4">
                        <i data-lucide="info" class="w-4 h-4 text-blue-500"></i>
                        <h3 class="text-[10px] font-black text-slate-700 uppercase tracking-wider">Registo Bancário</h3>
                    </div>
                    <div class="space-y-4 text-xs">
                        <div>
                            <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Data Valor</p>
                            <b class="text-slate-700">${item.data_valor || '---'}</b>
                        </div>
                        <div>
                            <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Montante</p>
                            <b class="text-sm ${parseFloat(item.montante) >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                                ${parseFloat(item.montante).toFixed(2)}€
                            </b>
                        </div>
                        <div>
                            <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Descrição</p>
                            <b class="text-slate-600 block leading-tight">${item.descricao || ''}</b>
                        </div>
                    </div>
                </div>
                <div class="pt-2 border-t border-slate-200 mt-4">
                    <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">ID Interno</p>
                    <b class="text-slate-400 font-mono text-[9px]">#${item.id_interno}</b>
                </div>
            </div>

            <div class="md:col-span-8 flex flex-col gap-4">
                <div class="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                    <div class="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex justify-between items-center">
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Documentos Selecionados</span>
                    </div>
                    <div id="lista-asociados" class="p-3 overflow-y-auto space-y-2 h-52 bg-white" style="scrollbar-width: thin;"></div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div class="space-y-2">
                        <label class="block text-[9px] font-black text-gray-400 uppercase ml-1">🔗 Pesquisar Documento (ID)</label>
                        <div class="flex gap-2">
                            <input type="text" id="input-busca-docs" list="docs-datalist" placeholder="ID da factura..." 
                                class="flex-1 text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                                oninput="buscarDocumentosEnTiempoReal(this.value)">
                            <datalist id="docs-datalist"></datalist>
                            <button onclick="agregarDocumentoDesdeInput()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg transition-colors shadow-md">
                                <i data-lucide="plus" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <div id="indicador-reconciliacion"></div>
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 mt-6 border-t border-slate-100">
            <button onclick="cancelarEdicion()" class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
            <button id="btn-gravar-asociacion" onclick="intentarGuardar(${item.id_interno})" 
                class="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-2 shadow-lg transition-all opacity-50 cursor-not-allowed">
                <i data-lucide="save" class="w-4 h-4"></i> GRAVAR
            </button>
        </div>
    `;

    actualizarListaVisual();
    lucide.createIcons();
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.agregarDocumentoDesdeInput = async function() {
    const input = document.getElementById('input-busca-docs');
    const idBusqueda = input.value.trim();
    if (!idBusqueda || documentosSeleccionados.some(d => d.id === idBusqueda)) return;

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?id=eq.${idBusqueda}&select=id,gross_total`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();

        if (data && data.length > 0) {
            documentosSeleccionados.push({ id: data[0].id, total: data[0].gross_total });
            input.value = '';
            actualizarListaVisual();
            showToast("Documento adicionado!");
        } else {
            showToast("Documento não encontrado.", "error");
        }
    } catch (e) { console.error(e); }
};

window.eliminarDeLista = function(id) {
    documentosSeleccionados = documentosSeleccionados.filter(d => d.id !== id);
    actualizarListaVisual();
    showToast("Documento removido", "info");
};

function actualizarListaVisual() {
    const lista = document.getElementById('lista-asociados');
    if (documentosSeleccionados.length === 0) {
        lista.innerHTML = '<div class="h-full flex items-center justify-center text-slate-300 text-[10px] uppercase font-bold italic">Vazio</div>';
        actualizarIndicadorSuma(0);
        return;
    }
    const sumaTotalDocs = documentosSeleccionados.reduce((acc, doc) => acc + (parseFloat(doc.total) || 0), 0);
    lista.innerHTML = documentosSeleccionados.map(doc => `
        <div class="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
            <div class="flex flex-col">
                <span class="text-xs font-bold text-blue-600">${doc.id}</span>
                <span class="text-[10px] text-gray-500 font-mono">${parseFloat(doc.total).toFixed(2)}€</span>
            </div>
            <button onclick="eliminarDeLista('${doc.id}')" class="text-red-400 hover:text-red-600 p-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
    `).join('');
    actualizarIndicadorSuma(sumaTotalDocs);
    lucide.createIcons();
}

function actualizarIndicadorSuma(suma) {
    const contenedorSuma = document.getElementById('indicador-reconciliacion');
    const btnGravar = document.getElementById('btn-gravar-asociacion');
    if (!contenedorSuma) return;

    const diff = Math.abs(Math.abs(montoLineaActual) - suma);
    const coinciden = diff < 0.01;

    if (btnGravar) {
        if (coinciden && documentosSeleccionados.length > 0) {
            btnGravar.classList.remove('opacity-50', 'cursor-not-allowed');
            btnGravar.classList.add('opacity-100', 'cursor-pointer');
        } else {
            btnGravar.classList.add('opacity-50', 'cursor-not-allowed');
            btnGravar.classList.remove('opacity-100', 'cursor-pointer');
        }
    }

    if (suma === 0) { 
        contenedorSuma.innerHTML = ''; 
        return; 
    }

    contenedorSuma.innerHTML = `
        <div class="w-full flex items-center justify-between p-2.5 rounded-lg border ${coinciden ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}">
            <div>
                <p class="text-[8px] font-bold uppercase ${coinciden ? 'text-emerald-700' : 'text-amber-700'}">Soma Selecionada</p>
                <p class="text-xs font-black ${coinciden ? 'text-emerald-600' : 'text-amber-600'}">${suma.toFixed(2)}€</p>
            </div>
            <p class="text-[9px] font-black ${coinciden ? 'text-emerald-600' : 'text-amber-600'}">
                ${coinciden ? '✅ COINCIDE' : '⚠️ DIFERENÇA: ' + diff.toFixed(2) + '€'}
            </p>
        </div>
    `;
    lucide.createIcons();
}

window.intentarGuardar = function(id_interno) {
    const sumaTotalDocs = documentosSeleccionados.reduce((acc, doc) => acc + (parseFloat(doc.total) || 0), 0);
    const diff = Math.abs(Math.abs(montoLineaActual) - sumaTotalDocs);
    const coinciden = diff < 0.01;

    if (documentosSeleccionados.length === 0) {
        showToast("Selecione pelo menos um documento.", "info");
        return;
    }

    if (!coinciden) {
        showToast("O valor total deve ser exactamente igual ao montante bancário.", "error");
        return;
    }

    guardarAsociacion(id_interno);
};

window.guardarAsociacion = async function(id_interno) {
    try {
        const soloIds = documentosSeleccionados.map(doc => doc.id);
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.BANK_DETAILS}?id_interno=eq.${id_interno}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ associated_documents: soloIds }) 
        });
        
        if(res.ok) {
            showToast("✅ Gravado com sucesso!");
            cargarDatosBancarios(); 
            cancelarEdicion();
        } else {
            throw new Error();
        }
    } catch (err) { 
        showToast("❌ Erro ao gravar", "error"); 
    }
};

window.cancelarEdicion = function() {
    fechaFilaActual = ""; 
    const container = document.getElementById('form-container');
    container.className = "border-2 border-dashed border-gray-50 rounded-xl min-h-[80px] flex items-center justify-center text-gray-300";
    container.innerHTML = '<p class="text-[10px] font-bold uppercase italic">Selecione um registo</p>';
};