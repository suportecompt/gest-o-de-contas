// Variables globales accesibles por todos los módulos
window.currentPage = 0;
window.pageSize = 40; // MODIFICADO: De 20 a 40 para cargar más registros y forzar la aparición del scroll interno
window.currentData = []; 
window.documentosSeleccionados = []; 
window.montoLineaActual = 0; 
window.fechaFilaActual = ""; 

// Inicialización de la App
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    if (typeof window.cargarDatosBancarios === 'function') {
        window.cargarDatosBancarios();
    }
    
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
});

// Sistema de Notificaciones Global
window.showToast = function(message, type = 'success') {
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
};

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
        if (window.currentPage > 0) { window.currentPage--; window.cargarDatosBancarios(); }
    };
    document.getElementById('next-page').onclick = () => {
        window.currentPage++; window.cargarDatosBancarios();
    };

    document.getElementById('btn-filtrar').addEventListener('click', () => {
        window.currentPage = 0; window.cargarDatosBancarios();
    });
    
    document.getElementById('btn-limpar-filtro').addEventListener('click', () => {
        document.getElementById('filter-ano').value = '';
        document.getElementById('filter-mes').value = '';
        if (document.getElementById('filter-desc')) document.getElementById('filter-desc').value = '';
        if (document.getElementById('filter-estado')) document.getElementById('filter-estado').value = '';
        
        window.currentPage = 0; window.cargarDatosBancarios();
        window.showToast("Filtros limpos", "info");
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}