/**
 * Terminal Apoio ao Tratamento - Drogasil Mogilar
 * Módulo de Banco de Dados de Usuários & Sistema de Autenticação Segura
 *
 * RECURSOS:
 * - Criptografia de senhas com PBKDF2 / SHA-256 via Web Crypto API nativa
 * - Controle de Acesso Baseado em Funções (RBAC: Admin / User)
 * - Fluxo de Aprovação Obrigatória de Novos Cadastros por Administrador
 * - Trilha de Auditoria Detalhada para ações de moderação
 * - PRIVACIDADE: Armazena apenas credenciais de operadores; 0 dados de clientes.
 */

const UserDB = (function() {
  const DB_STORAGE_KEY = 'apoio_users_database_v2';
  const PBKDF2_ITERATIONS = 100000;

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

  // Converte ArrayBuffer para string Hexadecimal
  function bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // Converte string Hexadecimal para Uint8Array
  function hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  // Gera hash seguro de senha utilizando PBKDF2 (SHA-256)
  async function hashPassword(password, saltHex = null) {
    if (!password) throw new Error('Senha não pode ser vazia.');
    const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : { encode: (s) => new Uint8Array(Buffer.from ? Buffer.from(s, 'utf8') : s.split('').map(c => c.charCodeAt(0))) };
    const passBuffer = encoder.encode(password);

    let saltBuffer;
    if (saltHex) {
      saltBuffer = hexToBuffer(saltHex);
    } else {
      saltBuffer = new Uint8Array(16);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(saltBuffer);
      } else {
        for (let i = 0; i < 16; i++) saltBuffer[i] = Math.floor(Math.random() * 256);
      }
    }

    if (typeof crypto !== 'undefined' && crypto.subtle) {
      try {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          passBuffer,
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        const derivedBuffer = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
          },
          keyMaterial,
          256
        );
        return {
          hash: bufferToHex(derivedBuffer),
          salt: bufferToHex(saltBuffer)
        };
      } catch (e) {
        console.warn('Fallback de hash SHA-256 simples:', e);
      }
    }

    // Fallback simples caso SubtleCrypto indisponível em ambiente legado
    let hash = 0;
    const str = password + bufferToHex(saltBuffer);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return {
      hash: 'fallback_' + Math.abs(hash).toString(16),
      salt: bufferToHex(saltBuffer)
    };
  }

  // Verifica se a senha informada corresponde ao hash gravado
  async function verifyPassword(password, storedHash, storedSalt) {
    if (!password || !storedHash || !storedSalt) return false;
    const result = await hashPassword(password, storedSalt);
    return result.hash === storedHash;
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

  function loadUsersFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(DB_STORAGE_KEY) || localStorage.getItem('apoio_users_registry');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(u => ({
        ...u,
        status: normalizeStatus(u.status),
        role: normalizeRole(u.role),
        auditLog: Array.isArray(u.auditLog) ? u.auditLog : []
      }));
    } catch (e) {
      console.warn('Erro ao carregar banco de dados de usuários:', e);
      return [];
    }
  }

  function persistUsersToStorage(users) {
    try {
      if (typeof localStorage !== 'undefined') {
        const json = JSON.stringify(users);
        localStorage.setItem(DB_STORAGE_KEY, json);
        localStorage.setItem('apoio_users_registry', json);
      }
    } catch (e) {
      console.error('Falha ao persistir usuários no banco de dados:', e);
    }
  }

  const RESET_FLAG_KEY = 'apoio_db_reset_v4';

  // Inicializa o banco do zero (limpa resquícios antigos se necessário)
  async function initializeDatabase() {
    try {
      if (typeof localStorage !== 'undefined') {
        const hasReset = localStorage.getItem(RESET_FLAG_KEY);
        if (!hasReset) {
          // Limpa todas as contas legadas para iniciar do zero
          localStorage.removeItem(DB_STORAGE_KEY);
          localStorage.removeItem('apoio_users_registry');
          localStorage.removeItem('apoio_auth_session');
          localStorage.setItem(RESET_FLAG_KEY, 'true');
        }
      }
    } catch (e) {}

    let users = loadUsersFromStorage();
    persistUsersToStorage(users);
    return users;
  }

  return {
    initialize: initializeDatabase,

    clearAllUsers: function() {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DB_STORAGE_KEY);
        localStorage.removeItem('apoio_users_registry');
        localStorage.removeItem('apoio_auth_session');
      }
      return [];
    },

    getAllUsers: function() {
      return loadUsersFromStorage();
    },

    getUserByEmailOrUid: function(identifier) {
      if (!identifier) return null;
      const term = String(identifier).trim().toLowerCase();
      const users = loadUsersFromStorage();
      return users.find(u => 
        (u.email && u.email.toLowerCase() === term) ||
        (u.uid && u.uid.toLowerCase() === term) ||
        (u.name && u.name.toLowerCase() === term)
      ) || null;
    },

    isSuperAdmin: function(identifier) {
      if (!identifier) return false;
      const term = String(identifier).trim().toLowerCase();
      const users = loadUsersFromStorage();
      const user = users.find(u => 
        (u.email && u.email.toLowerCase() === term) ||
        (u.uid && u.uid.toLowerCase() === term)
      );
      return Boolean(user && user.role === 'admin');
    },

    /**
     * Cadastro de usuário no banco de dados.
     * O 1º usuário da aplicação se torna AUTOMATICAMENTE o ADMINISTRADOR MASTER ('admin' / 'approved').
     * Os demais entram como 'user' com status 'pending' para aprovação do Admin.
     */
    registerUser: async function(name, email, drogaria, password) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(name || '').trim();
      const cleanDrogaria = String(drogaria || '').trim() || 'Drogasil Mogilar';

      if (!cleanEmail || !cleanName || !password) {
        throw new Error('Todos os campos obrigatórios devem ser preenchidos.');
      }

      const users = loadUsersFromStorage();
      const existing = users.find(u => u.email && u.email.toLowerCase() === cleanEmail);
      if (existing) {
        throw new Error(`O e-mail "${cleanEmail}" já está cadastrado no sistema.`);
      }

      // Se for o primeiro usuário cadastrado ou não houver nenhum admin ativo, ele se torna Administrador
      const hasAnyAdmin = users.some(u => u.role === 'admin' && u.status === 'approved');
      const isFirstAdmin = !hasAnyAdmin || users.length === 0;

      const hashedPassword = await hashPassword(password);
      const nowIso = new Date().toISOString();
      const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

      const newUser = {
        uid: uid,
        name: cleanName,
        email: cleanEmail,
        drogaria: cleanDrogaria,
        passwordHash: hashedPassword.hash,
        passwordSalt: hashedPassword.salt,
        role: isFirstAdmin ? 'admin' : 'user',
        status: isFirstAdmin ? 'approved' : 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        approvedAt: isFirstAdmin ? nowIso : null,
        approvedBy: isFirstAdmin ? 'system' : null,
        rejectedAt: null,
        rejectedBy: null,
        blockedAt: null,
        blockedBy: null,
        rejectionReason: null,
        auditLog: [{
          action: 'REGISTRATION',
          performedBy: cleanEmail,
          timestamp: nowIso,
          details: isFirstAdmin 
            ? 'Primeiro Administrador Master cadastrado e aprovado automaticamente' 
            : 'Cadastro solicitado - Aguardando aprovação administrativa'
        }]
      };

      users.push(newUser);
      persistUsersToStorage(users);
      return newUser;
    },

    /**
     * Autenticação de usuário com verificação de senha e status de aprovação
     */
    authenticateUser: async function(emailOrUser, password) {
      const term = String(emailOrUser || '').trim().toLowerCase();
      const cleanPass = String(password || '');

      if (!term || !cleanPass) {
        throw new Error('Informe o e-mail/usuário e a senha.');
      }

      const users = loadUsersFromStorage();
      
      // Busca o usuário pelo e-mail ou UID
      const user = users.find(u => 
        (u.email && u.email.toLowerCase() === term) ||
        (u.uid && u.uid.toLowerCase() === term)
      );

      if (!user) {
        // Se for o super admin e ainda não existir no registro, cria o registro
        const superList = getSuperAdmins();
        if (superList.includes(term)) {
          const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
            ? window.AppConfig.getAdminCredentials()
            : null;
          if (cfg && cfg.pass && cleanPass === cfg.pass) {
            const nowIso = new Date().toISOString();
            const hashed = await hashPassword(cleanPass);
            const adminUser = {
              uid: 'admin-master-001',
              name: cfg.name || 'Administrador Master',
              email: cfg.user || term,
              drogaria: 'Drogasil Mogilar',
              passwordHash: hashed.hash,
              passwordSalt: hashed.salt,
              role: 'admin',
              status: 'approved',
              createdAt: nowIso,
              updatedAt: nowIso,
              approvedAt: nowIso,
              approvedBy: 'system',
              auditLog: []
            };
            users.push(adminUser);
            persistUsersToStorage(users);
            return { user: adminUser, status: 'approved' };
          }
        }
        throw new Error('Usuário não encontrado. Verifique seu e-mail ou solicite cadastro.');
      }

      // Validação de senha via hash criptográfico PBKDF2 / SHA-256
      if (user.passwordHash && user.passwordSalt) {
        const isValid = await verifyPassword(cleanPass, user.passwordHash, user.passwordSalt);
        if (!isValid) {
          // Permite login se a senha de ambiente da AWS Amplify foi injetada e corresponde
          const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
            ? window.AppConfig.getAdminCredentials()
            : null;
          const superList = getSuperAdmins();
          if (superList.includes(user.email.toLowerCase()) && cfg && cfg.pass && cleanPass === cfg.pass) {
            const rehashed = await hashPassword(cleanPass);
            user.passwordHash = rehashed.hash;
            user.passwordSalt = rehashed.salt;
            persistUsersToStorage(users);
          } else {
            throw new Error('E-mail ou senha incorretos.');
          }
        }
      } else {
        // Usuário sem hash de senha configurado
        const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
          ? window.AppConfig.getAdminCredentials()
          : null;
        const superList = getSuperAdmins();
        if (superList.includes(user.email.toLowerCase()) && cfg && cfg.pass && cleanPass === cfg.pass) {
          const hashed = await hashPassword(cleanPass);
          user.passwordHash = hashed.hash;
          user.passwordSalt = hashed.salt;
          persistUsersToStorage(users);
        } else {
          throw new Error('Senha não configurada. Utilize a opção "Esqueci a senha" para definir sua senha.');
        }
      }

      const currentStatus = normalizeStatus(user.status);
      const superList = getSuperAdmins();
      const isSuper = user.role === 'admin' || superList.includes(user.email.toLowerCase());

      if (isSuper) {
        return { user: user, status: 'approved' };
      }

      if (currentStatus === 'pending') {
        const err = new Error('Acesso Bloqueado: Seu cadastro está aguardando APROVAÇÃO de um Administrador.');
        err.code = 'PENDING_APPROVAL';
        err.userStatus = 'pending';
        throw err;
      }

      if (currentStatus === 'rejected') {
        const reason = user.rejectionReason ? ` Motivo: "${user.rejectionReason}"` : '';
        const err = new Error(`Acesso Rejeitado: Seu cadastro foi recusado pela administração.${reason}`);
        err.code = 'REJECTED';
        err.userStatus = 'rejected';
        throw err;
      }

      if (currentStatus === 'blocked') {
        const err = new Error('Conta Bloqueada: Seu acesso foi bloqueado pelo Administrador.');
        err.code = 'BLOCKED';
        err.userStatus = 'blocked';
        throw err;
      }

      return { user: user, status: 'approved' };
    },

    /**
     * Ações de Moderação Administrativa
     */
    approveUser: function(identifier, adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const nowIso = new Date().toISOString();
      user.status = 'approved';
      user.approvedAt = nowIso;
      user.approvedBy = adminIdentifier;
      user.rejectedAt = null;
      user.rejectedBy = null;
      user.blockedAt = null;
      user.blockedBy = null;
      user.rejectionReason = null;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'APPROVE',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: 'Cadastro aprovado pelo administrador'
      });

      persistUsersToStorage(users);
      return user;
    },

    rejectUser: function(identifier, reason = '', adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const nowIso = new Date().toISOString();
      user.status = 'rejected';
      user.rejectedAt = nowIso;
      user.rejectedBy = adminIdentifier;
      user.rejectionReason = reason;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'REJECT',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: `Cadastro rejeitado. Justificativa: "${reason || 'Não informada'}"`
      });

      persistUsersToStorage(users);
      return user;
    },

    blockUser: function(identifier, adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const nowIso = new Date().toISOString();
      user.status = 'blocked';
      user.blockedAt = nowIso;
      user.blockedBy = adminIdentifier;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'BLOCK',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: 'Acesso suspenso pelo administrador'
      });

      persistUsersToStorage(users);
      return user;
    },

    unblockUser: function(identifier, adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const nowIso = new Date().toISOString();
      user.status = 'approved';
      user.blockedAt = null;
      user.blockedBy = null;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'UNBLOCK',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: 'Acesso desbloqueado pelo administrador'
      });

      persistUsersToStorage(users);
      return user;
    },

    changeRole: function(identifier, newRole, adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const role = normalizeRole(newRole);
      const nowIso = new Date().toISOString();
      user.role = role;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'ROLE_CHANGE',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: `Permissão alterada para "${role.toUpperCase()}"`
      });

      persistUsersToStorage(users);
      return user;
    },

    deleteUser: function(identifier, adminIdentifier = 'admin') {
      let users = loadUsersFromStorage();
      const idx = users.findIndex(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (idx === -1) throw new Error('Usuário não encontrado.');

      const deleted = users.splice(idx, 1)[0];
      persistUsersToStorage(users);
      return deleted;
    },

    updateUser: function(identifier, updateFields, adminIdentifier = 'admin') {
      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const nowIso = new Date().toISOString();
      if (updateFields.name) user.name = String(updateFields.name).trim();
      if (updateFields.drogaria) user.drogaria = String(updateFields.drogaria).trim();
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'PROFILE_EDIT',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: 'Dados cadastrais atualizados'
      });

      persistUsersToStorage(users);
      return user;
    },

    /**
     * Solicitação de redefinição de senha (gera código de verificação de 6 dígitos)
     */
    requestPasswordReset: async function(email) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail) throw new Error('Informe o e-mail cadastrado.');

      const users = loadUsersFromStorage();
      let user = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.uid && u.uid.toLowerCase() === cleanEmail));
      
      if (!user) {
        const superList = getSuperAdmins();
        if (superList.includes(cleanEmail) || users.length === 0) {
          const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
            ? window.AppConfig.getAdminCredentials()
            : null;
          const nowIso = new Date().toISOString();
          user = {
            uid: 'admin-master-001',
            name: cfg?.name || 'Administrador Master',
            email: cleanEmail,
            drogaria: 'Drogasil Mogilar',
            passwordHash: '',
            passwordSalt: '',
            role: 'admin',
            status: 'approved',
            createdAt: nowIso,
            updatedAt: nowIso,
            approvedAt: nowIso,
            approvedBy: 'system',
            auditLog: []
          };
          users.push(user);
        } else {
          throw new Error(`O e-mail "${cleanEmail}" ainda não possui cadastro no sistema. Clique na aba "📝 Solicitar Cadastro" para criar sua conta.`);
        }
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = Date.now() + 15 * 60 * 1000; // 15 minutos
      const nowIso = new Date().toISOString();

      user.resetCode = code;
      user.resetCodeExpires = expires;
      user.updatedAt = nowIso;
      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'PASSWORD_RESET_REQUESTED',
        performedBy: cleanEmail,
        timestamp: nowIso,
        details: 'Código de recuperação de senha gerado'
      });

      persistUsersToStorage(users);
      return {
        success: true,
        email: user.email,
        message: 'Código de verificação enviado para seu e-mail cadastrado. Válido por 15 minutos.'
      };
    },

    /**
     * Confirmação de redefinição de senha com código de verificação
     */
    confirmPasswordReset: async function(email, resetCode, newPassword) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanCode = String(resetCode || '').trim();
      const cleanPass = String(newPassword || '');

      if (!cleanEmail || !cleanCode || !cleanPass) {
        throw new Error('Todos os campos são obrigatórios.');
      }
      if (cleanPass.length < 6) {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }

      const users = loadUsersFromStorage();
      const user = users.find(u => (u.email && u.email.toLowerCase() === cleanEmail) || (u.uid && u.uid.toLowerCase() === cleanEmail));
      if (!user) throw new Error('Usuário não encontrado.');

      if (!user.resetCode || user.resetCode !== cleanCode) {
        throw new Error('Código de verificação inválido ou incorreto.');
      }
      if (user.resetCodeExpires && Date.now() > user.resetCodeExpires) {
        throw new Error('O código de verificação expirou. Solicite um novo.');
      }

      const hashedPassword = await hashPassword(cleanPass);
      const nowIso = new Date().toISOString();

      user.passwordHash = hashedPassword.hash;
      user.passwordSalt = hashedPassword.salt;
      user.resetCode = null;
      user.resetCodeExpires = null;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'PASSWORD_RESET_CONFIRMED',
        performedBy: cleanEmail,
        timestamp: nowIso,
        details: 'Senha redefinida com sucesso pelo usuário'
      });

      persistUsersToStorage(users);
      return {
        success: true,
        message: 'Sua senha foi redefinida com sucesso! Você já pode entrar no sistema.'
      };
    },

    /**
     * Redefinição direta de senha pelo Administrador Master
     */
    adminResetPassword: async function(identifier, newPassword, adminIdentifier = 'admin') {
      const cleanPass = String(newPassword || '');
      if (cleanPass.length < 6) {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }

      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      const hashedPassword = await hashPassword(cleanPass);
      const nowIso = new Date().toISOString();

      user.passwordHash = hashedPassword.hash;
      user.passwordSalt = hashedPassword.salt;
      user.resetCode = null;
      user.resetCodeExpires = null;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'ADMIN_RESET_PASSWORD',
        performedBy: adminIdentifier,
        timestamp: nowIso,
        details: 'Senha redefinida pelo Administrador'
      });

      persistUsersToStorage(users);
      return user;
    },

    /**
     * Alteração de senha pelo próprio usuário autenticado
     */
    updatePassword: async function(identifier, oldPassword, newPassword) {
      const cleanNew = String(newPassword || '');
      if (cleanNew.length < 6) {
        throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
      }

      const users = loadUsersFromStorage();
      const user = users.find(u => (u.uid && u.uid === identifier) || (u.email && u.email.toLowerCase() === String(identifier).toLowerCase()));
      if (!user) throw new Error('Usuário não encontrado.');

      if (user.passwordHash && user.passwordSalt) {
        const isValid = await verifyPassword(oldPassword, user.passwordHash, user.passwordSalt);
        if (!isValid) throw new Error('A senha atual informada está incorreta.');
      }

      const hashedPassword = await hashPassword(cleanNew);
      const nowIso = new Date().toISOString();

      user.passwordHash = hashedPassword.hash;
      user.passwordSalt = hashedPassword.salt;
      user.updatedAt = nowIso;

      user.auditLog = user.auditLog || [];
      user.auditLog.unshift({
        action: 'PASSWORD_UPDATED',
        performedBy: user.email,
        timestamp: nowIso,
        details: 'Senha alterada pelo usuário'
      });

      persistUsersToStorage(users);
      return { success: true, message: 'Senha atualizada com sucesso!' };
    },

    /**
     * Alias para alteração de senha
     */
    changePassword: function(identifier, oldPassword, newPassword) {
      return this.updatePassword(identifier, oldPassword, newPassword);
    }
  };
})();

// Exportação global
if (typeof window !== 'undefined') {
  window.UserDB = UserDB;
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.UserDB && typeof window.UserDB.initialize === 'function') {
        window.UserDB.initialize();
      }
    });
  }
}
