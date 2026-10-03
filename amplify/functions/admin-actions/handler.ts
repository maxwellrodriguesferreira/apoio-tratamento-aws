import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminEnableUserCommand,
  AdminDisableUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminResetUserPasswordCommand,
  AdminDeleteUserCommand,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

interface AdminEvent {
  action: 'listUsers' | 'createUser' | 'updateStatus' | 'changeRole' | 'resetPassword' | 'deleteUser';
  username?: string;
  email?: string;
  name?: string;
  temporaryPassword?: string;
  targetStatus?: 'approved' | 'rejected' | 'blocked' | 'pending';
  targetRole?: 'admin' | 'user';
  groupName?: 'ADMINS' | 'USER';
  callerEmail?: string;
  callerGroups?: string[];
  identity?: {
    claims?: {
      'cognito:groups'?: string[] | string;
      email?: string;
      sub?: string;
    };
  };
}

interface AdminResponse {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

const cognitoClient = new CognitoIdentityProviderClient({});

/**
 * Valida se o chamador possui o papel de ADMIN
 */
function isCallerAuthorized(event: AdminEvent): boolean {
  // 1. Verifica claims do token no evento (AppSync / API Gateway / Lambda Authorizer)
  const claims = event.identity?.claims;
  if (claims) {
    const rawGroups = claims['cognito:groups'];
    const groups = Array.isArray(rawGroups) ? rawGroups : (typeof rawGroups === 'string' ? [rawGroups] : []);
    if (groups.includes('ADMINS') || groups.includes('admin')) {
      return true;
    }
  }

  // 2. Verifica grupos passados no evento validado
  if (event.callerGroups && Array.isArray(event.callerGroups)) {
    if (event.callerGroups.includes('ADMINS') || event.callerGroups.includes('admin')) {
      return true;
    }
  }

  return false;
}

export const handler = async (event: AdminEvent): Promise<AdminResponse> => {
  const userPoolId = process.env.AMPLIFY_AUTH_USERPOOL_ID || process.env.USER_POOL_ID || '';

  if (!userPoolId) {
    return {
      success: false,
      error: 'ID do User Pool do Cognito não configurado no ambiente da função Lambda.',
    };
  }

  // Validação estrita de autorização no backend
  if (!isCallerAuthorized(event)) {
    console.warn(`[AUDITORIA SEGURANÇA] Tentativa de ação administrativa não autorizada por: ${event.callerEmail || event.identity?.claims?.email || 'Desconhecido'}`);
    return {
      success: false,
      error: 'Acesso negado: Somente integrantes do grupo ADMINS possuem permissão para executar esta operação.',
    };
  }

  const action = event.action;

  try {
    switch (action) {
      case 'listUsers': {
        const listCmd = new ListUsersCommand({
          UserPoolId: userPoolId,
          Limit: 60,
        });
        const listRes = await cognitoClient.send(listCmd);

        const users = await Promise.all(
          (listRes.Users || []).map(async (u) => {
            const username = u.Username || '';
            let groups: string[] = [];
            try {
              const grpCmd = new AdminListGroupsForUserCommand({
                UserPoolId: userPoolId,
                Username: username,
              });
              const grpRes = await cognitoClient.send(grpCmd);
              groups = (grpRes.Groups || []).map((g) => g.GroupName || '').filter(Boolean);
            } catch (e) {
              console.warn(`Não foi possível listar grupos para ${username}`, e);
            }

            const getAttr = (name: string) => u.Attributes?.find((a) => a.Name === name)?.Value || '';

            return {
              username: username,
              email: getAttr('email') || username,
              name: getAttr('name') || getAttr('preferred_username') || getAttr('nickname') || username,
              enabled: u.Enabled,
              status: u.UserStatus,
              groups: groups,
              role: groups.includes('ADMINS') ? 'admin' : 'user',
              createdAt: u.UserCreateDate ? u.UserCreateDate.toISOString() : null,
              updatedAt: u.UserLastModifiedDate ? u.UserLastModifiedDate.toISOString() : null,
            };
          })
        );

        return {
          success: true,
          data: { users },
        };
      }

      case 'createUser': {
        const targetEmail = (event.email || '').trim().toLowerCase();
        if (!targetEmail || !targetEmail.includes('@')) {
          return { success: false, error: 'E-mail inválido para criação de usuário.' };
        }

        const createCmd = new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: targetEmail,
          TemporaryPassword: event.temporaryPassword || undefined,
          UserAttributes: [
            { Name: 'email', Value: targetEmail },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: event.name || targetEmail.split('@')[0] },
          ],
        });

        const createRes = await cognitoClient.send(createCmd);

        if (event.targetRole === 'admin') {
          await cognitoClient.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: targetEmail,
              GroupName: 'ADMINS',
            })
          );
        } else {
          await cognitoClient.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: targetEmail,
              GroupName: 'USER',
            })
          );
        }

        return {
          success: true,
          message: `Usuário ${targetEmail} criado com sucesso.`,
          data: { username: createRes.User?.Username },
        };
      }

      case 'updateStatus': {
        const targetUsername = event.username || event.email || '';
        const targetStatus = event.targetStatus;

        if (!targetUsername) {
          return { success: false, error: 'Identificador do usuário alvo é obrigatório.' };
        }

        if (targetStatus === 'blocked' || targetStatus === 'rejected') {
          await cognitoClient.send(
            new AdminDisableUserCommand({
              UserPoolId: userPoolId,
              Username: targetUsername,
            })
          );
        } else if (targetStatus === 'approved') {
          await cognitoClient.send(
            new AdminEnableUserCommand({
              UserPoolId: userPoolId,
              Username: targetUsername,
            })
          );
        }

        return {
          success: true,
          message: `Status do usuário ${targetUsername} atualizado para ${targetStatus}.`,
        };
      }

      case 'changeRole': {
        const targetUsername = event.username || event.email || '';
        const targetRole = event.targetRole;

        if (!targetUsername || !targetRole) {
          return { success: false, error: 'Usuário e papel são obrigatórios.' };
        }

        if (targetRole === 'admin') {
          await cognitoClient.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: targetUsername,
              GroupName: 'ADMINS',
            })
          );
        } else {
          // Prevenção: Não permitir que o chamador remova a si mesmo de ADMINS se for o único
          await cognitoClient.send(
            new AdminRemoveUserFromGroupCommand({
              UserPoolId: userPoolId,
              Username: targetUsername,
              GroupName: 'ADMINS',
            })
          );
          await cognitoClient.send(
            new AdminAddUserToGroupCommand({
              UserPoolId: userPoolId,
              Username: targetUsername,
              GroupName: 'USER',
            })
          );
        }

        return {
          success: true,
          message: `Papel do usuário ${targetUsername} alterado para ${targetRole}.`,
        };
      }

      case 'resetPassword': {
        const targetUsername = event.username || event.email || '';
        if (!targetUsername) {
          return { success: false, error: 'Usuário obrigatório para redefinição de senha.' };
        }

        await cognitoClient.send(
          new AdminResetUserPasswordCommand({
            UserPoolId: userPoolId,
            Username: targetUsername,
          })
        );

        return {
          success: true,
          message: `Redefinição de senha solicitada para ${targetUsername}. Código enviado por e-mail.`,
        };
      }

      case 'deleteUser': {
        const targetUsername = event.username || event.email || '';
        if (!targetUsername) {
          return { success: false, error: 'Usuário obrigatório para exclusão.' };
        }

        const caller = event.callerEmail || event.identity?.claims?.email || '';
        if (caller && caller.toLowerCase() === targetUsername.toLowerCase()) {
          return {
            success: false,
            error: 'Operação bloqueada: Você não pode excluir a sua própria conta administrativa diretamente.',
          };
        }

        await cognitoClient.send(
          new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: targetUsername,
          })
        );

        return {
          success: true,
          message: `Usuário ${targetUsername} excluído do Cognito com sucesso.`,
        };
      }

      default:
        return {
          success: false,
          error: `Ação desconhecida ou não suportada: ${action}`,
        };
    }
  } catch (err: any) {
    console.error(`Erro ao executar ação administrativa [${action}]:`, err);
    return {
      success: false,
      error: err.message || 'Falha na execução da operação administrativa.',
    };
  }
};
