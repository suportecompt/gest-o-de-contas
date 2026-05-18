// Motor de búsqueda flexible en tiempo real para facturas/documentos
window.buscarDocumentosEnTiempoReal = async function(query) {
    if (query.length < 2) return; 
    const datalist = document.getElementById('docs-datalist');
    const endpointDocs = window.AppConfig.ENDPOINTS.DOCUMENTS || '/rest/v1/documents';
    
    try {
        let orFilters = [];
        orFilters.push(`id.ilike.*${query}*`);

        const numQuery = query.replace(',', '.');
        
        if (!isNaN(numQuery) && numQuery.trim() !== "") {
            if (numQuery.includes('.')) {
                orFilters.push(`gross_total.eq.${numQuery}`);
            } else {
                const minRange = parseFloat(numQuery);
                const maxRange = minRange + 0.9999;
                orFilters.push(`and(gross_total.gte.${minRange},gross_total.lte.${maxRange})`);
            }
        }

        let url = `${window.AppConfig.SUPABASE_URL}${endpointDocs}?select=id,gross_total,contribuinte1&or=(${orFilters.join(',')})&limit=10`;
        
        if (window.fechaFilaActual) {
            url += `&date=gte.${window.fechaFilaActual}`;
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