/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * Configurações da Aplicação e Integração com a API do Google Gemini
 *
 * POLÍTICA DE PRIVACIDADE E SEGURANÇA:
 * - Apenas as configurações da aplicação (chave da API Gemini) são gerenciadas.
 * - NENHUM dado de paciente ou cliente (nome, telefone, posologia, orientações ou mensagens)
 *   é salvo ou sincronizado em banco de dados externo/remoto.
 */

const APP_CONFIG = {
  // Chave de API padrão da aplicação (pode ser injetada via AWS Amplify Environment Variables ou configurada manualmente)
  geminiApiKey: "GEMINI_API_KEY_PLACEHOLDER",
  
  // Modelo padrão do Google Gemini
  geminiModel: "gemini-3.8-flash",
  
  // Configurações do AWS Cognito User Pools (Injetadas via AWS Amplify Environment Variables)
  cognitoRegion: "COGNITO_REGION_PLACEHOLDER",
  cognitoUserPoolId: "COGNITO_USER_POOL_ID_PLACEHOLDER",
  cognitoClientId: "COGNITO_CLIENT_ID_PLACEHOLDER",

  // Administrador Master da Aplicação (Configurável via AWS Amplify Environment Variables: ADMIN_USER e ADMIN_PASSWORD)
  adminUser: "ADMIN_USER_PLACEHOLDER",
  adminPassword: "ADMIN_PASSWORD_PLACEHOLDER",
  adminName: "Administrador Master",

  // Identificação do Sistema
  appName: "Terminal de Apoio ao Tratamento",
  unitName: "Drogasil Mogilar",
  version: "2026.10-aws"
};

// Armazenamento da configuração da aplicação
const AppConfig = {
  /**
   * Obtém a chave da API do Gemini configurada com persistência multicamada permanente
   */
  getGeminiApiKey: function() {
    // 1. Chave injetada no build do AWS Amplify ou gravada no APP_CONFIG
    if (APP_CONFIG.geminiApiKey && APP_CONFIG.geminiApiKey !== 'GEMINI_API_KEY_PLACEHOLDER' && !APP_CONFIG.geminiApiKey.includes('PLACEHOLDER')) {
      return APP_CONFIG.geminiApiKey.trim();
    }
    
    // 2. Chave armazenada no LocalStorage do navegador
    if (typeof localStorage !== 'undefined') {
      try {
        const savedKey = localStorage.getItem('apoio_gemini_api_key');
        if (savedKey && savedKey.trim()) {
          return savedKey.trim();
        }
      } catch (e) {}
    }

    // 3. Fallback: SessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        const sessionKey = sessionStorage.getItem('apoio_gemini_api_key');
        if (sessionKey && sessionKey.trim()) {
          return sessionKey.trim();
        }
      } catch (e) {}
    }

    // 4. Fallback: Cookie permanente (10 anos)
    if (typeof document !== 'undefined' && document.cookie) {
      try {
        const match = document.cookie.match(/(?:^|; )apoio_gemini_api_key=([^;]*)/);
        if (match && match[1]) {
          const decoded = decodeURIComponent(match[1]).trim();
          if (decoded) return decoded;
        }
      } catch (e) {}
    }
    
    return '';
  },

  /**
   * Salva a chave da API do Gemini de forma permanente em todos os armazenamentos
   */
  setGeminiApiKey: function(apiKey) {
    const cleanKey = String(apiKey || '').trim();
    
    // 1. Grava no LocalStorage permanente
    if (typeof localStorage !== 'undefined') {
      try {
        if (cleanKey) {
          localStorage.setItem('apoio_gemini_api_key', cleanKey);
        } else {
          localStorage.removeItem('apoio_gemini_api_key');
        }
      } catch (e) {}
    }

    // 2. Grava no SessionStorage
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (cleanKey) {
          sessionStorage.setItem('apoio_gemini_api_key', cleanKey);
        } else {
          sessionStorage.removeItem('apoio_gemini_api_key');
        }
      } catch (e) {}
    }

    // 3. Grava em Cookie permanente com validade de 10 anos
    if (typeof document !== 'undefined') {
      try {
        if (cleanKey) {
          const maxAge = 10 * 365 * 24 * 60 * 60; // 10 anos
          document.cookie = `apoio_gemini_api_key=${encodeURIComponent(cleanKey)}; max-age=${maxAge}; path=/; SameSite=Lax`;
        } else {
          document.cookie = 'apoio_gemini_api_key=; max-age=0; path=/; SameSite=Lax';
        }
      } catch (e) {}
    }

    // 4. Mantém em memória de execução
    APP_CONFIG.geminiApiKey = cleanKey || 'GEMINI_API_KEY_PLACEHOLDER';
    return true;
  },

  /**
   * Verifica se a API do Gemini está configurada
   */
  isGeminiConfigured: function() {
    const key = this.getGeminiApiKey();
    return Boolean(key && key.length > 10 && !key.includes('PLACEHOLDER'));
  },

  /**
   * Obtém as configurações do AWS Cognito
   */
  getCognitoConfig: function() {
    return {
      region: (APP_CONFIG.cognitoRegion && !APP_CONFIG.cognitoRegion.includes('PLACEHOLDER')) ? APP_CONFIG.cognitoRegion.trim() : 'us-east-1',
      userPoolId: (APP_CONFIG.cognitoUserPoolId && !APP_CONFIG.cognitoUserPoolId.includes('PLACEHOLDER')) ? APP_CONFIG.cognitoUserPoolId.trim() : '',
      clientId: (APP_CONFIG.cognitoClientId && !APP_CONFIG.cognitoClientId.includes('PLACEHOLDER')) ? APP_CONFIG.cognitoClientId.trim() : ''
    };
  },

  /**
   * Verifica se o AWS Cognito foi preenchido com credenciais reais da AWS
   */
  isCognitoConfigured: function() {
    const cfg = this.getCognitoConfig();
    return Boolean(cfg.userPoolId && cfg.clientId && !cfg.userPoolId.includes('PLACEHOLDER') && !cfg.clientId.includes('PLACEHOLDER'));
  },

  /**
   * Obtém as credenciais do Administrador Master configuradas via AWS Amplify
   */
  getAdminCredentials: function() {
    const user = (APP_CONFIG.adminUser && !APP_CONFIG.adminUser.includes('PLACEHOLDER')) 
      ? APP_CONFIG.adminUser.trim() 
      : 'admin@drogasil.com.br';
    const pass = (APP_CONFIG.adminPassword && !APP_CONFIG.adminPassword.includes('PLACEHOLDER')) 
      ? APP_CONFIG.adminPassword.trim() 
      : 'admin123';
    const name = (APP_CONFIG.adminName && !APP_CONFIG.adminName.includes('PLACEHOLDER'))
      ? APP_CONFIG.adminName.trim()
      : 'Maxwell Ferreira (Administrador)';
    return { user, pass, name };
  },

  /**
   * Obtém o modelo Gemini em uso
   */
  getGeminiModel: function() {
    return APP_CONFIG.geminiModel || 'gemini-3.8-flash';
  }
};

// Exporta globalmente para o navegador
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
  window.AppConfig = AppConfig;
}
