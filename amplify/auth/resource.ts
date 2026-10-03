import { defineAuth } from '@aws-amplify/backend';

/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * AWS Amplify Gen 2 - Amazon Cognito Auth Resource
 *
 * Configuração:
 * - Autenticação baseada em E-mail e Senha.
 * - Grupos do Cognito: ADMINS (administradores) e USER (usuários comuns/farmacêuticos).
 * - Envio de código de verificação para e-mail no cadastro e recuperação de senha.
 * - Segurança: Cadastros públicos não podem autoatribuir privilégios administrativos.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['ADMINS', 'USER'],
  userAttributes: {
    preferredUsername: {
      mutable: true,
      required: false,
    },
    nickname: {
      mutable: true,
      required: false,
    },
  },
  senders: {
    email: {
      fromEmail: 'noreply@drogasil.com.br',
    },
  },
  accountRecovery: 'EMAIL_ONLY',
});
