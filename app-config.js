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
  geminiModel: "gemini-2.5-flash",
  
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
   * Obtém a chave da API do Gemini configurada (priorizando App Config, depois Local Storage)
   */
  getGeminiApiKey: function() {
    // 1. Chave injetada no build ou configurada no APP_CONFIG (se não for placeholder)
    if (APP_CONFIG.geminiApiKey && APP_CONFIG.geminiApiKey !== 'GEMINI_API_KEY_PLACEHOLDER' && !APP_CONFIG.geminiApiKey.includes('PLACEHOLDER')) {
      return APP_CONFIG.geminiApiKey.trim();
    }
    
    // 2. Chave armazenada na configuração local do app
    if (typeof localStorage !== 'undefined') {
      const savedKey = localStorage.getItem('apoio_gemini_api_key');
      if (savedKey && savedKey.trim()) {
        return savedKey.trim();
      }
    }
    
    return '';
  },

  /**
   * Salva a chave da API do Gemini na configuração da aplicação
   */
  setGeminiApiKey: function(apiKey) {
    const cleanKey = String(apiKey || '').trim();
    if (typeof localStorage !== 'undefined') {
      if (cleanKey) {
        localStorage.setItem('apoio_gemini_api_key', cleanKey);
      } else {
        localStorage.removeItem('apoio_gemini_api_key');
      }
    }
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
   * Obtém as credenciais padrão do Administrador Master configuradas
   */
  getAdminCredentials: function() {
    const user = (APP_CONFIG.adminUser && !APP_CONFIG.adminUser.includes('PLACEHOLDER')) 
      ? APP_CONFIG.adminUser.trim() 
      : 'admin';
    const pass = (APP_CONFIG.adminPassword && !APP_CONFIG.adminPassword.includes('PLACEHOLDER')) 
      ? APP_CONFIG.adminPassword.trim() 
      : 'admin123';
    const name = APP_CONFIG.adminName || 'Administrador Master';
    return { user, pass, name };
  },

  /**
   * Obtém o modelo Gemini em uso
   */
  getGeminiModel: function() {
    return APP_CONFIG.geminiModel || 'gemini-2.5-flash';
  }
};

// Exporta globalmente para o navegador
if (typeof window !== 'undefined') {
  window.APP_CONFIG = APP_CONFIG;
  window.AppConfig = AppConfig;
}
