/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * AWS Amplify Gen 2 Bridge & Client Integration
 *
 * Conecta a aplicação estática e seus módulos aos serviços de nuvem do Amplify Gen 2:
 * - Amazon Cognito Auth (Gen 2 Auth)
 * - Amplify Data (AWS AppSync + DynamoDB com RBAC)
 * - Amplify Functions (admin-actions e gemini-service com AWS Secrets Manager)
 * - Fallback inteligente para operação local/desenvolvimento
 */

const AmplifyBridge = (function() {
  let outputsConfig = null;
  let isInitialized = false;

  /**
   * Tenta carregar as configurações do amplify_outputs.json
   */
  async function loadAmplifyOutputs() {
    try {
      const response = await fetch('amplify_outputs.json', { cache: 'no-store' });
      if (response.ok) {
        outputsConfig = await response.json();
        return outputsConfig;
      }
    } catch (e) {
      // Ignora erro de fetch se o arquivo ainda não foi gerado pelo deploy
    }
    return null;
  }

  /**
   * Inicializa o cliente Amplify com as saídas geradas ou configuração legada
   */
  async function init() {
    if (isInitialized) return true;

    await loadAmplifyOutputs();

    if (outputsConfig && outputsConfig.auth && !outputsConfig.auth.user_pool_id.includes('PLACEHOLDER')) {
      console.log('🚀 AWS Amplify Gen 2 inicializado com sucesso via amplify_outputs.json');
      isInitialized = true;
      return true;
    }

    // Fallback com AppConfig
    if (typeof window !== 'undefined' && window.AppConfig && window.AppConfig.isCognitoConfigured()) {
      const cfg = window.AppConfig.getCognitoConfig();
      outputsConfig = {
        auth: {
          user_pool_id: cfg.userPoolId,
          aws_region: cfg.region || 'us-east-1',
          user_pool_client_id: cfg.clientId,
          groups: ['ADMINS', 'USER']
        }
      };
      isInitialized = true;
      return true;
    }

    return false;
  }

  return {
    init: init,
    getConfig: function() {
      return outputsConfig;
    },
    isReady: function() {
      return isInitialized;
    },
    
    /**
     * Executa chamada segura para a função Lambda do Gemini com segredo
     */
    callGeminiBackend: async function(action, payload, model) {
      if (!isInitialized || !outputsConfig || !outputsConfig.custom?.geminiServiceUrl) {
        // Fallback para chamada direta via AppConfig
        return null;
      }

      try {
        const session = typeof window !== 'undefined' && window.CognitoAuth ? window.CognitoAuth.getSession() : null;
        const idToken = session ? session.idToken : '';

        const res = await fetch(outputsConfig.custom.geminiServiceUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
          },
          body: JSON.stringify({ action, payload, model })
        });

        return await res.json();
      } catch (err) {
        console.warn('Falha na chamada ao Gemini Backend Lambda:', err);
        return null;
      }
    },

    /**
     * Executa ação administrativa no backend Lambda com verificação de autorização RBAC
     */
    callAdminBackend: async function(action, params = {}) {
      if (!isInitialized || !outputsConfig || !outputsConfig.custom?.adminActionsUrl) {
        return null;
      }

      try {
        const session = typeof window !== 'undefined' && window.CognitoAuth ? window.CognitoAuth.getSession() : null;
        const idToken = session ? session.idToken : '';

        const res = await fetch(outputsConfig.custom.adminActionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            action,
            ...params,
            callerEmail: session?.user || '',
            callerGroups: session?.role === 'admin' ? ['ADMINS'] : ['USER']
          })
        });

        return await res.json();
      } catch (err) {
        console.warn('Falha ao comunicar com a Lambda adminActions:', err);
        return null;
      }
    }
  };
})();

// Inicializa no carregamento do script no navegador
if (typeof window !== 'undefined') {
  window.AmplifyBridge = AmplifyBridge;
  AmplifyBridge.init().catch(console.error);
}

if (typeof module !== 'undefined') {
  module.exports = AmplifyBridge;
}
