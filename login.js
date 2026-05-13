document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    const errorDiv = document.getElementById('loginErro');

    // Estado visual: Deshabilitar y mostrar carga
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="h-5 w-5 animate-spin"></i> Verificando...`;
    if (typeof lucide !== 'undefined') lucide.createIcons(); 
    errorDiv.textContent = "";

    try {
        const response = await fetch(`${window.AppConfig.SUPABASE_URL}${window.AppConfig.ENDPOINTS.AUTH}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': window.AppConfig.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            // 1. Guardamos el token de acceso
            sessionStorage.setItem('supabase_token', data.access_token);
            
            // 2. CORRECCIÓN: Guardamos el email del usuario (está en data.user.email)
            if (data.user && data.user.email) {
                sessionStorage.setItem('user_email', data.user.email);
            }

            // Redirigir al dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Manejo de errores específicos de Supabase
            const errorMsg = data.error_description || data.msg || "Credenciais inválidas";
            throw new Error(errorMsg);
        }

    } catch (err) {
        errorDiv.textContent = err.message;
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="log-in" class="h-5 w-5"></i> Entrar`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
});