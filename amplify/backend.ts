import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';

/**
 * Backend do Terminal de Apoio ao Tratamento Farmacêutico (AWS Amplify Gen 2)
 */
export const backend = defineBackend({
  auth,
});
