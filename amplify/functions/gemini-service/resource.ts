import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Função Lambda para execução da IA Google Gemini no Backend
 * Utiliza o segredo GEMINI_API_KEY injetado via AWS Secrets Manager / Amplify Secrets.
 * Impede que a chave de API da IA seja exposta no navegador dos usuários.
 */
export const geminiService = defineFunction({
  name: 'gemini-service',
  entry: './handler.ts',
  environment: {
    GEMINI_API_KEY: secret('GEMINI_API_KEY'),
    DEFAULT_MODEL: 'gemini-3.8-flash',
  },
  timeoutSeconds: 45,
});
