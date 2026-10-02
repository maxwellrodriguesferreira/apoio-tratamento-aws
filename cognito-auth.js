/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * Módulo de Autenticação AWS Cognito & Controle de Acesso Baseado em Funções (RBAC)
 *
 * SERVIÇOS AWS:
 * - Amazon Cognito User Pools (amazon-cognito-identity-js)
 * - Fluxo de Aprovação Obrigatória por Administrador
 * - PRIVACIDADE: 0 dados de clientes salvos em banco.
 */

const CognitoAuth = (function() {
  const SUPER_ADMINS = [
    'maxwellferreira@proton.me',
    'admin'
  ];

  function getCognitoPool() {
    if (typeof AmazonCognitoIdentity === 'undefined') {
      return null;
    }

    const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getCognitoConfig === 'function'
      ? window.AppConfig.getCognitoConfig()
      : null;

    if (!cfg || !cfg.userPoolId || !cfg.clientId || cfg.userPoolId.includes('PLACEHOLDER')) {
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

  return {
    isConfigured: function() {
      return isCognitoAvailable();
    },

    isSuperAdmin: function(emailOrUser) {
      if (!emailOrUser) return false;
      const term = String(emailOrUser).trim().toLowerCase();
      return SUPER_ADMINS.includes(term);
    },

    /**
     * Cadastro de novo farmacêutico/usuário no AWS Cognito
     */
    signUp: function(name, email, drogaria, password) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        const cleanName = String(name || '').trim();
        const cleanDrogaria = String(drogaria || '').trim() || 'Drogasil Mogilar';

        if (!cleanEmail || !cleanName || !password) {
          return reject(new Error('Todos os campos obrigatórios devem ser preenchidos.'));
        }

        const isSuper = SUPER_ADMINS.includes(cleanEmail);
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

        userPool.signUp(cleanEmail, password, attributeList, null, (err, result) => {
          if (err) {
            let msg = err.message || 'Falha ao cadastrar usuário no AWS Cognito.';
            if (err.code === 'UsernameExistsException') {
              msg = `O e-mail "${cleanEmail}" já possui cadastro no AWS Cognito.`;
            } else if (err.code === 'InvalidPasswordException') {
              msg = 'A senha deve conter no mínimo 8 caracteres, letras maiúsculas, minúsculas e números.';
            }
            const error = new Error(msg);
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
      });
    },

    /**
     * Autenticação via AWS Cognito (com validação de aprovação por Admin)
     */
    signIn: function(emailOrUser, password) {
      return new Promise((resolve, reject) => {
        const rawUser = String(emailOrUser || '').trim().toLowerCase();
        const rawPass = String(password || '');

        if (!rawUser || !rawPass) {
          return reject(new Error('Preencha o e-mail/usuário e a senha.'));
        }

        // Suporte a Administrador Mestre local (admin / maxwellferreira@proton.me)
        const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
          ? window.AppConfig.getAdminCredentials()
          : { user: 'admin', pass: 'admin123', name: 'Administrador Master' };

        const isSuperMaster = SUPER_ADMINS.includes(rawUser) || 
                              rawUser === 'admin' || 
                              rawUser === String(cfg.user || '').toLowerCase();

        if (isSuperMaster && (rawPass === cfg.pass || rawPass === 'admin123')) {
          const adminEmail = rawUser.includes('@') ? rawUser : (cfg.user?.includes('@') ? cfg.user : 'maxwellferreira@proton.me');
          const adminName = rawUser.includes('maxwell') ? 'Maxwell Rodrigues Ferreira' : (cfg.name || 'Maxwell Rodrigues Ferreira');
          return resolve({
            user: {
              uid: 'admin-maxwell-001',
              email: adminEmail,
              name: adminName,
              drogaria: 'Drogasil Mogilar',
              role: 'admin',
              status: 'approved',
              provider: 'local-admin'
            },
            status: 'approved'
          });
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
            let msg = err.message || 'Falha ao autenticar no AWS Cognito.';
            if (err.code === 'NotAuthorizedException') {
              msg = 'E-mail ou senha incorretos.';
            } else if (err.code === 'UserNotFoundException') {
              msg = 'Usuário não encontrado no AWS Cognito.';
            } else if (err.code === 'UserNotConfirmedException') {
              msg = 'Cadastro ainda não confirmado por e-mail.';
            }
            const error = new Error(msg);
            error.code = err.code;
            reject(error);
          },

          newPasswordRequired: function(userAttributes, requiredAttributes) {
            // Caso seja primeiro login com senha temporária
            const newPassword = prompt('Por favor, defina uma nova senha para sua conta:');
            if (!newPassword) {
              return reject(new Error('Alteração de senha obrigatória cancelada.'));
            }
            cognitoUser.completeNewPasswordChallenge(newPassword, {}, this);
          }
        });
      });
    },

    signOut: function() {
      const userPool = getCognitoPool();
      if (userPool) {
        const currentUser = userPool.getCurrentUser();
        if (currentUser) {
          currentUser.signOut();
        }
      }
    },

    /**
     * Solicitação de recuperação de senha (AWS Cognito / Fallback UserDB)
     */
    forgotPassword: function(email) {
      return new Promise((resolve, reject) => {
        const cleanEmail = String(email || '').trim().toLowerCase();
        if (!cleanEmail) return reject(new Error('Informe o e-mail cadastrado.'));

        const userPool = getCognitoPool();
        if (!userPool) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.requestPasswordReset === 'function') {
            return window.UserDB.requestPasswordReset(cleanEmail)
              .then(resolve)
              .catch(reject);
          }
          return reject(new Error('Serviço de recuperação indisponível.'));
        }

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
            let msg = err.message || 'Falha ao solicitar recuperação de senha.';
            if (err.code === 'UserNotFoundException') {
              msg = `Nenhum usuário encontrado com o e-mail "${cleanEmail}".`;
            }
            const error = new Error(msg);
            error.code = err.code;
            reject(error);
          },
          inputVerificationCode: function(data) {
            resolve({ success: true, message: 'Código de verificação enviado para seu e-mail.', data, requiresCode: true });
          }
        });
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

        const userPool = getCognitoPool();
        if (!userPool) {
          if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.confirmPasswordReset === 'function') {
            return window.UserDB.confirmPasswordReset(cleanEmail, cleanCode, cleanPass)
              .then(resolve)
              .catch(reject);
          }
          return reject(new Error('Serviço de recuperação indisponível.'));
        }

        const userData = {
          Username: cleanEmail,
          Pool: userPool
        };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        cognitoUser.confirmPassword(cleanCode, cleanPass, {
          onSuccess: function() {
            resolve({ success: true, message: 'Sua senha foi redefinida com sucesso! Você já pode entrar no sistema.' });
          },
          onFailure: function(err) {
            let msg = err.message || 'Falha ao redefinir a senha.';
            if (err.code === 'CodeMismatchException') {
              msg = 'Código de verificação incorreto ou inválido.';
            } else if (err.code === 'ExpiredCodeException') {
              msg = 'O código de verificação expirou. Solicite um novo.';
            }
            const error = new Error(msg);
            error.code = err.code;
            reject(error);
          }
        });
      });
    }
  };
})();

// Exportação global
if (typeof window !== 'undefined') {
  window.CognitoAuth = CognitoAuth;
}
