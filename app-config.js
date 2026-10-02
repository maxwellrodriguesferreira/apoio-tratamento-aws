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
