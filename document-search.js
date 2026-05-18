// ==========================================
// MÓDULO: document-search.js
// Búsqueda en Tiempo Real y Control de Dropdown Flotante (CON FALLBACKS VISUALES)
// Modificado: Corrección de estructura de datos para compatibilidad total con guardado
// ==========================================

// Obtener el nombre de la empresa usando el NIF de contribuinte2
async function buscarNombreEmpresaDropdown(nif) {
    if (!nif) return "";
    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.COMPANY}?nif=eq.${encodeURIComponent(nif)}&select=descricao`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();
        if (data && data.length > 0 && data[0].descricao) {
            return data[0].descricao;
        }
    } catch (e) {
        console.error("Erro ao buscar nome da empresa para dropdown:", e);
    }
    return "";
}

// Intercepta la escritura y dibuja las dos líneas en el panel flotante
window.buscarDocumentosEnTiempoReal = async function(value) {
    const dropdown = document.getElementById('docs-dropdown-custom');
    const buscar = value.trim();

    if (buscar.length < 2) {
        if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
        }
        return;
    }

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}?or=(id.ilike.*${encodeURIComponent(buscar)}*,contribuinte2.ilike.*${encodeURIComponent(buscar)}*)&select=id,gross_total,date,contribuinte2&limit=15`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();

        if (!dropdown) return;

        // 🚀 REGLA DE ORO CSS: Forzamos a que el dropdown flote hacia arriba y tenga scroll interno limitado.
        dropdown.className = "absolute left-0 bottom-full mb-1 w-full bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100";

        if (data && data.length > 0) {
            const opcionesHTML = await Promise.all(data.map(async (doc) => {
                const nombreEmpresa = await buscarNombreEmpresaDropdown(doc.contribuinte2);
                
                // 1. FALLBACK FECHA: Si no hay fecha, muestra "Data N/D"
                let fechaFormateada = "Data N/D";
                if (doc.date) {
                    const partes = doc.date.split('-');
                    if (partes.length === 3) fechaFormateada = `${partes[2]}-${partes[1]}-${partes[0]}`;
                }

                // 2. FALLBACK EMPRESA: Si no cruza con la BD, avisa que es desconocida
                const textoEmpresa = nombreEmpresa 
                    ? ` - ${nombreEmpresa}` 
                    : ` <span class="text-slate-400 italic font-normal">- Desconhecida</span>`;
                
                // 3. FALLBACK VALOR: Si está vacío o nulo, asegura que sea 0.00
                const valorLimpio = doc.gross_total !== null && doc.gross_total !== undefined 
                    ? parseFloat(doc.gross_total).toFixed(2) 
                    : '0.00';
                
                // 4 & 5. FALLBACKS ID y NIF
                const idVisual = doc.id || '<span class="italic text-slate-400">ID N/D</span>';
                const nifVisual = doc.contribuinte2 || '<span class="italic text-slate-400">Sem NIF</span>';

                // 🔑 REPARACIÓN CRÍTICA: Mantenemos estrictamente las claves nativas de Supabase.
                // Añadimos además la propiedad 'empresa' que requiere el renderizado visual de la lista.
                const infoDoc = {
                    id: doc.id || "",
                    gross_total: doc.gross_total ?? 0,
                    date: doc.date || "",
                    contribuinte2: doc.contribuinte2 || "",
                    empresa: nombreEmpresa || ""
                };
                const jsonDoc = JSON.stringify(infoDoc).replace(/"/g, '&quot;');

                // Estructura inyectando las variables visuales
                return `
                    <div onclick="window.seleccionarDesdeDropdownFlotante('${jsonDoc}')" 
                        class="flex flex-col px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-left transition-colors">
                        <span class="text-xs font-bold text-slate-800 truncate">${idVisual}${textoEmpresa}</span>
                        <span class="text-[10px] text-slate-500 font-mono mt-0.5">
                            ${valorLimpio}€ | ${fechaFormateada} | ${nifVisual}
                        </span>
                    </div>
                `;
            }));

            dropdown.innerHTML = opcionesHTML.join('');
            dropdown.classList.remove('hidden');
        } else {
            dropdown.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center italic">Nenhum documento encontrado</div>';
            dropdown.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Erro na busca em tempo real:", e);
    }
};

// Gestiona el clic en el elemento flotante e inyecta los datos en la lista superior
window.seleccionarDesdeDropdownFlotante = function(jsonStr) {
    const doc = JSON.parse(jsonStr);
    const input = document.getElementById('input-busca-docs');
    const dropdown = document.getElementById('docs-dropdown-custom');

    // Comprobamos duplicados usando la propiedad nativa 'id'
    if (!window.documentosSeleccionados.some(d => d.id === doc.id)) {
        window.documentosSeleccionados.push(doc);
        
        // Ejecuta la actualización visual definida en el formulario
        if (typeof window.actualizarListaVisual === 'function') {
            window.actualizarListaVisual();
        }
        if (typeof window.showToast === 'function') window.showToast("Documento adicionado!");
    } else {
        if (typeof window.showToast === 'function') window.showToast("O documento já está na lista.", "info");
    }

    if (input) input.value = '';
    if (dropdown) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
    }
};

// Cierra el dropdown custom si haces clic en cualquier otra parte del documento
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('docs-dropdown-custom');
    const input = document.getElementById('input-busca-docs');
    if (dropdown && input && !dropdown.contains(e.target) && e.target !== input) {
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
    }
});