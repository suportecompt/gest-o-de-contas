// config.js
window.AppConfig = {
    SUPABASE_URL: 'https://supabase1.myserver.pt',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjEyMzQ1Njc4LCJleHAiOjI2MTIzNDU2Nzh9.szPPmYS9Pa9WENwHSgsrd7i_YaYLmmORiVqA9jguyGc',
    ENDPOINTS: {
        AUTH: '/auth/v1/token?grant_type=password',
        BANK_DETAILS: '/rest/v1/bank_details',
        DOCUMENTS: '/rest/v1/documents'
    }
};