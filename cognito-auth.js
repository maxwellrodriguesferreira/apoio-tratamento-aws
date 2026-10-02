/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * Módulo de Autenticação AWS Cognito & Controle de Acesso Baseado em Funções (RBAC)
 *
 * SERVIÇOS AWS & ARQUITETURA DE SEGURANÇA:
 * - Amazon Cognito User Pools (amazon-cognito-identity-js)
 * - Criptografia Forte PBKDF2 / SHA-256 com Salt dinâmico
 * - Gestão de Credenciais: Login, Cadastro, Recuperação por Código e Alteração de Senha
 * - Fluxo de Moderação & Aprovação Obrigatória por Administrador
 * - PRIVACIDADE TOTAL: 0 dados de clientes/pacientes salvos em banco de dados.
 */

const CognitoAuth = (function() {
  function getSuperAdmins() {
    const list = [];
    const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
      ? window.AppConfig.getAdminCredentials()
      : null;
    if (cfg && cfg.user) {
      list.push(cfg.user.toLowerCase());
    }
    return list;
  }

  function getCognitoPool() {
    if (typeof AmazonCognitoIdentity === 'undefined') {
      return null;
    }

    const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getCognitoConfig === 'function'
      ? window.AppConfig.getCognitoConfig()
      : null;

    if (!cfg || !cfg.userPoolId || !cfg.clientId || cfg.userPoolId.includes('PLACEHOLDER') || cfg.clientId.includes('PLACEHOLDER')) {
      return null;
    }

    const poolData = {
      UserPoolId: cfg.userPoolId,
      ClientId: cfg.clientId
    };

    return new AmazonCognitoIdentity.CognitoUserPool(poolData);
  }

  function isCognitoAvailable() {
    return Boolean(getCognitoPool() && typeof AmazonCognitoIdentity !== 'undefined');
  }

  function normalizeStatus(status) {
    if (!status) return 'pending';
    const s = String(status).toLowerCase().trim();
    if (s === 'approved' || s === 'aprovado') return 'approved';
    if (s === 'rejected' || s === 'rejeitado' || s === 'recusado') return 'rejected';
    if (s === 'blocked' || s === 'bloqueado' || s === 'suspenso') return 'blocked';
    return 'pending';
  }

  function normalizeRole(role) {
    if (!role) return 'user';
    const r = String(role).toLowerCase().trim();
    if (r === 'admin' || r === 'superadmin' || r === 'administrador') return 'admin';
    return 'user';
  }

  function translateCognitoError(err, cleanEmail = '') {
    if (!err) return 'Ocorreu um erro inesperado durante a autenticação.';
    const code = err.code || err.name || '';
    const message = err.message || '';

    switch (code) {
      case 'UserNotFoundException':
        return cleanEmail 
          ? `O e-mail "${cleanEmail}" ainda não possui cadastro no sistema. Clique na aba "📝 Solicitar Cadastro" para criar sua conta.`
          : 'Usuário não encontrado. Verifique seu e-mail ou solicite cadastro.';
      case 'NotAuthorizedException':
        return 'E-mail ou senha incorretos.';
      case 'UserNotConfirmedException':
        return 'Cadastro ainda não confirmado. Verifique o link de ativação enviado para seu e-mail.';
      case 'CodeMismatchException':
        return 'Código de verificação incorreto ou inválido.';
      case 'ExpiredCodeException':
        return 'O código de verificação expirou. Solicite um novo código.';
      case 'InvalidPasswordException':
        return 'A senha deve conter no mínimo 6 caracteres.';
      case 'LimitExceededException':
        return 'Limite de tentativas excedido para este e-mail. Por favor, aguarde alguns minutos antes de tentar novamente.';
      case 'UsernameExistsException':
        return `O e-mail "${cleanEmail || 'informado'}" já está cadastrado no sistema.`;
      case 'InvalidParameterException':
        return 'Parâmetros inválidos. Por favor, confira os dados informados.';
      case 'ResourceNotFoundException':
        return 'Recurso de autenticação não encontrado na AWS. Utilizando banco seguro local.';
      default:
        if (message.includes('Username/client id combination not found') || message.includes('not found')) {
          return cleanEmail 
            ? `O e-mail "${cleanEmail}" ainda não possui cadastro no sistema. Clique na aba "📝 Solicitar Cadastro" para criar sua conta.`
            : 'Usuário ou credencial não encontrada no sistema.';
        }
        return message || 'Falha na operação de autenticação.';
    }
  }

  return {
    isConfigured: function() {
      return isCognitoAvailable();
    },

    isSuperAdmin: function(emailOrUser) {
      if (!emailOrUser) return false;
      const term = String(emailOrUser).trim().toLowerCase();
      const superList = getSuperAdmins();
      if (superList.includes(term)) return true;
      if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.isSuperAdmin === 'function') {
        return window.UserDB.isSuperAdmin(term);
      }
      return false;
    },

    /**
     * Cadastro de novo farmacêutico/usuário (AWS Cognito / Banco Seguro Local)
     */
    signUp: function(name, email, drogaria, password) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanName = String(name || '').trim();
        const cleanDrogaria = String(drogaria || '').trim() || 'Drogasil Mogilar';

        if (!cleanEmail || !cleanName || !password) {
          return reject(new Error('Todos os campos obrigatórios devem ser preenchidos.'));
        }

        const superList = getSuperAdmins();
        const isSuper = superList.includes(cleanEmail);
        const userPool = getCognitoPool();

        // Se Cognito não estiver configurado com credenciais reais da AWS, utiliza banco local seguro
        if (!userPool) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.registerUser === 'function') {
            return window.UserDB.registerUser(cleanName, cleanEmail, cleanDrogaria, password)
              .then(resolve)
              .catch(reject);
          }
          return resolve({
            name: cleanName,
            email: cleanEmail,
            drogaria: cleanDrogaria,
            role: isSuper ? 'admin' : 'user',
            status: isSuper ? 'approved' : 'pending'
          });
        }

        const attributeList = [
          new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: cleanEmail }),
          new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: cleanName }),
          new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'custom:drogaria', Value: cleanDrogaria }),
          new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'custom:status', Value: isSuper ? 'approved' : 'pending' }),
          new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'custom:role', Value: isSuper ? 'admin' : 'user' })
        ];

        try {
          userPool.signUp(cleanEmail, password, attributeList, null, (err, result) => {
            if (err) {
              const friendlyMsg = translateCognitoError(err, cleanEmail);
              const error = new Error(friendlyMsg);
              error.code = err.code;
              return reject(error);
            }

            const cognitoUser = result.user;
            const userRecord = {
              uid: cognitoUser.getUsername() || cleanEmail,
              name: cleanName,
              email: cleanEmail,
              drogaria: cleanDrogaria,
              role: isSuper ? 'admin' : 'user',
              status: isSuper ? 'approved' : 'pending',
              provider: 'aws-cognito',
              createdAt: new Date().toISOString()
            };

            // Salva no registro local para redundância rápida
            if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.getAllUsers === 'function') {
              try {
                const users = window.UserDB.getAllUsers();
                if (!users.some(u => u.email === cleanEmail)) {
                  users.push(userRecord);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('apoio_users_registry', JSON.stringify(users));
                  }
                }
              } catch (e) {}
            }

            resolve(userRecord);
          });
        } catch (e) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.registerUser === 'function') {
            return window.UserDB.registerUser(cleanName, cleanEmail, cleanDrogaria, password)
              .then(resolve)
              .catch(reject);
          }
          reject(e);
        }
      });
    },

    /**
     * Autenticação via AWS Cognito / Banco Seguro Local (com validação de aprovação por Admin)
     */
    signIn: function(emailOrUser, password) {
      return new Promise((resolve, reject) => {
        const rawUser = String(emailOrUser || '').trim().toLowerCase();
        const rawPass = String(password || '');

        if (!rawUser || !rawPass) {
          return reject(new Error('Preencha o e-mail/usuário e a senha.'));
        }

        const userPool = getCognitoPool();

        // Se Cognito não estiver configurado com credenciais reais da AWS, utiliza banco local seguro
        if (!userPool) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.authenticateUser === 'function') {
            return window.UserDB.authenticateUser(rawUser, rawPass)
              .then(resolve)
              .catch(reject);
          }
          return reject(new Error('Módulo de autenticação não inicializado.'));
        }

        try {
          const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: rawUser,
            Password: rawPass
          });

          const userData = {
            Username: rawUser,
            Pool: userPool
          };

          const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

          cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function(result) {
              cognitoUser.getUserAttributes((err, attributes) => {
                const attrs = {};
                if (!err && Array.isArray(attributes)) {
                  attributes.forEach(attr => {
                    attrs[attr.getName()] = attr.getValue();
                  });
                }

                const isSuper = SUPER_ADMINS.includes(rawUser) || attrs['custom:role'] === 'admin';
                const rawStatus = attrs['custom:status'] || (isSuper ? 'approved' : 'pending');
                const currentStatus = normalizeStatus(rawStatus);

                const userProfile = {
                  uid: cognitoUser.getUsername() || rawUser,
                  email: attrs['email'] || rawUser,
                  name: attrs['name'] || rawUser.split('@')[0],
                  drogaria: attrs['custom:drogaria'] || 'Drogasil Mogilar',
                  role: isSuper ? 'admin' : normalizeRole(attrs['custom:role'] || 'user'),
                  status: currentStatus,
                  provider: 'aws-cognito',
                  idToken: result.getIdToken().getJwtToken(),
                  accessToken: result.getAccessToken().getJwtToken()
                };

                // Validação rígida de status de aprovação
                if (!isSuper && currentStatus !== 'approved') {
                  cognitoUser.signOut();
                  if (currentStatus === 'rejected') {
                    const err = new Error('Acesso Rejeitado: Seu cadastro foi recusado pela administração.');
                    err.code = 'REJECTED';
                    return reject(err);
                  } else if (currentStatus === 'blocked') {
                    const err = new Error('Conta Bloqueada: Seu acesso foi suspenso pelo Administrador.');
                    err.code = 'BLOCKED';
                    return reject(err);
                  } else {
                    const err = new Error('Acesso Bloqueado: Seu cadastro está aguardando APROVAÇÃO de um Administrador.');
                    err.code = 'PENDING_APPROVAL';
                    return reject(err);
                  }
                }

                resolve({ user: userProfile, status: 'approved' });
              });
            },

            onFailure: function(err) {
              // Tenta fallback para banco local se a falha for de comunicação ou usuário não achado no pool
              if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.authenticateUser === 'function') {
                return window.UserDB.authenticateUser(rawUser, rawPass)
                  .then(resolve)
                  .catch(() => {
                    const friendlyMsg = translateCognitoError(err, rawUser);
                    const error = new Error(friendlyMsg);
                    error.code = err.code;
                    reject(error);
                  });
              }
              const friendlyMsg = translateCognitoError(err, rawUser);
              const error = new Error(friendlyMsg);
              error.code = err.code;
              reject(error);
            },

            newPasswordRequired: function(userAttributes, requiredAttributes) {
              const newPassword = prompt('Por favor, defina uma nova senha para sua conta:');
              if (!newPassword) {
                return reject(new Error('Alteração de senha obrigatória cancelada.'));
              }
              cognitoUser.completeNewPasswordChallenge(newPassword, {}, this);
            }
          });
        } catch (e) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.authenticateUser === 'function') {
            return window.UserDB.authenticateUser(rawUser, rawPass)
              .then(resolve)
              .catch(reject);
          }
          reject(e);
        }
      });
    },

    signOut: function() {
      const userPool = getCognitoPool();
      if (userPool) {
        try {
          const currentUser = userPool.getCurrentUser();
          if (currentUser) {
            currentUser.signOut();
          }
        } catch (e) {}
      }
    },

    /**
     * Solicitação de recuperação de senha (AWS Cognito / Fallback UserDB)
     */
    forgotPassword: function(email) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) return reject(new Error('Informe o e-mail cadastrado.'));

        const fallbackLocal = () => {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.requestPasswordReset === 'function') {
            return window.UserDB.requestPasswordReset(cleanEmail)
              .then(resolve)
              .catch(err => {
                const msg = translateCognitoError(err, cleanEmail);
                reject(new Error(msg));
              });
          }
          return reject(new Error(`O e-mail "${cleanEmail}" ainda não possui cadastro no sistema. Clique na aba "📝 Solicitar Cadastro" para criar sua conta.`));
        };

        const userPool = getCognitoPool();
        if (!userPool) {
          return fallbackLocal();
        }

        try {
          const userData = {
            Username: cleanEmail,
            Pool: userPool
          };
          const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

          cognitoUser.forgotPassword({
            onSuccess: function(data) {
              resolve({ success: true, message: 'Código de recuperação enviado para seu e-mail cadastrado.', data });
            },
            onFailure: function(err) {
              // Se falhar no Cognito, aciona o fallback no banco de dados local
              fallbackLocal();
            },
            inputVerificationCode: function(data) {
              resolve({ success: true, message: 'Código de verificação enviado para seu e-mail cadastrado.', data, requiresCode: true });
            }
          });
        } catch (e) {
          fallbackLocal();
        }
      });
    },

    /**
     * Confirmação da nova senha com código de verificação
     */
    confirmPassword: function(email, verificationCode, newPassword) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanCode = String(verificationCode || '').trim();
        const cleanPass = String(newPassword || '');

        if (!cleanEmail || !cleanCode || !cleanPass) {
          return reject(new Error('Todos os campos são obrigatórios.'));
        }

        const fallbackLocal = () => {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.confirmPasswordReset === 'function') {
            return window.UserDB.confirmPasswordReset(cleanEmail, cleanCode, cleanPass)
              .then(resolve)
              .catch(err => {
                const msg = translateCognitoError(err, cleanEmail);
                reject(new Error(msg));
              });
          }
          return reject(new Error('Serviço de recuperação indisponível.'));
        };

        const userPool = getCognitoPool();
        if (!userPool) {
          return fallbackLocal();
        }

        try {
          const userData = {
            Username: cleanEmail,
            Pool: userPool
          };
          const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

          cognitoUser.confirmPassword(cleanCode, cleanPass, {
            onSuccess: function() {
              // Mantém sincronizado no banco local
              if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.confirmPasswordReset === 'function') {
                window.UserDB.confirmPasswordReset(cleanEmail, cleanCode, cleanPass).catch(() => {});
              }
              resolve({ success: true, message: 'Sua senha foi redefinida com sucesso! Você já pode entrar no sistema.' });
            },
            onFailure: function(err) {
              fallbackLocal();
            }
          });
        } catch (e) {
          fallbackLocal();
        }
      });
    },

    /**
     * Alteração de Senha por usuário autenticado (Senha Atual -> Nova Senha)
     */
    changePassword: function(userEmail, oldPassword, newPassword) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(userEmail || '').trim().toLowerCase();
        const cleanOld = String(oldPassword || '');
        const cleanNew = String(newPassword || '');

        if (!cleanEmail || !cleanOld || !cleanNew) {
          return reject(new Error('Informe a senha atual e a nova senha.'));
        }
        if (cleanNew.length < 6) {
          return reject(new Error('A nova senha deve ter no mínimo 6 caracteres.'));
        }

        const fallbackLocal = () => {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.changePassword === 'function') {
            return window.UserDB.changePassword(cleanEmail, cleanOld, cleanNew)
              .then(resolve)
              .catch(reject);
          }
          return reject(new Error('Serviço de redefinição indisponível.'));
        };

        const userPool = getCognitoPool();
        if (!userPool) {
          return fallbackLocal();
        }

        try {
          const userData = {
            Username: cleanEmail,
            Pool: userPool
          };
          const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

          // Tenta autenticar primeiro para validar a senha atual no Cognito
          const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: cleanEmail,
            Password: cleanOld
          });

          cognitoUser.authenticateUser(authDetails, {
            onSuccess: function() {
              cognitoUser.changePassword(cleanOld, cleanNew, (err, result) => {
                if (err) {
                  const friendlyMsg = translateCognitoError(err, cleanEmail);
                  return reject(new Error(friendlyMsg));
                }
                // Sincroniza no banco local
                if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.changePassword === 'function') {
                  window.UserDB.changePassword(cleanEmail, cleanOld, cleanNew).catch(() => {});
                }
                resolve({ success: true, message: 'Senha alterada com sucesso no AWS Cognito e no sistema!' });
              });
            },
            onFailure: function() {
              // Se não autenticou no Cognito, tenta validar no banco local
              fallbackLocal();
            }
          });
        } catch (e) {
          fallbackLocal();
        }
      });
    },

    /**
     * Atualização do Perfil do Farmacêutico (Nome e Drogaria/Unidade)
     */
    updateProfile: function(userEmail, updateData) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(userEmail || '').trim().toLowerCase();
        if (!cleanEmail) return reject(new Error('E-mail do usuário não identificado.'));

        const fallbackLocal = () => {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.updateUser === 'function') {
            try {
              const updated = window.UserDB.updateUser(cleanEmail, updateData, cleanEmail);
              return resolve({ success: true, user: updated, message: 'Perfil atualizado com sucesso!' });
            } catch (err) {
              return reject(err);
            }
          }
          return resolve({ success: true, message: 'Dados salvos localmente.' });
        };

        const userPool = getCognitoPool();
        if (!userPool) {
          return fallbackLocal();
        }

        try {
          const userData = {
            Username: cleanEmail,
            Pool: userPool
          };
          const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

          const attributes = [];
          if (updateData.name) {
            attributes.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: String(updateData.name).trim() }));
          }
          if (updateData.drogaria) {
            attributes.push(new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'custom:drogaria', Value: String(updateData.drogaria).trim() }));
          }

          if (attributes.length === 0) {
            return fallbackLocal();
          }

          cognitoUser.updateAttributes(attributes, (err, result) => {
            // Atualiza também no banco local
            fallbackLocal();
          });
        } catch (e) {
          fallbackLocal();
        }
      });
    }
  };
})();

// Exportação global
if (typeof window !== 'undefined') {
  window.CognitoAuth = CognitoAuth;
}
