import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { adminActions } from './functions/admin-actions/resource';
import { geminiService } from './functions/gemini-service/resource';

/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * AWS Amplify Gen 2 Backend Definition
 *
 * Recursos Integrados:
 * - Amazon Cognito: Autenticação, Grupos (ADMINS, USER) e Controle de Acesso.
 * - Amplify Data (AppSync + DynamoDB): Persistência em nuvem com regras de autorização RBAC.
 * - Amplify Functions (Lambda):
 *   1. admin-actions: Operações administrativas no Cognito com IAM granular.
 *   2. gemini-service: IA Google Gemini com segredo seguro via AWS Secrets Manager.
 */
export const backend = defineBackend({
  auth,
  data,
  adminActions,
  geminiService,
});

// Configuração de Permissões IAM Granulares para a função administrativa 'adminActions'
const userPool = backend.auth.resources.userPool;
const adminLambda = backend.adminActions.resources.lambda as import('aws-cdk-lib/aws-lambda').Function;

// Injeta a variável de ambiente com o ID real do User Pool na função Lambda administrativa
if (adminLambda && typeof adminLambda.addEnvironment === 'function') {
  adminLambda.addEnvironment('AMPLIFY_AUTH_USERPOOL_ID', userPool.userPoolId);
}

// Adiciona política IAM de privilégio mínimo no Amazon Cognito
backend.adminActions.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminCreateUser',
      'cognito-idp:AdminEnableUser',
      'cognito-idp:AdminDisableUser',
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:AdminRemoveUserFromGroup',
      'cognito-idp:AdminResetUserPassword',
      'cognito-idp:AdminDeleteUser',
      'cognito-idp:AdminListGroupsForUser',
    ],
    resources: [userPool.userPoolArn],
  })
);
