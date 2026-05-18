// Cargar datos en la tabla principal
window.cargarDatosBancarios = async function() {
    const tbody = document.getElementById('table-body');
    const pageInfo = document.getElementById('page-info');
    const offset = window.currentPage * window.pageSize;
    
    const ano = document.getElementById('filter-ano').value;
    const mes = document.getElementById('filter-mes').value;
    const desc = document.getElementById('filter-desc') ? document.getElementById('filter-desc').value.trim() : '';
    const estadoFiltro = document.getElementById('filter-estado') ? document.getElementById('filter-estado').value : '';

    let extraFilters = '';
    
    // Filtros de fecha optimizados
    if (ano && mes) {
        const mesStr = mes.padStart(2, '0');
        const ultimoDia = new Date(ano, mes, 0).getDate();
        extraFilters += `&data_valor=gte.${ano}-${mesStr}-01&data_valor=lte.${ano}-${mesStr}-${ultimoDia}`;
    } else if (ano) {
        extraFilters += `&data_valor=gte.${ano}-01-01&data_valor=lte.${ano}-12-31`;
    } else if (mes) {
        const añoActual = new Date().getFullYear();
        const mesStr = mes.padStart(2, '0');
        const ultimoDia = new Date(añoActual, mes, 0).getDate();
        extraFilters += `&data_valor=gte.${añoActual}-${mesStr}-01&data_valor=lte.${añoActual}-${mesStr}-${ultimoDia}`;
    }

    if (desc) extraFilters += `&descricao=ilike.*${desc}*`;

    tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">Carregando...</td></tr>`;

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.BANK_DETAILS}?select=*${extraFilters}&order=data_valor.desc&limit=${window.pageSize}&offset=${offset}`;
        const response = await fetch(url, {
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
        });
        let data = await response.json();

        // Mapeo de documentos para validar sumas
        const resDocs = await fetch(`${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?select=id,gross_total`, {
            headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY }
        });
        const allDocs = await resDocs.json();
        const docsMap = {};
        if (Array.isArray(allDocs)) {
            allDocs.forEach(d => docsMap[d.id] = parseFloat(d.gross_total || 0));
        }

        if (response.ok) {
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

            window.currentData = data;
            tbody.innerHTML = '';
            if (pageInfo) pageInfo.textContent = `Pág. ${window.currentPage + 1}`;
            document.getElementById('prev-page').disabled = (window.currentPage === 0);
            document.getElementById('next-page').disabled = (data.length < window.pageSize);

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
                        <button onclick="window.verDetalleByIndex(${index})" class="p-0.5 text-blue-500 hover:bg-blue-50 rounded">
                            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(fila);
            });
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    } catch (error) {
        console.error(error);
        window.showToast("Erro ao carregar datos", "error");
    }
};