import { defineAuth } from '@aws-amplify/backend';

/**
 * Definição de Autenticação AWS Amplify Gen 2 (Amazon Cognito)
 * 
 * Configurações:
 * - Login com E-mail
 * - Atributos de usuário: Nome Completo e Drogaria
 * - Recuperação de conta via e-mail
 * - Privacidade LGPD: 0 dados de clientes em banco.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    fullname: {
      mutable: true,
      required: false,
    },
  },
  accountRecovery: 'EMAIL_ONLY',
});
