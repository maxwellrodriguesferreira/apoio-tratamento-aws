import { defineFunction } from '@aws-amplify/backend';

/**
 * Função Lambda para operações administrativas no Amazon Cognito
 * Protegida no backend para execução exclusiva por identidades autorizadas (ADMINS).
 */
export const adminActions = defineFunction({
  name: 'admin-actions',
  entry: './handler.ts',
  environment: {
    APP_NAME: 'Terminal de Apoio ao Tratamento',
  },
  timeoutSeconds: 30,
});
