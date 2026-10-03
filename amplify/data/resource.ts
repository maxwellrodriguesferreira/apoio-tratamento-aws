import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * AWS Amplify Gen 2 - Amplify Data (AWS AppSync + Amazon DynamoDB)
 *
 * Modelos de Dados e Regras de Autorização (RBAC):
 * - UserProfile: Perfil persistente do usuário vinculado ao 'sub' do Cognito.
 *   - allow.owner(): proprietário acessa e atualiza seu próprio perfil.
 *   - allow.group('ADMINS'): administradores têm acesso para moderação e auditoria.
 *
 * - AuditLog: Trilha de auditoria das ações administrativas.
 *   - allow.group('ADMINS'): exclusivo para consulta e registro por administradores.
 *
 * - UserHistory: Histórico e registros de utilização do operador/farmacêutico.
 *   - allow.owner(): isolamento estrito entre usuários; dados de um usuário inacessíveis a outros.
 */
const schema = a.schema({
  UserProfile: a
    .model({
      userId: a.string().required(),
      email: a.string().required(),
      name: a.string(),
      drogaria: a.string(),
      role: a.string(), // 'admin' | 'user'
      status: a.string(), // 'pending' | 'approved' | 'rejected' | 'blocked'
      preferences: a.json(), // Preferências de tema, chave de IA, atalhos, etc.
    })
    .authorization((allow) => [
      allow.owner(),
      allow.group('ADMINS'),
    ]),

  AuditLog: a
    .model({
      action: a.string().required(),
      performedBy: a.string().required(),
      targetUser: a.string(),
      details: a.string(),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [
      allow.group('ADMINS'),
    ]),

  UserHistory: a
    .model({
      userId: a.string().required(),
      tipoAtendimento: a.string(),
      conteudo: a.string(),
      timestamp: a.datetime(),
    })
    .authorization((allow) => [
      allow.owner(),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
