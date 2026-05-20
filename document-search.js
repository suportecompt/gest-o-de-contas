// ==========================================
// MÓDULO: document-search.js
// Búsqueda en Tiempo Real con Soporte Especial para PayPal Europe (Margen de 5€)
// Modificado: Corrección matemática de precisión de decimales para habilitar guardado tolerante
// ==========================================

// Obtener el nombre de la empresa descartando nuestro NIF de forma dinámica
async function buscarNombreEmpresaDropdown(nif1, nif2) {
    const miNif = "506648559"; 

    let nifAQueriear = nif2;
    if (nif2 === miNif && nif1) {
        nifAQueriear = nif1;
    }

    if (!nifAQueriear) return "";

    try {
        const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.COMPANY}?nif=eq.${encodeURIComponent(nifAQueriear)}&select=descricao`;
        const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        const data = await res.json();
        
        if (data && data.length > 0 && data[0].descricao) {
            return data[0].descricao;
        }
    } catch (e) {
        console.error("Erro ao buscar nome da empresa para dropdown:", e);
    }

    if (nifAQueriear === nif2 && nif1) {
        try {
            const url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.COMPANY}?nif=eq.${encodeURIComponent(nif1)}&select=descricao`;
            const res = await fetch(url, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
            const data = await res.json();
            if (data && data.length > 0 && data[0].descricao) {
                return data[0].descricao;
            }
        } catch (e) {
            console.error("Erro no fallback de busca de empresa:", e);
        }
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
        let url = `${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.DOCUMENTS}`;
        let usarFiltroPayPal = false;
        let valorMinimo = "0.00";
        let valorMaximo = "0.00";
        
        // DETECTAR PAYPAL EUROPE (Filtro insensible a mayúsculas/minúsculas)
        if (window.movimientoBancarioSeleccionado && 
            window.movimientoBancarioSeleccionado.descricao && 
            window.movimientoBancarioSeleccionado.descricao.toUpperCase().includes("PAYPAL EUROPE")) {
            
            const mb = window.movimientoBancarioSeleccionado;
            const importeCrudo = mb.montante !== undefined ? mb.montante : (mb.valor !== undefined ? mb.valor : (mb.amount !== undefined ? mb.amount : 0));
            const valorBanco = Math.abs(parseFloat(importeCrudo || 0));
            
            if (valorBanco > 0) {
                valorMinimo = (valorBanco - 5).toFixed(2);
                valorMaximo = valorBanco.toFixed(2);
                usarFiltroPayPal = true;
            }
        }

        // CONSTRUCCIÓN DE URL DE ACUERDO AL CASO
        let urlAQuerear = url;
        if (usarFiltroPayPal) {
            urlAQuerear += `?and=(or(id.ilike.*${encodeURIComponent(buscar)}*,contribuinte2.ilike.*${encodeURIComponent(buscar)}*),gross_total.gte.${valorMinimo},gross_total.lte.${valorMaximo})&select=id,gross_total,date,contribuinte1,contribuinte2&limit=15`;
        } else {
            urlAQuerear += `?or=(id.ilike.*${encodeURIComponent(buscar)}*,contribuinte2.ilike.*${encodeURIComponent(buscar)}*)&select=id,gross_total,date,contribuinte1,contribuinte2&limit=15`;
        }

        let res = await fetch(urlAQuerear, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
        let data = await res.json();
        let esFallbackOpcional = false;

        // Auto-Fallback: Si es PayPal y no encuentra nada en el margen estricto, busca en general hacia abajo para que el usuario pueda localizar la factura
        if (usarFiltroPayPal && (!data || data.length === 0)) {
            esFallbackOpcional = true;
            const urlFallback = url + `?and=(or(id.ilike.*${encodeURIComponent(buscar)}*,contribuinte2.ilike.*${encodeURIComponent(buscar)}*),gross_total.lte.${valorMaximo})&select=id,gross_total,date,contribuinte1,contribuinte2&limit=15`;
            res = await fetch(urlFallback, { headers: { 'apikey': window.AppConfig.SUPABASE_ANON_KEY } });
            data = await res.json();
        }

        if (!dropdown) return;

        dropdown.className = "absolute left-0 bottom-full mb-1 min-w-full w-[120%] sm:w-[130%] bg-white border border-slate-200 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-100";

        if (data && data.length > 0) {
            let htmlContenido = "";
            if (esFallbackOpcional) {
                htmlContenido += `<div class="p-2 text-[10px] bg-amber-50 text-amber-700 text-center font-medium italic border-b border-amber-100">Nenhum doc. entre ${valorMinimo}€ e ${valorMaximo}€. Exibindo menores que ${valorMaximo}€:</div>`;
            }

            const opcionesHTML = await Promise.all(data.map(async (doc) => {
                const nombreEmpresa = await buscarNombreEmpresaDropdown(doc.contribuinte1, doc.contribuinte2);
                
                let fechaFormateada = "Data N/D";
                if (doc.date) {
                    const partes = doc.date.split('-');
                    if (partes.length === 3) fechaFormateada = `${partes[2]}-${partes[1]}-${partes[0]}`;
                }

                const textoEmpresa = nombreEmpresa 
                    ? ` - ${nombreEmpresa}` 
                    : ` <span class="text-slate-400 italic font-normal">- Desconhecida</span>`;
                
                const valorLimpio = doc.gross_total !== null && doc.gross_total !== undefined 
                    ? parseFloat(doc.gross_total).toFixed(2) 
                    : '0.00';
                
                const idVisual = doc.id || '<span class="italic text-slate-400">ID N/D</span>';
                
                const miNif = "506648559";
                const nifVisual = (doc.contribuinte2 === miNif && doc.contribuinte1) ? doc.contribuinte1 : (doc.contribuinte2 || '<span class="italic text-slate-400">Sem NIF</span>');

                const infoDoc = {
                    id: doc.id || "",
                    gross_total: doc.gross_total ?? 0,
                    date: doc.date || "",
                    contribuinte2: doc.contribuinte2 || "",
                    empresa: nombreEmpresa || ""
                };
                const jsonDoc = JSON.stringify(infoDoc).replace(/"/g, '&quot;');

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

            dropdown.innerHTML = htmlContenido + opcionesHTML.join('');
            dropdown.classList.remove('hidden');
        } else {
            const rangoTexto = usarFiltroPayPal ? ` menor ou igual a ${valorMaximo}€` : '';
            dropdown.innerHTML = `<div class="p-3 text-xs text-slate-400 text-center italic">Nenhum documento encontrado${rangoTexto}</div>`;
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

    if (!window.documentosSeleccionados.some(d => d.id === doc.id)) {
        window.documentosSeleccionados.push(doc);
        
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

// 🌟 VALIDADOR ACTUALIZADO: Limpieza y redondeo de precisión binaria para guardar
window.validarConciliacionParaGuardar = function() {
    if (!window.movimientoBancarioSeleccionado) {
        if (typeof window.showToast === 'function') window.showToast("Nenhum movimento bancário selecionado.", "error");
        return false;
    }

    const sumaDocumentos = window.documentosSeleccionados.reduce((total, doc) => total + parseFloat(doc.gross_total || 0), 0);
    
    const mb = window.movimientoBancarioSeleccionado;
    const importeCrudo = mb.montante !== undefined ? mb.montante : (mb.valor !== undefined ? mb.valor : (mb.amount !== undefined ? mb.amount : 0));
    const valorBanco = Math.abs(parseFloat(importeCrudo || 0));

    const esPayPalEurope = mb.descricao && mb.descricao.toUpperCase().includes("PAYPAL EUROPE");

    if (esPayPalEurope) {
        // Formateamos y parseamos a string fija de dos decimales para neutralizar errores de redondeo de JS (ej: 3.79999999)
        const diferencia = parseFloat((valorBanco - sumaDocumentos).toFixed(2));

        // Validación estricta acotada al rango dinámico solicitado de 5 euros
        if (diferencia >= 0 && diferencia <= 5.00) {
            return true;
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast(`Erro: Para PayPal Europe, a diferença máxima permitida é de 5.00€. Diferença atual: ${diferencia.toFixed(2)}€`, "error");
            }
            return false;
        }
    } else {
        // Regla Estándar: Cuadre perfecto al céntimo
        const cuadreExacto = Math.abs(valorBanco - sumaDocumentos) < 0.01;
        if (!cuadreExacto) {
            if (typeof window.showToast === 'function') {
                window.showToast(`Erro: Os valores não coincidem. Banco: ${valorBanco.toFixed(2)}€ | Documentos: ${sumaDocumentos.toFixed(2)}€`, "error");
            }
            return false;
        }
        return true;
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