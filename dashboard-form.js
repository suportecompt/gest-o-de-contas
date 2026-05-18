// ==========================================
// MÓDULO: dashboard-form.js (Versão Popup)
// Gestión del Modal de Conciliación y Guardado
// ESTRUCTURA DE DATOS UNIFICADA: id, gross_total, date, contribuinte2, empresa
// ==========================================

// Función auxiliar interna para buscar el nombre de la empresa usando contribuinte2
async function obtenerNombreEmpresa(nif) {
    if (!nif) return "";
    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.COMPANY}?nif=eq.${encodeURIComponent(nif)}&select=descricao`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();
        if (data && data.length > 0 && data[0].descricao) {
            return data[0].descricao;
        }
    } catch (e) {
        console.error("Erro ao buscar nome da empresa:", e);
    }
    return "";
}

// Abrir detalles e iniciar conciliación (Muestra el Pop-up)
window.verDetalleByIndex = async function(index) {
    const item = window.currentData[index];
    if (!item) return;

    window.montoLineaActual = parseFloat(item.montante || 0);
    window.fechaFilaActual = item.data_valor || ""; 

    const modal = document.getElementById('modal-conciliacion');
    const container = document.getElementById('form-container');
    
    if (modal) modal.classList.remove('hidden');
    container.innerHTML = `<div class="p-16 text-center text-slate-400 text-sm font-medium">Carregando detalhes...</div>`;

    try {
        let idsExistentes = Array.isArray(item.associated_documents) ? item.associated_documents : [];
        if (idsExistentes.length > 0) {
            // CORRECCIÓN URL SUPABASE: Los elementos de un filtro 'in' se envuelven limpios separados por comas
            const idList = idsExistentes.map(id => encodeURIComponent(id.trim())).join(',');
            
            const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?id=in.(${idList})&select=id,gross_total,date,contribuinte2`;
            const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
            const docsDetails = await res.json();
            
            if (Array.isArray(docsDetails)) {
                window.documentosSeleccionados = await Promise.all(docsDetails.map(async (d) => {
                    const nombreEmpresa = await obtenerNombreEmpresa(d.contribuinte2);
                    return {
                        id: d.id || "",
                        gross_total: d.gross_total ?? 0,
                        date: d.date || "",
                        contribuinte2: d.contribuinte2 || "",
                        empresa: nombreEmpresa || ""
                    };
                }));
            } else {
                window.documentosSeleccionados = [];
            }
        } else {
            window.documentosSeleccionados = [];
        }
        renderFormulario(item);
    } catch (err) {
        console.error("Erro ao carregar os detalhes do documento:", err);
        renderFormulario(item);
    }
};

function renderFormulario(item) {
    const container = document.getElementById('form-container');
    
    container.innerHTML = `
        <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center rounded-t-2xl">
            <div class="flex items-center gap-2">
                <div class="bg-blue-100 p-1.5 rounded-lg">
                    <i data-lucide="layers" class="w-4 h-4 text-blue-600"></i>
                </div>
                <h2 class="text-sm font-bold text-slate-800 uppercase tracking-wide">Conciliação de Registo Bancário</h2>
            </div>
            <button onclick="window.cancelarEdicion()" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors">
                <i data-lucide="x" class="w-5 h-5"></i>
            </button>
        </div>

        <div class="p-6">
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
                                <b class="text-sm ${parseFloat(item.montante) >= 0 ? 'text-emerald-600' : 'text-red-600'}">${parseFloat(item.montante).toFixed(2)}€</b>
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
                        <div class="space-y-2 relative">
                            <label class="block text-[9px] font-black text-gray-400 uppercase ml-1">🔗 Pesquisar Documento (ID)</label>
                            <div class="flex gap-2">
                                <input type="text" id="input-busca-docs" placeholder="ID da factura..." autocomplete="off"
                                    class="flex-1 text-xs border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
                                    oninput="window.buscarDocumentosEnTiempoReal(this.value)">
                                <button onclick="window.agregarDocumentoDesdeInput()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg transition-colors shadow-md">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                            </div>
                            <div id="docs-dropdown-custom" class="hidden absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] max-h-64 overflow-y-auto" style="scrollbar-width: thin;"></div>
                        </div>
                        <div id="indicador-reconciliacion"></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
            <button onclick="window.cancelarEdicion()" class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
            <button id="btn-gravar-asociacion" onclick="window.intentarGuardar(${item.id_interno})" 
                class="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-2 shadow-lg transition-all opacity-50 cursor-not-allowed">
                <i data-lucide="save" class="w-4 h-4"></i> GRAVAR
            </button>
        </div>
    `;

    window.actualizarListaVisual();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.agregarDocumentoDesdeInput = async function() {
    const input = document.getElementById('input-busca-docs');
    let idBusqueda = input.value.trim();
    if (!idBusqueda) return;

    if (idBusqueda.includes(' - ')) {
        idBusqueda = idBusqueda.split(' - ')[0];
    }

    if (window.documentosSeleccionados.some(d => d.id === idBusqueda)) return;

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?id=eq.${encodeURIComponent(idBusqueda)}&select=id,gross_total,date,contribuinte2`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();

        if (data && data.length > 0) {
            const nombreEmpresa = await obtenerNombreEmpresa(data[0].contribuinte2);
            
            // Sincronizado a claves nativas
            window.documentosSeleccionados.push({ 
                id: data[0].id || "", 
                gross_total: data[0].gross_total ?? 0,
                date: data[0].date || "",
                contribuinte2: data[0].contribuinte2 || "",
                empresa: nombreEmpresa || ""
            });
            input.value = '';
            window.actualizarListaVisual();
            window.showToast("Documento adicionado!");
        } else {
            window.showToast("Documento não encontrado.", "error");
        }
    } catch (e) { console.error(e); }

    const dropdown = document.getElementById('docs-dropdown-custom');
    if (dropdown) dropdown.classList.add('hidden');
};

window.eliminarDeLista = function(id) {
    window.documentosSeleccionados = window.documentosSeleccionados.filter(d => d.id !== id);
    window.actualizarListaVisual();
    window.showToast("Documento removido", "info");
};

window.actualizarListaVisual = function() {
    const lista = document.getElementById('lista-asociados');
    if (!lista) return;

    if (window.documentosSeleccionados.length === 0) {
        lista.innerHTML = '<div class="h-full flex items-center justify-center text-slate-300 text-[10px] uppercase font-bold italic">Vazio</div>';
        actualizarIndicadorSuma(0);
        return;
    }
    
    // CORRECCIÓN: Leemos 'doc.gross_total' de forma uniforme
    const sumaTotalDocs = window.documentosSeleccionados.reduce((acc, doc) => acc + (parseFloat(doc.gross_total) || 0), 0);
    
    lista.innerHTML = window.documentosSeleccionados.map(doc => {
        const valorLimpio = doc.gross_total !== undefined && doc.gross_total !== null ? parseFloat(doc.gross_total).toFixed(2) : '0.00';
        return `
            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded border border-slate-100 shadow-sm hover:border-blue-200 transition-colors">
                <div class="flex flex-col min-w-0 flex-1 pr-2">
                    <div class="flex items-center gap-1.5 truncate">
                        <span class="text-xs font-bold text-blue-600 shrink-0">${doc.id || '---'}</span>
                        ${doc.empresa ? `<span class="text-[10px] font-medium text-slate-500 truncate">- ${doc.empresa}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span class="font-bold text-slate-600">${valorLimpio}€</span>
                        <span>•</span>
                        <span>ID: ${doc.id || '---'}</span>
                        <span>•</span>
                        <span>${doc.contribuinte2 || '---'}</span>
                    </div>
                </div>
                <button onclick="window.eliminarDeLista('${doc.id}')" class="text-red-400 hover:text-red-600 p-1 shrink-0 transition-colors">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
    }).join('');
    
    actualizarIndicadorSuma(sumaTotalDocs);
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

function actualizarIndicadorSuma(suma) {
    const contenedorSuma = document.getElementById('indicador-reconciliacion');
    const btnGravar = document.getElementById('btn-gravar-asociacion');
    if (!contenedorSuma) return;

    const diff = Math.abs(Math.abs(window.montoLineaActual) - suma);
    const coinciden = diff < 0.01;

    if (btnGravar) {
        if (coinciden && window.documentosSeleccionados.length > 0) {
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
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.intentarGuardar = function(id_interno) {
    const sumaTotalDocs = window.documentosSeleccionados.reduce((acc, doc) => acc + (parseFloat(doc.gross_total) || 0), 0);
    const diff = Math.abs(Math.abs(window.montoLineaActual) - sumaTotalDocs);
    const coinciden = diff < 0.01;

    if (window.documentosSeleccionados.length === 0) {
        window.showToast("Selecione pelo menos um documento.", "info");
        return;
    }

    if (!coinciden) {
        window.showToast("O valor total deve ser exactamente igual ao montante bancário.", "error");
        return;
    }

    window.guardarAsociacion(id_interno);
};

window.guardarAsociacion = async function(id_interno) {
    try {
        const soloIds = window.documentosSeleccionados.map(doc => doc.id);
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.BANK_DETAILS}?id_interno=eq.${id_interno}`;
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ associated_documents: soloIds }) 
        });
        
        if(res.ok) {
            window.showToast("✅ Gravado com sucesso!");
            window.cargarDatosBancarios(); 
            window.cancelarEdicion();
        } else {
            throw new Error();
        }
    } catch (err) { 
        window.showToast("❌ Erro ao gravar", "error"); 
    }
};

window.cancelarEdicion = function() {
    window.fechaFilaActual = ""; 
    const modal = document.getElementById('modal-conciliacion');
    const container = document.getElementById('form-container');
    
    if (modal) modal.classList.add('hidden');
    if (container) container.innerHTML = '';
};