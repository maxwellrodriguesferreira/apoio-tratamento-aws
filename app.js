/**
 * Terminal Apoio ao Tratamento & Serviços Farmacêuticos
 * Criado pelo desenvolvedor e farmacêutico Maxwell Rodrigues Ferreira (CRF-SP nº 86426)
 * Drogasil Mogilar · Farmacêutico & Drogaria Dinâmicos
 */

const DEFAULT_CONFIG = {
  drogaria: 'Drogasil Mogilar',
  farmaceutico: 'Maxwell'
};

// Histórico de Comandos e Histórico de Mensagens
let commandHistory = [];
let commandIndex = -1;
let generatedMessagesHistory = JSON.parse(localStorage.getItem('apoio_tratamento_history') || '[]');

// Temas disponíveis
const THEMES = ['matrix', 'amber', 'cyberpunk', 'dark'];
let currentThemeIndex = 0;

// Elementos DOM (resolvidos defensivamente)
let terminalOutput = typeof document !== 'undefined' ? document.getElementById('terminalOutput') : null;
let cliInput = typeof document !== 'undefined' ? document.getElementById('cliInput') : null;
let crtOverlay = typeof document !== 'undefined' ? document.getElementById('crtOverlay') : null;
let themeToggleBtn = typeof document !== 'undefined' ? document.getElementById('themeToggleBtn') : null;
let crtToggleBtn = typeof document !== 'undefined' ? document.getElementById('crtToggleBtn') : null;
let historyCounter = typeof document !== 'undefined' ? document.getElementById('historyCounter') : null;

function resolveDOMElements() {
  if (typeof document === 'undefined') return;
  terminalOutput = document.getElementById('terminalOutput');
  cliInput = document.getElementById('cliInput');
  crtOverlay = document.getElementById('crtOverlay');
  themeToggleBtn = document.getElementById('themeToggleBtn');
  crtToggleBtn = document.getElementById('crtToggleBtn');
  historyCounter = document.getElementById('historyCounter');
}

/* ==========================================================================
   SISTEMA DE GESTÃO DE USUÁRIOS, CADASTRO, SUPER USUÁRIO & SESSÃO
   ========================================================================== */

// Rotina de inicialização de armazenamento
const CRED_RESET_KEY = 'apoio_cred_reset_20260902_v5';
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  if (localStorage.getItem(CRED_RESET_KEY) !== 'done') {
    localStorage.removeItem('apoio_users_registry');
    localStorage.removeItem('apoio_auth_session');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('apoio_auth_session');
    }
    localStorage.setItem(CRED_RESET_KEY, 'done');
  }
}

// Purga específica do e-mail descontinuado maxwellrodriguesferreira1@gmail.com
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const rawUsers = localStorage.getItem('apoio_users_registry');
    if (rawUsers) {
      const parsed = JSON.parse(rawUsers);
      const cleaned = parsed.filter(u => u.email !== 'maxwellrodriguesferreira1@gmail.com');
      if (cleaned.length !== parsed.length) {
        localStorage.setItem('apoio_users_registry', JSON.stringify(cleaned));
      }
    }
  } catch (e) {}
}

const SUPER_ADMIN_EMAILS = (function() {
  const list = ['maxwellferreira@proton.me', 'maxwell', 'admin@drogasil.com.br'];
  const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
    ? window.AppConfig.getAdminCredentials()
    : null;
  if (cfg && cfg.user && !cfg.user.includes('PLACEHOLDER')) {
    const u = cfg.user.toLowerCase().trim();
    if (!list.includes(u)) list.push(u);
  }
  return list;
})();

const DEFAULT_AUTH = (function() {
  const cfg = typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getAdminCredentials === 'function'
    ? window.AppConfig.getAdminCredentials()
    : null;
  return {
    user: (cfg?.user && !cfg.user.includes('PLACEHOLDER')) ? cfg.user : 'admin@drogasil.com.br',
    pass: (cfg?.pass && !cfg.pass.includes('PLACEHOLDER')) ? cfg.pass : 'admin123',
    name: (cfg?.name && !cfg.name.includes('PLACEHOLDER')) ? cfg.name : 'Maxwell Ferreira (Administrador)'
  };
})();

const USERS_STORAGE_KEY = 'apoio_users_registry';

// Normalização padronizada de Status e Roles
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

function getRegisteredUsers() {
  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.getAllUsers === 'function') {
    return window.UserDB.getAllUsers();
  }
  const raw = typeof localStorage !== 'undefined' ? (localStorage.getItem(USERS_STORAGE_KEY) || localStorage.getItem('apoio_users_database_v2')) : null;
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(u => ({
      ...u,
      status: normalizeStatus(u.status),
      role: normalizeRole(u.role),
      auditLog: Array.isArray(u.auditLog) ? u.auditLog : []
    }));
  } catch (e) {
    return [];
  }
}

function saveRegisteredUsers(users) {
  try {
    if (typeof localStorage !== 'undefined') {
      const json = JSON.stringify(users);
      localStorage.setItem(USERS_STORAGE_KEY, json);
      localStorage.setItem('apoio_users_database_v2', json);
    }
  } catch (e) {
    console.warn('Erro ao salvar registro de usuários:', e);
  }
}

function findUserRecord(emailOrUidOrName) {
  if (!emailOrUidOrName) return null;
  const term = String(emailOrUidOrName).trim().toLowerCase();
  const users = getRegisteredUsers();
  return users.find(u => 
    (u.email && u.email.toLowerCase() === term) ||
    (u.uid && u.uid === term) ||
    (u.name && u.name.toLowerCase() === term)
  ) || null;
}

function getSuperAdminUser() {
  const users = getRegisteredUsers();
  if (!users.length) return null;
  return users.find(u => SUPER_ADMIN_EMAILS.includes(String(u.email || '').toLowerCase()) || u.role === 'admin' || u.role === 'superadmin') || null;
}

function isSuperUser(emailOrUid) {
  if (!emailOrUid) return false;
  const term = String(emailOrUid).trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(term)) return true;

  const session = getAuthSession();
  if (session && (String(session.user || '').toLowerCase() === term || String(session.uid || '').toLowerCase() === term) && (session.role === 'admin' || session.role === 'superadmin')) {
    return true;
  }

  const record = findUserRecord(term);
  if (record && (record.role === 'admin' || record.role === 'superadmin')) {
    return true;
  }

  const superUser = getSuperAdminUser();
  if (superUser && ((superUser.email && superUser.email.toLowerCase() === term) || (superUser.uid && superUser.uid === term)) && (superUser.role === 'admin' || superUser.role === 'superadmin' || SUPER_ADMIN_EMAILS.includes(String(superUser.email).toLowerCase()))) {
    return true;
  }

  return false;
}

function addAuditLogEntry(targetUser, action, details, adminEmailOrUid = null) {
  if (!targetUser) return;
  if (!Array.isArray(targetUser.auditLog)) {
    targetUser.auditLog = [];
  }
  const session = getAuthSession();
  const adminActor = adminEmailOrUid || (session ? (session.user || session.uid) : 'sistema');
  targetUser.auditLog.unshift({
    action: action,
    performedBy: adminActor,
    timestamp: new Date().toISOString(),
    details: details || ''
  });
}

function formatSlug(str, defaultVal = 'user') {
  if (!str) return defaultVal;
  return str.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || defaultVal;
}

function getPromptPrefixText() {
  const session = getAuthSession();
  const userSlug = formatSlug(session?.name || session?.user || DEFAULT_CONFIG.farmaceutico, 'maxwell');
  const drogariaSlug = formatSlug(session?.drogaria || DEFAULT_CONFIG.drogaria, 'mogilar');
  return `${userSlug}@${drogariaSlug}:~$`;
}

function applyUserSessionProfile(userData) {
  if (!userData) return;
  const name = userData.name || userData.user || DEFAULT_CONFIG.farmaceutico;
  const drogaria = userData.drogaria || DEFAULT_CONFIG.drogaria;

  DEFAULT_CONFIG.farmaceutico = name;
  DEFAULT_CONFIG.drogaria = drogaria;

  const promptUserDisplay = document.getElementById('promptUserDisplay');
  const statusUserDisplay = document.getElementById('statusUserDisplay');
  const statusDrogariaDisplay = document.getElementById('statusDrogariaDisplay');
  const headerTerminalTitle = document.getElementById('headerTerminalTitle');

  const userSlug = formatSlug(name, 'usuario');
  const drogariaSlug = formatSlug(drogaria, 'drogaria');

  if (promptUserDisplay) promptUserDisplay.textContent = `${userSlug}@${drogariaSlug}`;
  if (statusUserDisplay) statusUserDisplay.textContent = name;
  if (statusDrogariaDisplay) statusDrogariaDisplay.textContent = drogaria;
  if (headerTerminalTitle) headerTerminalTitle.textContent = `${userSlug}@${drogariaSlug}: ~/apoio-tratamento`;

  // Atualiza campo drogaria no wizard se renderizado
  const wizDrogaria = document.getElementById('wizDrogaria');
  if (wizDrogaria && (!wizDrogaria.value || wizDrogaria.value === 'Drogasil Mogilar')) {
    wizDrogaria.value = drogaria;
  }
  const wizFarmaceutico = document.getElementById('wizFarmaceutico');
  if (wizFarmaceutico && (!wizFarmaceutico.value || wizFarmaceutico.value === 'Maxwell')) {
    wizFarmaceutico.value = name;
  }
}

function getAuthSession() {
  if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return null;
  const sessionStr = sessionStorage.getItem('apoio_auth_session') || localStorage.getItem('apoio_auth_session');
  if (!sessionStr) return null;
  try {
    const s = JSON.parse(sessionStr);
    if (s) {
      s.status = normalizeStatus(s.status);
      s.role = normalizeRole(s.role);
    }
    return s;
  } catch (e) {
    return null;
  }
}

function setAuthSession(userData, remember) {
  if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return;
  const dataStr = JSON.stringify(userData);
  if (remember) {
    localStorage.setItem('apoio_auth_session', dataStr);
  } else {
    sessionStorage.setItem('apoio_auth_session', dataStr);
  }
}

function saveAuthSession(userData, remember = true) {
  setAuthSession(userData, remember);
}

function clearAuthSession() {
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('apoio_auth_session');
  if (typeof localStorage !== 'undefined') localStorage.removeItem('apoio_auth_session');
}

function updateSuperUserToolbar() {
  const adminBtn = document.getElementById('adminUsersBtn');
  const badge = document.getElementById('pendingUsersBadge');
  const session = getAuthSession();

  if (session && isSuperUser(session.user)) {
    if (adminBtn) adminBtn.style.display = 'inline-flex';
    const users = getRegisteredUsers();
    const pendingCount = users.filter(u => normalizeStatus(u.status) === 'pending').length;
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
    }
  } else {
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function updateAuthStateUI(session) {
  const loginPanel = document.getElementById('loginPanel');
  const logoutBtn = document.getElementById('logoutBtn');

  if (session && session.user) {
    const isSuper = isSuperUser(session.user);
    let record = findUserRecord(session.user) || findUserRecord(session.uid);

    if (isSuper) {
      if (!record) {
        record = {
          uid: session.uid || 'admin-' + Date.now(),
          email: session.user,
          name: session.name || 'Maxwell Ferreira',
          drogaria: session.drogaria || 'Drogasil Mogilar',
          role: 'admin',
          status: 'approved',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          approvedBy: session.uid || 'bootstrap',
          rejectedAt: null,
          rejectedBy: null,
          blockedAt: null,
          blockedBy: null,
          rejectionReason: null,
          auditLog: [{ action: 'BOOTSTRAP', performedBy: 'sistema', timestamp: new Date().toISOString(), details: 'Administrador mestre inicial' }]
        };
        const all = getRegisteredUsers();
        all.unshift(record);
        saveRegisteredUsers(all);
      } else {
        record.status = 'approved';
        record.role = 'admin';
      }
    }

    if (record) {
      session.name = record.name || session.name;
      session.drogaria = record.drogaria || session.drogaria;
      session.role = normalizeRole(record.role || (isSuper ? 'admin' : 'user'));
      session.status = normalizeStatus(record.status || 'approved');
    }

    applyUserSessionProfile(session);

    if (loginPanel) loginPanel.hidden = true;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    updateSuperUserToolbar();

    setTimeout(() => cliInput?.focus(), 50);
  } else {
    if (loginPanel) {
      loginPanel.hidden = false;
      const userInput = document.getElementById('loginUserInput');
      setTimeout(() => userInput?.focus(), 50);
    }
    if (logoutBtn) logoutBtn.style.display = 'none';
    const adminBtn = document.getElementById('adminUsersBtn');
    if (adminBtn) adminBtn.style.display = 'none';
  }
}

function showLoginFeedback(message, typeClass) {
  const feedback = document.getElementById('loginFeedback');
  if (!feedback) return;
  feedback.className = `login-feedback ${typeClass || ''}`;
  feedback.textContent = message;
}

function showRegisterFeedback(message, typeClass) {
  const feedback = document.getElementById('registerFeedback');
  if (!feedback) return;
  feedback.className = `login-feedback ${typeClass || ''}`;
  feedback.textContent = message;
}

function triggerCardShake(cardEl) {
  if (!cardEl) return;
  cardEl.classList.remove('shake');
  void cardEl.offsetWidth; // trigger reflow
  cardEl.classList.add('shake');
  setTimeout(() => cardEl.classList.remove('shake'), 600);
}

function switchAuthTab(tab) {
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBadge = document.getElementById('loginBadge');
  const noticeContent = document.getElementById('noticeContent');

  // Esconde todos os formulários inicialmente
  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';

  if (tab === 'register') {
    if (tabLoginBtn) { tabLoginBtn.classList.remove('active'); tabLoginBtn.setAttribute('aria-selected', 'false'); }
    if (tabRegisterBtn) { tabRegisterBtn.classList.add('active'); tabRegisterBtn.setAttribute('aria-selected', 'true'); }
    if (registerForm) registerForm.style.display = 'block';
    if (loginBadge) loginBadge.textContent = '📝 SOLICITAÇÃO DE ACESSO';
    if (noticeContent) noticeContent.textContent = 'Preencha seus dados para solicitar cadastro. O acesso depende de aprovação administrativa.';
    const regName = document.getElementById('regNameInput');
    setTimeout(() => regName?.focus(), 50);
  } else {
    if (tabRegisterBtn) { tabRegisterBtn.classList.remove('active'); tabRegisterBtn.setAttribute('aria-selected', 'false'); }
    if (tabLoginBtn) { tabLoginBtn.classList.add('active'); tabLoginBtn.setAttribute('aria-selected', 'true'); }
    if (loginForm) loginForm.style.display = 'block';
    if (loginBadge) loginBadge.textContent = '🔒 ACESSO RESTRITO';
    if (noticeContent) noticeContent.textContent = 'Autenticação obrigatória. Apenas usuários aprovados podem acessar prontuários e recursos.';
    const userInput = document.getElementById('loginUserInput');
    setTimeout(() => userInput?.focus(), 50);
  }
}

function showForgotFeedback(message, type = '') {
  const el = document.getElementById('forgotFeedback');
  if (!el) return;
  el.className = `login-feedback ${type}`;
  el.textContent = message;
}

function showConfirmResetFeedback(message, type = '') {
  const el = document.getElementById('confirmResetFeedback');
  if (!el) return;
  el.className = `login-feedback ${type}`;
  el.textContent = message;
}

let pendingResetEmail = '';

async function handleForgotPasswordSubmit(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('forgotEmailInput');
  const submitBtn = document.getElementById('forgotSubmitBtn');
  const loginCard = document.querySelector('.login-card');
  const email = emailInput?.value.trim().toLowerCase();

  if (!email) {
    showForgotFeedback('⚠️ Por favor, informe seu e-mail cadastrado.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showForgotFeedback('🔄 Processando solicitação de recuperação...', 'is-warning');

  try {
    let result = null;
    if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.forgotPassword === 'function') {
      result = await window.CognitoAuth.forgotPassword(email);
    } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.requestPasswordReset === 'function') {
      result = await window.UserDB.requestPasswordReset(email);
    } else {
      throw new Error('Módulo de autenticação indisponível.');
    }

    pendingResetEmail = email;
    const isLocalMode = Boolean(result && (result.isLocal || result.code));

    if (isLocalMode && result.code) {
      showForgotFeedback(`✅ Código de recuperação: ${result.code}`, 'is-success');
      appendLog(`🔑 <strong>Recuperação de Senha:</strong> Código de verificação gerado para <strong>${escapeHTML(email)}</strong>: <code>${escapeHTML(result.code)}</code>.`, 'log-warning');
    } else {
      showForgotFeedback('✅ Solicitação enviada! Verifique seu e-mail cadastrado.', 'is-success');
      appendLog(`🔑 <strong>Recuperação de Senha:</strong> Solicitação de código enviada para <strong>${escapeHTML(email)}</strong>.`, 'log-info');
    }

    setTimeout(() => {
      switchAuthTab('confirmReset');
      const codeField = document.getElementById('resetCodeInput');
      if (codeField) {
        if (isLocalMode && result.code) {
          codeField.value = result.code;
          showConfirmResetFeedback(`🔐 Modo Local/Offline: Código [${result.code}] preenchido automaticamente. Defina sua nova senha abaixo.`, 'is-success');
        } else {
          codeField.value = '';
          showConfirmResetFeedback('📬 Digite o código de 6 dígitos enviado para o seu e-mail cadastrado.', 'is-warning');
        }
        const newPassField = document.getElementById('resetNewPassInput');
        if (newPassField) newPassField.focus();
      }
    }, 800);
  } catch (err) {
    console.error('Erro na solicitação de recuperação:', err);
    showForgotFeedback(`⚠️ ${err.message || 'Falha ao solicitar recuperação de senha.'}`, 'is-error');
    triggerCardShake(loginCard);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleConfirmResetSubmit(e) {
  if (e) e.preventDefault();
  const codeInput = document.getElementById('resetCodeInput');
  const newPassInput = document.getElementById('resetNewPassInput');
  const confirmPassInput = document.getElementById('resetConfirmPassInput');
  const submitBtn = document.getElementById('confirmResetSubmitBtn');
  const loginCard = document.querySelector('.login-card');

  const code = codeInput?.value.trim();
  const newPass = newPassInput?.value;
  const confirmPass = confirmPassInput?.value;
  const targetEmail = pendingResetEmail || document.getElementById('forgotEmailInput')?.value.trim().toLowerCase() || document.getElementById('loginUserInput')?.value.trim().toLowerCase();

  if (!targetEmail || !code || !newPass || !confirmPass) {
    showConfirmResetFeedback('⚠️ Por favor, preencha todos os campos obrigatórios.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (newPass.length < 6) {
    showConfirmResetFeedback('⚠️ A nova senha deve conter pelo menos 6 caracteres.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (newPass !== confirmPass) {
    showConfirmResetFeedback('⚠️ A confirmação não confere com a nova senha digitada.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showConfirmResetFeedback('🔄 Atualizando sua senha com segurança...', 'is-warning');

  try {
    let res = null;
    if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.confirmPassword === 'function') {
      res = await window.CognitoAuth.confirmPassword(targetEmail, code, newPass);
    } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.confirmPasswordReset === 'function') {
      res = await window.UserDB.confirmPasswordReset(targetEmail, code, newPass);
    } else {
      throw new Error('Módulo de autenticação indisponível.');
    }

    showConfirmResetFeedback('🎉 Senha redefinida com sucesso! Redirecionando para login...', 'is-success');
    appendLog(`✅ <strong>Senha Redefinida:</strong> O usuário <strong>${escapeHTML(targetEmail)}</strong> atualizou sua senha com sucesso.`, 'log-success');

    if (codeInput) codeInput.value = '';
    if (newPassInput) newPassInput.value = '';
    if (confirmPassInput) confirmPassInput.value = '';

    setTimeout(() => {
      switchAuthTab('login');
      const loginUserInput = document.getElementById('loginUserInput');
      if (loginUserInput) loginUserInput.value = targetEmail;
      showLoginFeedback('✅ Senha redefinida com sucesso! Digite sua nova senha para entrar.', 'is-success');
      const passField = document.getElementById('loginPassInput');
      setTimeout(() => passField?.focus(), 100);
    }, 1500);
  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    showConfirmResetFeedback(`⚠️ ${err.message || 'Falha ao redefinir senha.'}`, 'is-error');
    triggerCardShake(loginCard);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function toggleResetPassVisibility() {
  const passInput = document.getElementById('resetNewPassInput');
  const toggleBtn = document.getElementById('resetPassToggle');
  if (!passInput) return;
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  if (toggleBtn) {
    toggleBtn.textContent = isPass ? '🙈' : '👁️';
    toggleBtn.setAttribute('aria-pressed', isPass ? 'true' : 'false');
  }
}

function toggleLoginPassVisibility() {
  const passInput = document.getElementById('loginPassInput');
  const toggleBtn = document.getElementById('loginPassToggle');
  if (!passInput) return;
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  if (toggleBtn) {
    toggleBtn.textContent = isPass ? '🙈' : '👁️';
    toggleBtn.setAttribute('aria-pressed', isPass ? 'true' : 'false');
  }
}

function toggleRegisterPassVisibility() {
  const passInput = document.getElementById('regPassInput');
  const passConfirmInput = document.getElementById('regPassConfirmInput');
  const toggleBtn = document.getElementById('regPassToggle');
  if (!passInput) return;
  const isPass = passInput.type === 'password';
  passInput.type = isPass ? 'text' : 'password';
  if (passConfirmInput) passConfirmInput.type = isPass ? 'text' : 'password';
  if (toggleBtn) {
    toggleBtn.textContent = isPass ? '🙈' : '👁️';
    toggleBtn.setAttribute('aria-pressed', isPass ? 'true' : 'false');
  }
}

async function handleRegisterSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('regNameInput');
  const drogariaInput = document.getElementById('regDrogariaInput');
  const emailInput = document.getElementById('regEmailInput');
  const passInput = document.getElementById('regPassInput');
  const passConfirmInput = document.getElementById('regPassConfirmInput');
  const submitBtn = document.getElementById('registerSubmitBtn');
  const loginCard = document.querySelector('.login-card');

  const name = nameInput?.value.trim();
  const drogaria = drogariaInput?.value.trim() || 'Drogasil Mogilar';
  const email = emailInput?.value.trim().toLowerCase();
  const pass = passInput?.value;
  const passConfirm = passConfirmInput?.value;

  if (!name || !email || !pass || !passConfirm) {
    showRegisterFeedback('⚠️ Por favor, preencha todos os campos obrigatórios.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (!email.includes('@') || !email.includes('.')) {
    showRegisterFeedback('⚠️ Digite um endereço de e-mail válido.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (pass.length < 6) {
    showRegisterFeedback('⚠️ A senha deve ter no mínimo 6 caracteres.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (pass !== passConfirm) {
    showRegisterFeedback('⚠️ As senhas digitadas não coincidem.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  const existing = findUserRecord(email);
  if (existing) {
    showRegisterFeedback(`⚠️ O e-mail "${email}" já possui cadastro (Status: ${normalizeStatus(existing.status).toUpperCase()}).`, 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showRegisterFeedback('🔄 Criando cadastro do usuário...', 'is-warning');

  window.__IS_REGISTERING = true;
  let registeredUid = 'user-' + Date.now();
  let usedFirebase = false;

  try {
    if (typeof firebaseRegister === 'function' && typeof isFirebaseConfigured === 'function' && isFirebaseConfigured()) {
      try {
        const userCredential = await firebaseRegister(email, pass, name);
        if (userCredential && userCredential.user) {
          registeredUid = userCredential.user.uid;
          usedFirebase = true;
        }
      } catch (fbErr) {
        console.warn('Aviso ao cadastrar via Firebase Auth:', fbErr);
        if (fbErr.code === 'auth/email-already-in-use') {
          showRegisterFeedback('⚠️ Este e-mail já está cadastrado no sistema.', 'is-error');
          triggerCardShake(loginCard);
          if (submitBtn) submitBtn.disabled = false;
          return;
        } else if (fbErr.code === 'auth/weak-password') {
          showRegisterFeedback('⚠️ Senha fraca. Utilize uma senha com letras e números.', 'is-error');
          triggerCardShake(loginCard);
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }
    }

    const users = getRegisteredUsers();
    let newUser = null;

    // 1. Tenta cadastro no AWS Cognito se disponível com fallback automático garantido
    try {
      if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.signUp === 'function') {
        newUser = await window.CognitoAuth.signUp(name, email, drogaria, pass);
      } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.registerUser === 'function') {
        newUser = await window.UserDB.registerUser(name, email, drogaria, pass);
      }
    } catch (authErr) {
      console.warn('Falha no CognitoAuth.signUp, aplicando fallback seguro local:', authErr);
      if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.registerUser === 'function') {
        newUser = await window.UserDB.registerUser(name, email, drogaria, pass);
      } else {
        throw authErr;
      }
    }

    if (!newUser) {
      const isExplicitSuper = SUPER_ADMIN_EMAILS.includes(email);
      const isFirstAdmin = isExplicitSuper;
      const nowIso = new Date().toISOString();
      newUser = {
        uid: registeredUid,
        name: name,
        email: email,
        drogaria: drogaria,
        role: isFirstAdmin ? 'admin' : 'user',
        status: isFirstAdmin ? 'approved' : 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
        approvedAt: isFirstAdmin ? nowIso : null,
        approvedBy: isFirstAdmin ? registeredUid : null,
        rejectedAt: null,
        rejectedBy: null,
        blockedAt: null,
        blockedBy: null,
        rejectionReason: null,
        auditLog: [{
          action: 'REGISTRATION',
          performedBy: email,
          timestamp: nowIso,
          details: isFirstAdmin ? 'Primeiro administrador mestre inicial (Acesso liberado)' : 'Cadastro solicitado - Aguardando aprovação administrativa'
        }]
      };
      users.push(newUser);
      saveRegisteredUsers(users);
    }

    const isFirstAdmin = newUser.role === 'admin' || newUser.status === 'approved';

    // Garante que novos usuários PENDING não permaneçam com sessão aberta
    clearAuthSession();

    if (nameInput) nameInput.value = '';
    if (drogariaInput) drogariaInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
    if (passConfirmInput) passConfirmInput.value = '';

    if (isFirstAdmin) {
      showRegisterFeedback('👑 Conta criada com sucesso! Você foi definido como ADMINISTRADOR com acesso total.', 'is-success');
      appendLog(`👑 <strong>Novo Administrador cadastrado:</strong> ${escapeHTML(name)} (${escapeHTML(email)}). Acesso liberado!`, 'log-success');
    } else {
      showRegisterFeedback('⏳ Cadastro realizado com sucesso! Sua conta está PENDENTE e aguardando aprovação do Administrador.', 'is-warning');
      appendLog(`📝 <strong>Novo cadastro registrado:</strong> ${escapeHTML(name)} (${escapeHTML(email)}). Status: <strong>Aguardando aprovação do Administrador</strong>.`, 'log-info');
    }

    if (submitBtn) submitBtn.disabled = false;
    updateSuperUserToolbar();

    setTimeout(() => {
      switchAuthTab('login');
      const loginUser = document.getElementById('loginUserInput');
      if (loginUser) loginUser.value = email;
      if (isFirstAdmin) {
        showLoginFeedback('👑 Você é o Administrador! Faça seu login para acessar o painel.', 'is-success');
      } else {
        showLoginFeedback('⏳ Cadastro pendente: Aguarde a aprovação do Administrador antes de acessar.', 'is-warning');
      }
    }, 3500);
  } catch (regErr) {
    console.error('Erro no cadastro:', regErr);
    showRegisterFeedback(`⚠️ ${regErr.message || 'Falha ao registrar usuário.'}`, 'is-error');
    triggerCardShake(loginCard);
    if (submitBtn) submitBtn.disabled = false;
  } finally {
    window.__IS_REGISTERING = false;
  }
}

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const userInput = document.getElementById('loginUserInput');
  const passInput = document.getElementById('loginPassInput');
  const rememberCheckbox = document.getElementById('loginRemember');
  const loginCard = document.querySelector('.login-card');
  const submitBtn = document.getElementById('loginSubmitBtn');

  const rawUser = userInput?.value.trim();
  const rawPass = passInput?.value;

  if (!rawUser || !rawPass) {
    showLoginFeedback('⚠️ Por favor, preencha o e-mail/usuário e a senha.', 'is-error');
    triggerCardShake(loginCard);
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showLoginFeedback('🔄 Validando credenciais e permissões...', 'is-warning');

  try {
    const remember = rememberCheckbox ? rememberCheckbox.checked : true;
    let authResult = null;

    // 1. Tenta autenticação via AWS Cognito
    if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.signIn === 'function') {
      authResult = await window.CognitoAuth.signIn(rawUser, rawPass);
    } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.authenticateUser === 'function') {
      authResult = await window.UserDB.authenticateUser(rawUser, rawPass);
    } else {
      // Fallback local apenas caso módulos externos não estejam disponíveis
      const record = findUserRecord(rawUser);
      if (!record) throw new Error('Usuário não encontrado.');
      const status = normalizeStatus(record.status);
      if (status !== 'approved' && record.role !== 'admin') {
        const err = new Error('Seu cadastro está aguardando aprovação de um Administrador.');
        err.code = 'PENDING_APPROVAL';
        throw err;
      }
      authResult = { user: record, status: 'approved' };
    }

    const authenticatedUser = authResult.user;
    const isSuper = authenticatedUser.role === 'admin' || isSuperUser(authenticatedUser.email);

    // Acesso autorizado (Apenas Administradores ou Usuários expressamente APPROVED)
    const session = {
      user: authenticatedUser.email || rawUser,
      name: authenticatedUser.name || 'Usuário',
      drogaria: authenticatedUser.drogaria || DEFAULT_CONFIG.drogaria,
      role: isSuper ? 'admin' : normalizeRole(authenticatedUser.role || 'user'),
      status: 'approved',
      uid: authenticatedUser.uid || 'usr_' + Date.now(),
      authType: authenticatedUser.provider || 'aws-cognito',
      loginTime: new Date().toISOString()
    };

    setAuthSession(session, remember);
    updateAuthStateUI(session);

    const roleBadge = isSuper ? ' 🛡️ [ADMINISTRADOR]' : '';
    appendLog(`🟢 <strong>Autenticado com sucesso.</strong> Usuário: <strong>${escapeHTML(session.name)}</strong> (${escapeHTML(session.user)})${roleBadge}.`, 'log-success');
    showLoginFeedback('', '');
    if (passInput) passInput.value = '';

    // Verifica se a URL acessada era rota de admin
    checkAdminUrlRoute();
  } catch (error) {
    console.error('Erro de autenticação:', error);
    let errorMsg = '❌ Falha ao autenticar.';
    if (error.code === 'PENDING_APPROVAL') {
      errorMsg = '⏳ Acesso Bloqueado: Seu cadastro está aguardando APROVAÇÃO de um Administrador.';
    } else if (error.code === 'REJECTED') {
      errorMsg = `🚫 ${error.message}`;
    } else if (error.code === 'BLOCKED') {
      errorMsg = '🚫 Conta Bloqueada: Seu acesso foi bloqueado pelo Administrador.';
    } else if (error.message) {
      errorMsg = `❌ ${error.message}`;
    }
    showLoginFeedback(errorMsg, error.code === 'PENDING_APPROVAL' ? 'is-warning' : 'is-error');
    triggerCardShake(loginCard);
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function logoutUser() {
  const session = getAuthSession();
  const name = session ? (session.name || session.user) : 'Usuário';

  if (typeof firebaseLogout === 'function') {
    try {
      await firebaseLogout();
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase:', e);
    }
  }

  clearAuthSession();
  updateAuthStateUI(null);
  closeAdminUsersPanel();
  appendLog(`🔒 <strong>Sessão encerrada</strong> para: ${escapeHTML(name)}.`, 'log-warning');
  showLoginFeedback('🔒 Sessão encerrada com sucesso.', '');
}

function showCurrentUser() {
  const session = getAuthSession();
  if (session) {
    const isAdmin = isSuperUser(session.user);
    const roleBadge = isAdmin ? ' 🛡️ [ADMINISTRADOR]' : ' 👤 [USER]';
    appendLog(`👤 <strong>Usuário conectado:</strong> ${escapeHTML(session.name || session.user)} (${escapeHTML(session.user)})${roleBadge} | Status: <strong>${escapeHTML(session.status.toUpperCase())}</strong> | Drogaria: <strong>${escapeHTML(DEFAULT_CONFIG.drogaria)}</strong>`, 'log-info');
  } else {
    appendLog(`⚠️ Nenhuma sessão ativa no momento.`, 'log-warning');
  }
}

/* ==========================================================================
   MEU PERFIL & REDEFINIÇÃO DE CREDENCIAIS
   ========================================================================== */

function openUserProfileModal() {
  const session = getAuthSession();
  const panel = document.getElementById('userProfilePanel');
  if (!panel) return;

  const roleEl = document.getElementById('profileDisplayRole');
  const providerEl = document.getElementById('profileDisplayProvider');
  const emailEl = document.getElementById('profileDisplayEmail');
  const nameEl = document.getElementById('profileDisplayName');
  const drogariaEl = document.getElementById('profileDisplayDrogaria');

  const editNameInput = document.getElementById('profileEditNameInput');
  const editDrogariaInput = document.getElementById('profileEditDrogariaInput');

  const userEmail = session?.user || 'maxwellferreira@proton.me';
  const userName = session?.name || DEFAULT_CONFIG.farmaceutico || 'Farmacêutico';
  const userDrogaria = session?.drogaria || DEFAULT_CONFIG.drogaria || 'Drogasil Mogilar';
  const userRole = session?.role === 'admin' || isSuperUser(userEmail) ? 'ADMINISTRADOR' : 'FARMACÊUTICO';

  if (roleEl) {
    roleEl.textContent = userRole;
    roleEl.className = `badge-role ${userRole === 'ADMINISTRADOR' ? 'role-admin' : 'role-user'}`;
  }
  if (providerEl) {
    const isCognito = typeof window !== 'undefined' && window.CognitoAuth && window.CognitoAuth.isConfigured();
    providerEl.textContent = isCognito ? 'AWS Cognito' : 'Banco Seguro Local';
  }
  if (emailEl) emailEl.textContent = userEmail;
  if (nameEl) nameEl.textContent = userName;
  if (drogariaEl) drogariaEl.textContent = userDrogaria;

  if (editNameInput) editNameInput.value = userName;
  if (editDrogariaInput) editDrogariaInput.value = userDrogaria;

  // Limpa campos de senha
  const curPass = document.getElementById('profileCurrentPassInput');
  const newPass = document.getElementById('profileNewPassInput');
  const confPass = document.getElementById('profileConfirmNewPassInput');
  if (curPass) curPass.value = '';
  if (newPass) newPass.value = '';
  if (confPass) confPass.value = '';

  showProfilePassFeedback('', '');
  showProfileDataFeedback('', '');

  switchProfileTab('pass');
  panel.hidden = false;
}

function closeUserProfileModal() {
  const panel = document.getElementById('userProfilePanel');
  if (panel) panel.hidden = true;
}

function switchProfileTab(tab) {
  const tabPassBtn = document.getElementById('tabProfilePassBtn');
  const tabDataBtn = document.getElementById('tabProfileDataBtn');
  const passForm = document.getElementById('profileChangePassForm');
  const dataForm = document.getElementById('profileUpdateDataForm');

  if (tab === 'pass') {
    tabPassBtn?.classList.add('active');
    tabDataBtn?.classList.remove('active');
    if (passForm) passForm.style.display = 'block';
    if (dataForm) dataForm.style.display = 'none';
  } else {
    tabPassBtn?.classList.remove('active');
    tabDataBtn?.classList.add('active');
    if (passForm) passForm.style.display = 'none';
    if (dataForm) dataForm.style.display = 'block';
  }
}

function showProfilePassFeedback(msg, typeClass) {
  const el = document.getElementById('profilePassFeedback');
  if (!el) return;
  el.className = `login-feedback ${typeClass || ''}`;
  el.textContent = msg;
}

function showProfileDataFeedback(msg, typeClass) {
  const el = document.getElementById('profileDataFeedback');
  if (!el) return;
  el.className = `login-feedback ${typeClass || ''}`;
  el.textContent = msg;
}

function togglePasswordInputVisibility(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  if (btn) {
    btn.textContent = isPass ? '🙈' : '👁️';
    btn.setAttribute('aria-pressed', isPass ? 'true' : 'false');
  }
}

async function handleProfilePasswordChangeSubmit(e) {
  if (e) e.preventDefault();
  const currentPass = document.getElementById('profileCurrentPassInput')?.value;
  const newPass = document.getElementById('profileNewPassInput')?.value;
  const confirmPass = document.getElementById('profileConfirmNewPassInput')?.value;
  const submitBtn = document.getElementById('profilePassSubmitBtn');

  const session = getAuthSession();
  const userEmail = session?.user || 'maxwellferreira@proton.me';

  if (!currentPass || !newPass || !confirmPass) {
    showProfilePassFeedback('⚠️ Preencha todos os campos obrigatórios.', 'is-error');
    return;
  }
  if (newPass.length < 6) {
    showProfilePassFeedback('⚠️ A nova senha deve ter no mínimo 6 caracteres.', 'is-error');
    return;
  }
  if (newPass !== confirmPass) {
    showProfilePassFeedback('⚠️ A confirmação não confere com a nova senha digitada.', 'is-error');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showProfilePassFeedback('🔄 Atualizando credenciais com segurança...', 'is-warning');

  try {
    if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.changePassword === 'function') {
      await window.CognitoAuth.changePassword(userEmail, currentPass, newPass);
    } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.changePassword === 'function') {
      await window.UserDB.changePassword(userEmail, currentPass, newPass);
    } else {
      throw new Error('Módulo de autenticação indisponível.');
    }

    showProfilePassFeedback('✅ Senha alterada com sucesso!', 'is-success');
    appendLog(`🔑 <strong>Credenciais atualizadas:</strong> Senha alterada com sucesso para <strong>${escapeHTML(userEmail)}</strong>.`, 'log-success');

    setTimeout(() => {
      closeUserProfileModal();
    }, 1500);
  } catch (err) {
    showProfilePassFeedback(`⚠️ ${err.message || 'Falha ao alterar a senha.'}`, 'is-error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function handleProfileUpdateSubmit(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('profileEditNameInput')?.value.trim();
  const drogaria = document.getElementById('profileEditDrogariaInput')?.value.trim();
  const submitBtn = document.getElementById('profileDataSubmitBtn');

  const session = getAuthSession();
  const userEmail = session?.user || 'maxwellferreira@proton.me';

  if (!name || !drogaria) {
    showProfileDataFeedback('⚠️ Preencha todos os campos obrigatórios.', 'is-error');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  showProfileDataFeedback('🔄 Salvando alterações cadastrais...', 'is-warning');

  try {
    if (typeof window !== 'undefined' && window.CognitoAuth && typeof window.CognitoAuth.updateProfile === 'function') {
      await window.CognitoAuth.updateProfile(userEmail, { name, drogaria });
    } else if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.updateUser === 'function') {
      window.UserDB.updateUser(userEmail, { name, drogaria }, userEmail);
    }

    DEFAULT_CONFIG.farmaceutico = name;
    DEFAULT_CONFIG.drogaria = drogaria;

    if (session) {
      session.name = name;
      session.drogaria = drogaria;
      saveAuthSession(session);
      applyUserSessionProfile(session);
    }

    const nameEl = document.getElementById('profileDisplayName');
    const drogariaEl = document.getElementById('profileDisplayDrogaria');
    if (nameEl) nameEl.textContent = name;
    if (drogariaEl) drogariaEl.textContent = drogaria;

    showProfileDataFeedback('✅ Dados cadastrais atualizados com sucesso!', 'is-success');
    appendLog(`👤 <strong>Perfil atualizado:</strong> Nome: <strong>${escapeHTML(name)}</strong> | Filial: <strong>${escapeHTML(drogaria)}</strong>.`, 'log-success');

    setTimeout(() => {
      closeUserProfileModal();
    }, 1500);
  } catch (err) {
    showProfileDataFeedback(`⚠️ ${err.message || 'Falha ao atualizar dados.'}`, 'is-error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ==========================================================================
   PAINEL ADMINISTRATIVO (/admin/users) - CONTROLE DE ACESSO E MODERAÇÃO
   ========================================================================== */

let adminFilterState = 'all'; // 'all' | 'pending' | 'approved' | 'rejected' | 'blocked'
let adminSearchQuery = '';

function setAdminFilter(filter) {
  adminFilterState = filter || 'all';
  const buttons = document.querySelectorAll('.admin-filter-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-filter') === adminFilterState) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderAdminUsersTable();
}

async function syncUsersWithFirestore() {
  if (typeof firestoreGetUsersList !== 'function') return;
  try {
    const remoteUsers = await firestoreGetUsersList();
    if (remoteUsers && Array.isArray(remoteUsers) && remoteUsers.length) {
      const local = getRegisteredUsers();
      const merged = [...local];
      remoteUsers.forEach(ru => {
        const normStatus = normalizeStatus(ru.status);
        const normRole = normalizeRole(ru.role);
        const ruClean = {
          ...ru,
          status: normStatus,
          role: normRole,
          auditLog: Array.isArray(ru.auditLog) ? ru.auditLog : []
        };
        const idx = merged.findIndex(lu => 
          (lu.email && lu.email.toLowerCase() === ruClean.email.toLowerCase()) || 
          (lu.uid && lu.uid === ruClean.uid)
        );
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], ...ruClean };
        } else {
          merged.push(ruClean);
        }
      });
      saveRegisteredUsers(merged);
      updateSuperUserToolbar();
    }
  } catch (err) {
    console.warn('Aviso ao sincronizar usuários com Firestore:', err);
  }
}

async function openAdminUsersPanel() {
  const session = getAuthSession();
  if (!session || !isSuperUser(session.user)) {
    appendLog('⚠️ Acesso negado: Somente <strong>Administradores</strong> podem acessar o painel de usuários (/admin/users).', 'log-error');
    return;
  }

  const panel = document.getElementById('adminUsersPanel');
  if (!panel) return;

  renderAdminUsersTable();
  panel.hidden = false;

  await syncUsersWithFirestore();
  renderAdminUsersTable();
}

function closeAdminUsersPanel() {
  const panel = document.getElementById('adminUsersPanel');
  if (panel) panel.hidden = true;
  cliInput?.focus();
}

function checkAdminUrlRoute() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const path = window.location.pathname || '';
  if (hash.includes('/admin/users') || hash.includes('admin') || path.includes('/admin/users')) {
    const session = getAuthSession();
    if (session && isSuperUser(session.user)) {
      openAdminUsersPanel();
    }
  }
}

function renderAdminUsersTable() {
  const users = getRegisteredUsers();
  const container = document.getElementById('adminUsersTableContainer');
  const statPending = document.getElementById('statPendingCount');
  const statApproved = document.getElementById('statApprovedCount');
  const statRejected = document.getElementById('statRejectedCount');
  const statBlocked = document.getElementById('statBlockedCount');
  const statTotal = document.getElementById('statTotalCount');

  const pendingList = users.filter(u => normalizeStatus(u.status) === 'pending');
  const approvedList = users.filter(u => normalizeStatus(u.status) === 'approved');
  const rejectedList = users.filter(u => normalizeStatus(u.status) === 'rejected');
  const blockedList = users.filter(u => normalizeStatus(u.status) === 'blocked');

  if (statPending) statPending.textContent = pendingList.length;
  if (statApproved) statApproved.textContent = approvedList.length;
  if (statRejected) statRejected.textContent = rejectedList.length;
  if (statBlocked) statBlocked.textContent = blockedList.length;
  if (statTotal) statTotal.textContent = users.length;

  if (!container) return;

  // Filtragem por status e busca por texto
  let filtered = users;
  if (adminFilterState !== 'all') {
    filtered = filtered.filter(u => normalizeStatus(u.status) === adminFilterState);
  }

  if (adminSearchQuery.trim()) {
    const q = adminSearchQuery.trim().toLowerCase();
    filtered = filtered.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.drogaria && u.drogaria.toLowerCase().includes(q)) ||
      (u.uid && u.uid.toLowerCase().includes(q))
    );
  }

  if (!filtered.length) {
    const msg = adminSearchQuery 
      ? `Nenhum usuário encontrado para a busca "${escapeHTML(adminSearchQuery)}".` 
      : `Nenhum usuário encontrado na categoria "${adminFilterState.toUpperCase()}".`;
    container.innerHTML = `<div class="admin-empty-state">${msg}</div>`;
    return;
  }

  let tableHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>👤 Usuário</th>
          <th>✉️ E-mail</th>
          <th>🏬 Filial / Drogaria</th>
          <th>Função (Role)</th>
          <th>Status</th>
          <th>📅 Cadastro</th>
          <th>Moderação</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
  `;

  const superUser = getSuperAdminUser();
  filtered.forEach((u, index) => {
    const isRootAdmin = (superUser && (u.email === superUser.email || u.uid === superUser.uid)) || (index === 0 && normalizeRole(u.role) === 'admin');
    const dateFormatted = u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '—';
    const statusClean = normalizeStatus(u.status);
    const roleClean = normalizeRole(u.role);

    let statusBadge = '';
    if (statusClean === 'pending') {
      statusBadge = `<span class="status-badge pending">⏳ Pendente</span>`;
    } else if (statusClean === 'rejected') {
      statusBadge = `<span class="status-badge rejected">❌ Rejeitado</span>`;
    } else if (statusClean === 'blocked') {
      statusBadge = `<span class="status-badge blocked">🚫 Bloqueado</span>`;
    } else {
      statusBadge = `<span class="status-badge approved">✅ Aprovado</span>`;
    }

    const roleBadge = roleClean === 'admin' 
      ? `<span class="role-badge admin">🛡️ ADMIN</span>` 
      : `<span class="role-badge user">👤 USER</span>`;

    // Informação de moderação (quem aprovou/rejeitou/bloqueou)
    let modInfo = '<span class="log-dim">—</span>';
    if (u.approvedBy) {
      modInfo = `<small class="log-dim">Aprovado: ${escapeHTML(u.approvedBy)}</small>`;
    } else if (u.rejectedBy) {
      modInfo = `<small class="log-dim" style="color:#ff6666;">Rejeitado: ${escapeHTML(u.rejectedBy)}</small>`;
    } else if (u.blockedBy) {
      modInfo = `<small class="log-dim" style="color:#ff0055;">Bloqueado: ${escapeHTML(u.blockedBy)}</small>`;
    }

    const emailEsc = escapeHTML(u.email || u.uid || '');
    const emailJs = (u.email || u.uid || '').replace(/'/g, "\\'");
    let actionsHTML = '';

    if (isRootAdmin) {
      actionsHTML = `
        <span class="log-dim" style="font-size: 0.76rem; font-weight: 700; color: #ffd700;">👑 Admin Mestre</span>
        <button type="button" class="admin-btn-action btn-details" data-action="details" data-email="${emailEsc}" onclick="viewUserDetailsAction('${emailJs}')" title="Ver Detalhes">📄 Detalhes</button>
      `;
    } else {
      let statusBtns = '';
      if (statusClean === 'pending') {
        statusBtns = `
          <button type="button" class="admin-btn-action btn-approve" data-action="approve" data-email="${emailEsc}" onclick="approveUserAction('${emailJs}')" title="Aprovar usuário">✅ Aprovar</button>
          <button type="button" class="admin-btn-action btn-reject" data-action="reject" data-email="${emailEsc}" onclick="openRejectUserModal('${emailJs}')" title="Rejeitar usuário com motivo">❌ Rejeitar</button>
        `;
      } else if (statusClean === 'approved') {
        statusBtns = `
          <button type="button" class="admin-btn-action btn-block" data-action="block" data-email="${emailEsc}" onclick="blockUserAction('${emailJs}')" title="Bloquear acesso deste usuário">🚫 Bloquear</button>
        `;
      } else if (statusClean === 'blocked') {
        statusBtns = `
          <button type="button" class="admin-btn-action btn-unblock" data-action="unblock" data-email="${emailEsc}" onclick="unblockUserAction('${emailJs}')" title="Desbloquear acesso deste usuário">🔓 Desbloquear</button>
        `;
      } else if (statusClean === 'rejected') {
        statusBtns = `
          <button type="button" class="admin-btn-action btn-approve" data-action="approve" data-email="${emailEsc}" onclick="approveUserAction('${emailJs}')" title="Reavaliar e aprovar">✅ Aprovar</button>
        `;
      }

      const toggleRoleTitle = roleClean === 'admin' ? 'Rebaixar para Usuário Comum (user)' : 'Promover a Administrador (admin)';
      const toggleRoleText = roleClean === 'admin' ? '👤 Tornar User' : '⭐ Tornar Admin';

      actionsHTML = `
        ${statusBtns}
        <button type="button" class="admin-btn-action btn-role" data-action="role" data-email="${emailEsc}" onclick="toggleRoleUserAction('${emailJs}')" title="${toggleRoleTitle}">${toggleRoleText}</button>
        <button type="button" class="admin-btn-action btn-details" data-action="details" data-email="${emailEsc}" onclick="viewUserDetailsAction('${emailJs}')" title="Ver detalhes completos e auditoria">📄 Detalhes</button>
        <button type="button" class="admin-btn-action btn-edit" data-action="edit" data-email="${emailEsc}" onclick="editUserAction('${emailJs}')" title="Editar dados cadastrais">✏️ Editar</button>
        <button type="button" class="admin-btn-action btn-delete" data-action="delete" data-email="${emailEsc}" onclick="deleteUserAction('${emailJs}')" title="Excluir usuário">🗑️ Excluir</button>
      `;
    }

    tableHTML += `
      <tr>
        <td><strong>${escapeHTML(u.name || '—')}</strong>${isRootAdmin ? ' <span style="color:#ffd700">👑</span>' : ''}</td>
        <td><code>${escapeHTML(u.email || '—')}</code></td>
        <td>${escapeHTML(u.drogaria || '—')}</td>
        <td>${roleBadge}</td>
        <td>${statusBadge}</td>
        <td><small class="log-dim">${dateFormatted}</small></td>
        <td>${modInfo}</td>
        <td><div class="admin-actions-cell">${actionsHTML}</div></td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHTML;
}

// Ação: Aprovar Usuário
async function approveUserAction(emailOrUid) {
  const session = getAuthSession();
  const adminActor = session ? (session.uid || session.user) : 'admin';
  let target = null;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.approveUser === 'function') {
    try {
      target = window.UserDB.approveUser(emailOrUid, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.approveUser:', e);
    }
  }

  if (!target) {
    const users = getRegisteredUsers();
    target = users.find(u => u.email === emailOrUid || u.uid === emailOrUid);
    if (!target) return;

    const nowIso = new Date().toISOString();
    target.status = 'approved';
    target.approvedAt = nowIso;
    target.approvedBy = adminActor;
    target.rejectedAt = null;
    target.rejectedBy = null;
    target.blockedAt = null;
    target.blockedBy = null;
    target.rejectionReason = null;
    target.updatedAt = nowIso;

    addAuditLogEntry(target, 'APPROVAL', 'Usuário aprovado pelo Administrador', adminActor);
    saveRegisteredUsers(users);
  }

  renderAdminUsersTable();
  updateSuperUserToolbar();
  appendLog(`✅ <strong>Usuário Aprovado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.email)}). Acesso liberado no terminal!`, 'log-success');
}

// Ação: Modal e Fluxo de Rejeição com Motivo
function openRejectUserModal(emailOrUid) {
  const target = findUserRecord(emailOrUid);
  if (!target) return;

  if (isSuperUser(emailOrUid)) {
    alert('🛡️ Proteção: O Administrador Mestre não pode ser rejeitado.');
    return;
  }

  const modal = document.getElementById('adminRejectModal');
  const targetEmailInput = document.getElementById('rejectTargetEmail');
  const targetDisplay = document.getElementById('rejectTargetDisplay');
  const reasonInput = document.getElementById('rejectReasonInput');

  if (targetEmailInput) targetEmailInput.value = target.email;
  if (targetDisplay) targetDisplay.textContent = `${target.name} (${target.email})`;
  if (reasonInput) reasonInput.value = '';
  if (modal) modal.hidden = false;
  setTimeout(() => reasonInput?.focus(), 50);
}

function closeAdminRejectModal() {
  const modal = document.getElementById('adminRejectModal');
  if (modal) modal.hidden = true;
}

async function handleConfirmReject(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('rejectTargetEmail');
  const reasonInput = document.getElementById('rejectReasonInput');
  const email = emailInput?.value;
  const reason = reasonInput?.value.trim() || 'Cadastro não aprovado pela administração.';

  if (!email) return;
  await rejectUserAction(email, reason);
  closeAdminRejectModal();
}

async function rejectUserAction(emailOrUid, reason = '') {
  if (isSuperUser(emailOrUid)) {
    alert('🛡️ Proteção: O Administrador Mestre não pode ser rejeitado.');
    return;
  }
  const session = getAuthSession();
  const adminActor = session ? (session.uid || session.user) : 'admin';
  let target = null;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.rejectUser === 'function') {
    try {
      target = window.UserDB.rejectUser(emailOrUid, reason, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.rejectUser:', e);
    }
  }

  if (!target) {
    const users = getRegisteredUsers();
    target = users.find(u => u.email === emailOrUid || u.uid === emailOrUid);
    if (!target) return;

    const nowIso = new Date().toISOString();
    target.status = 'rejected';
    target.rejectedAt = nowIso;
    target.rejectedBy = adminActor;
    target.rejectionReason = reason || 'Não especificado';
    target.updatedAt = nowIso;

    addAuditLogEntry(target, 'REJECTION', `Cadastro recusado. Motivo: ${reason}`, adminActor);
    saveRegisteredUsers(users);
  }

  renderAdminUsersTable();
  updateSuperUserToolbar();
  appendLog(`🚫 <strong>Acesso Rejeitado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.email)}). Motivo: "${escapeHTML(reason)}".`, 'log-warning');
}

// Ação: Bloquear Usuário
async function blockUserAction(emailOrUid) {
  if (isSuperUser(emailOrUid)) {
    alert('🛡️ Proteção: O Administrador Mestre não pode ser bloqueado.');
    return;
  }
  const session = getAuthSession();
  if (session && (session.user === emailOrUid || session.uid === emailOrUid)) {
    alert('🛡️ Você não pode bloquear sua própria conta ativa.');
    return;
  }

  const adminActor = session ? (session.uid || session.user) : 'admin';
  let target = null;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.blockUser === 'function') {
    try {
      target = window.UserDB.blockUser(emailOrUid, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.blockUser:', e);
    }
  }

  if (!target) {
    const users = getRegisteredUsers();
    target = users.find(u => u.email === emailOrUid || u.uid === emailOrUid);
    if (!target) return;

    const nowIso = new Date().toISOString();
    target.status = 'blocked';
    target.blockedAt = nowIso;
    target.blockedBy = adminActor;
    target.updatedAt = nowIso;

    addAuditLogEntry(target, 'BLOCK', 'Usuário bloqueado pelo Administrador', adminActor);
    saveRegisteredUsers(users);
  }

  renderAdminUsersTable();
  updateSuperUserToolbar();
  appendLog(`🚫 <strong>Usuário Bloqueado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.email)}).`, 'log-warning');
}

// Ação: Desbloquear Usuário
async function unblockUserAction(emailOrUid) {
  const session = getAuthSession();
  const adminActor = session ? (session.uid || session.user) : 'admin';
  let target = null;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.unblockUser === 'function') {
    try {
      target = window.UserDB.unblockUser(emailOrUid, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.unblockUser:', e);
    }
  }

  if (!target) {
    const users = getRegisteredUsers();
    target = users.find(u => u.email === emailOrUid || u.uid === emailOrUid);
    if (!target) return;

    const nowIso = new Date().toISOString();
    target.status = 'approved';
    target.approvedAt = nowIso;
    target.approvedBy = adminActor;
    target.blockedAt = null;
    target.blockedBy = null;
    target.updatedAt = nowIso;

    addAuditLogEntry(target, 'UNBLOCK', 'Usuário desbloqueado pelo Administrador', adminActor);
    saveRegisteredUsers(users);
  }

  renderAdminUsersTable();
  updateSuperUserToolbar();
  appendLog(`🔓 <strong>Usuário Desbloqueado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.email)}). Acesso liberado novamente.`, 'log-success');
}

// Ação: Alternar Função (Role) entre 'user' e 'admin'
async function toggleRoleUserAction(emailOrUid) {
  if (isSuperUser(emailOrUid)) {
    alert('🛡️ Proteção: O Administrador Mestre não pode ter sua função alterada.');
    return;
  }
  const session = getAuthSession();
  const adminActor = session ? (session.uid || session.user) : 'admin';
  const current = findUserRecord(emailOrUid);
  if (!current) return;

  const currentRole = normalizeRole(current.role);
  const newRole = currentRole === 'admin' ? 'user' : 'admin';
  let target = null;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.changeRole === 'function') {
    try {
      target = window.UserDB.changeRole(emailOrUid, newRole, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.changeRole:', e);
    }
  }

  if (!target) {
    const users = getRegisteredUsers();
    target = users.find(u => u.email === emailOrUid || u.uid === emailOrUid);
    if (!target) return;

    const nowIso = new Date().toISOString();
    target.role = newRole;
    target.updatedAt = nowIso;
    addAuditLogEntry(target, 'ROLE_CHANGE', `Função alterada de ${currentRole.toUpperCase()} para ${newRole.toUpperCase()}`, adminActor);
    saveRegisteredUsers(users);
  }

  renderAdminUsersTable();
  appendLog(`⭐ <strong>Permissão Atualizada:</strong> ${escapeHTML(target.name)} agora possui função <strong>${newRole.toUpperCase()}</strong>.`, 'log-info');
}

// Ação: Visualizar Detalhes e Histórico de Auditoria do Usuário
function viewUserDetailsAction(emailOrUid) {
  const target = findUserRecord(emailOrUid);
  if (!target) return;

  const modal = document.getElementById('adminUserDetailsModal');
  const content = document.getElementById('adminUserDetailsContent');
  if (!modal || !content) return;

  const statusClean = normalizeStatus(target.status);
  const roleClean = normalizeRole(target.role);

  let auditHTML = '<p class="log-dim" style="font-size:0.75rem;">Nenhum evento registrado no histórico.</p>';
  if (Array.isArray(target.auditLog) && target.auditLog.length) {
    auditHTML = `
      <ul class="admin-audit-list">
        ${target.auditLog.map(item => `
          <li class="admin-audit-item">
            <strong>[${new Date(item.timestamp).toLocaleString('pt-BR')}] ${escapeHTML(item.action)}</strong>: ${escapeHTML(item.details)} 
            <span class="log-dim">(${escapeHTML(item.performedBy)})</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  content.innerHTML = `
    <div class="admin-detail-grid">
      <span class="admin-detail-key">UID:</span>
      <span class="admin-detail-val"><code>${escapeHTML(target.uid || '—')}</code></span>

      <span class="admin-detail-key">Nome:</span>
      <span class="admin-detail-val"><strong>${escapeHTML(target.name || '—')}</strong></span>

      <span class="admin-detail-key">E-mail:</span>
      <span class="admin-detail-val"><code>${escapeHTML(target.email || '—')}</code></span>

      <span class="admin-detail-key">Drogaria / Filial:</span>
      <span class="admin-detail-val">${escapeHTML(target.drogaria || '—')}</span>

      <span class="admin-detail-key">Função (Role):</span>
      <span class="admin-detail-val"><strong style="color:#ffd700">${roleClean.toUpperCase()}</strong></span>

      <span class="admin-detail-key">Status Atual:</span>
      <span class="admin-detail-val"><strong style="color:var(--prompt-color)">${statusClean.toUpperCase()}</strong></span>

      <span class="admin-detail-key">Data de Cadastro:</span>
      <span class="admin-detail-val">${target.createdAt ? new Date(target.createdAt).toLocaleString('pt-BR') : '—'}</span>

      <span class="admin-detail-key">Última Atualização:</span>
      <span class="admin-detail-val">${target.updatedAt ? new Date(target.updatedAt).toLocaleString('pt-BR') : '—'}</span>

      <span class="admin-detail-key">Aprovado em / por:</span>
      <span class="admin-detail-val">${target.approvedAt ? `${new Date(target.approvedAt).toLocaleString('pt-BR')} (por ${escapeHTML(target.approvedBy || 'admin')})` : '—'}</span>

      <span class="admin-detail-key">Rejeitado em / por:</span>
      <span class="admin-detail-val">${target.rejectedAt ? `${new Date(target.rejectedAt).toLocaleString('pt-BR')} (por ${escapeHTML(target.rejectedBy || 'admin')})` : '—'}</span>

      ${target.rejectionReason ? `
        <span class="admin-detail-key">Motivo Rejeição:</span>
        <span class="admin-detail-val" style="color:#ff6666">${escapeHTML(target.rejectionReason)}</span>
      ` : ''}

      <span class="admin-detail-key">Bloqueado em / por:</span>
      <span class="admin-detail-val">${target.blockedAt ? `${new Date(target.blockedAt).toLocaleString('pt-BR')} (por ${escapeHTML(target.blockedBy || 'admin')})` : '—'}</span>
    </div>

    <div class="admin-audit-section">
      <div class="admin-audit-title">📜 Histórico de Alterações Administrativas (Auditoria)</div>
      ${auditHTML}
    </div>
  `;

  modal.hidden = false;
}

function closeAdminDetailsModal() {
  const modal = document.getElementById('adminUserDetailsModal');
  if (modal) modal.hidden = true;
}

async function editUserAction(emailOrUid) {
  const users = getRegisteredUsers();
  const target = users.find(u => 
    (u.email && u.email.toLowerCase() === String(emailOrUid).toLowerCase()) ||
    (u.uid && u.uid === emailOrUid)
  );
  if (!target) {
    alert('Usuário não encontrado para edição.');
    return;
  }

  const newName = prompt(`Editar Nome do Usuário (${target.email}):`, target.name);
  if (newName === null) return;
  const newDrogaria = prompt(`Editar Drogaria/Filial (${target.email}):`, target.drogaria);
  if (newDrogaria === null) return;

  const session = getAuthSession();
  const adminActor = session ? (session.uid || session.user) : 'admin';
  const nowIso = new Date().toISOString();

  if (newName.trim()) target.name = newName.trim();
  if (newDrogaria.trim()) target.drogaria = newDrogaria.trim();
  target.updatedAt = nowIso;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.updateUser === 'function') {
    try {
      window.UserDB.updateUser(target.uid || target.email, { name: target.name, drogaria: target.drogaria }, adminActor);
    } catch (e) {
      console.warn('Falha no UserDB.updateUser:', e);
    }
  } else {
    addAuditLogEntry(target, 'EDIT_PROFILE', `Nome alterado para "${target.name}", filial para "${target.drogaria}"`, adminActor);
    saveRegisteredUsers(users);
  }

  const currentSession = getAuthSession();
  if (currentSession && (currentSession.user === target.email || currentSession.uid === target.uid)) {
    currentSession.name = target.name;
    currentSession.drogaria = target.drogaria;
    setAuthSession(currentSession, true);
    applyUserSessionProfile(currentSession);
  }

  renderAdminUsersTable();
  appendLog(`✏️ <strong>Cadastro atualizado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.drogaria)}).`, 'log-info');
}

async function deleteUserAction(emailOrUid) {
  const session = getAuthSession();
  const isSuper = session && (session.role === 'admin' || isSuperUser(session.user) || isSuperUser(session.uid));
  if (!isSuper) {
    alert('⚠️ Apenas Administradores têm permissão para deletar usuários.');
    appendLog('⚠️ Apenas <strong>Administradores</strong> têm permissão para deletar usuários.', 'log-error');
    return false;
  }

  const users = getRegisteredUsers();
  const target = users.find(u => 
    (u.email && u.email.toLowerCase() === String(emailOrUid).toLowerCase()) ||
    (u.uid && u.uid === emailOrUid)
  );

  if (!target) {
    alert(`Usuário "${emailOrUid}" não encontrado para exclusão.`);
    appendLog(`⚠️ Usuário "${escapeHTML(emailOrUid)}" não encontrado para exclusão.`, 'log-warning');
    return false;
  }

  if (target.email === 'admin@drogasil.com.br' || target.uid === 'admin-master-001') {
    alert('🛡️ Proteção de Segurança: O Administrador Mestre inicial não pode ser excluído.');
    appendLog(`🛡️ Operação negada: O Administrador Mestre inicial não pode ser deletado.`, 'log-warning');
    return false;
  }

  const confirmMsg = `⚠️ ATENÇÃO - EXCLUSÃO PERMANENTE:\n\n` +
    `Deseja realmente DELETAR o usuário:\n` +
    `• Nome: ${target.name}\n` +
    `• E-mail: ${target.email}\n` +
    `• Status Atual: ${String(target.status).toUpperCase()}\n\n` +
    `Esta ação é irreversível e removerá o cadastro no banco de dados.`;

  if (!confirm(confirmMsg)) return false;

  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.deleteUser === 'function') {
    try {
      window.UserDB.deleteUser(target.uid || target.email, session.uid || session.user);
    } catch (e) {
      console.warn('Falha no UserDB.deleteUser:', e);
    }
  }

  const filtered = users.filter(u => u.email !== target.email && u.uid !== target.uid);
  saveRegisteredUsers(filtered);

  if (session.user === target.email || session.uid === target.uid) {
    clearAuthSession();
    updateAuthStateUI(null);
  }

  renderAdminUsersTable();
  updateSuperUserToolbar();
  appendLog(`🗑️ <strong>Usuário deletado:</strong> ${escapeHTML(target.name)} (${escapeHTML(target.email)}).`, 'log-warning');
  return true;
}

function openLoginAboutModal() {
  const modal = document.getElementById('loginAboutModal');
  if (modal) {
    modal.hidden = false;
  }
}

function closeLoginAboutModal() {
  const modal = document.getElementById('loginAboutModal');
  if (modal) {
    modal.hidden = true;
  }
}

// Expõe ações globais para cliques inline no HTML
if (typeof window !== 'undefined') {
  window.approveUserAction = approveUserAction;
  window.rejectUserAction = rejectUserAction;
  window.openLoginAboutModal = openLoginAboutModal;
  window.closeLoginAboutModal = closeLoginAboutModal;
  window.openRejectUserModal = openRejectUserModal;
  window.closeAdminRejectModal = closeAdminRejectModal;
  window.handleConfirmReject = handleConfirmReject;
  window.blockUserAction = blockUserAction;
  window.unblockUserAction = unblockUserAction;
  window.toggleRoleUserAction = toggleRoleUserAction;
  window.viewUserDetailsAction = viewUserDetailsAction;
  window.closeAdminDetailsModal = closeAdminDetailsModal;
  window.editUserAction = editUserAction;
  window.deleteUserAction = deleteUserAction;
  window.openAdminUsersPanel = openAdminUsersPanel;
  window.closeAdminUsersPanel = closeAdminUsersPanel;
  window.setAdminFilter = setAdminFilter;
  window.switchAuthTab = switchAuthTab;
  window.handleLoginSubmit = handleLoginSubmit;
  window.handleRegisterSubmit = handleRegisterSubmit;
  window.toggleLoginPassVisibility = toggleLoginPassVisibility;
  window.toggleRegisterPassVisibility = toggleRegisterPassVisibility;
  window.toggleTheme = toggleTheme;
  window.toggleCRT = toggleCRT;
  window.logoutUser = logoutUser;
  window.startWizard = startWizard;
  window.startBatchWizard = startBatchWizard;
  window.openCampaignModal = openCampaignModal;
  window.closeCampaignModal = closeCampaignModal;
  window.toggleCampaignActive = toggleCampaignActive;
  window.applyCampaignPreset = applyCampaignPreset;
  window.toggleServiceTag = toggleServiceTag;
  window.updateCampaignPreview = updateCampaignPreview;
  window.handleSaveCampaign = handleSaveCampaign;
  window.deactivateCampaign = deactivateCampaign;
  window.executeCommand = executeCommand;
  window.openUserProfileModal = openUserProfileModal;
  window.closeUserProfileModal = closeUserProfileModal;
  window.openGeminiConfigPanel = openGeminiConfigPanel;
  window.closeGeminiConfigPanel = closeGeminiConfigPanel;
  window.handleGeminiSave = handleGeminiSave;
  window.handleGeminiRemove = handleGeminiRemove;
  window.handleGeminiTest = handleGeminiTest;
  window.showServicesHelp = showServicesHelp;
  window.showAbout = showAbout;
  window.showHistory = showHistory;
  window.cancelWizard = cancelWizard;
}

async function initializeAuth() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabRegisterBtn = document.getElementById('tabRegisterBtn');
  const loginPassToggle = document.getElementById('loginPassToggle');
  const regPassToggle = document.getElementById('regPassToggle');
  const loginThemeBtn = document.getElementById('loginThemeBtn');
  const loginAboutBtn = document.getElementById('loginAboutBtn');
  const loginAboutFooterBtn = document.getElementById('loginAboutFooterBtn');
  const loginAboutCloseBtn = document.getElementById('loginAboutCloseBtn');
  const loginAboutOkBtn = document.getElementById('loginAboutOkBtn');
  const loginAboutBackdrop = document.getElementById('loginAboutBackdrop');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminUsersBtn = document.getElementById('adminUsersBtn');
  const adminUsersCloseBtn = document.getElementById('adminUsersCloseBtn');
  const adminSearchInput = document.getElementById('adminSearchInput');
  const adminSearchClearBtn = document.getElementById('adminSearchClearBtn');

  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);

  if (loginPassToggle) loginPassToggle.addEventListener('click', toggleLoginPassVisibility);
  if (regPassToggle) regPassToggle.addEventListener('click', toggleRegisterPassVisibility);

  if (loginThemeBtn) loginThemeBtn.addEventListener('click', toggleTheme);
  if (loginAboutBtn) loginAboutBtn.addEventListener('click', openLoginAboutModal);
  if (loginAboutFooterBtn) loginAboutFooterBtn.addEventListener('click', openLoginAboutModal);
  if (loginAboutCloseBtn) loginAboutCloseBtn.addEventListener('click', closeLoginAboutModal);
  if (loginAboutOkBtn) loginAboutOkBtn.addEventListener('click', closeLoginAboutModal);
  if (loginAboutBackdrop) loginAboutBackdrop.addEventListener('click', closeLoginAboutModal);
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  if (adminUsersBtn) adminUsersBtn.addEventListener('click', openAdminUsersPanel);
  if (adminUsersCloseBtn) adminUsersCloseBtn.addEventListener('click', closeAdminUsersPanel);

  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      if (adminSearchClearBtn) {
        adminSearchClearBtn.style.display = adminSearchQuery ? 'block' : 'none';
      }
      renderAdminUsersTable();
    });
  }

  if (adminSearchClearBtn) {
    adminSearchClearBtn.addEventListener('click', () => {
      adminSearchQuery = '';
      if (adminSearchInput) adminSearchInput.value = '';
      adminSearchClearBtn.style.display = 'none';
      renderAdminUsersTable();
    });
  }

  const adminTableContainer = document.getElementById('adminUsersTableContainer');
  if (adminTableContainer) {
    adminTableContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-btn-action');
      if (!btn) return;
      const action = btn.dataset.action;
      const email = btn.dataset.email;
      if (!action || !email) return;
      e.preventDefault();
      switch (action) {
        case 'approve': approveUserAction(email); break;
        case 'reject': openRejectUserModal(email); break;
        case 'block': blockUserAction(email); break;
        case 'unblock': unblockUserAction(email); break;
        case 'role': toggleRoleUserAction(email); break;
        case 'details': viewUserDetailsAction(email); break;
        case 'edit': editUserAction(email); break;
        case 'delete': deleteUserAction(email); break;
      }
    });
  }

  document.querySelectorAll('[data-admin-close]').forEach(el => {
    el.addEventListener('click', closeAdminUsersPanel);
  });

  // Listeners do Modal Meu Perfil & Redefinição de Credenciais
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userProfileCloseBtn = document.getElementById('userProfileCloseBtn');
  const userProfileBackdrop = document.getElementById('userProfileBackdrop');
  const profilePassCancelBtn = document.getElementById('profilePassCancelBtn');
  const profileDataCancelBtn = document.getElementById('profileDataCancelBtn');
  const tabProfilePassBtn = document.getElementById('tabProfilePassBtn');
  const tabProfileDataBtn = document.getElementById('tabProfileDataBtn');
  const profileChangePassForm = document.getElementById('profileChangePassForm');
  const profileUpdateDataForm = document.getElementById('profileUpdateDataForm');
  const profileCurrentPassToggle = document.getElementById('profileCurrentPassToggle');
  const profileNewPassToggle = document.getElementById('profileNewPassToggle');
  const profileConfirmPassToggle = document.getElementById('profileConfirmPassToggle');

  if (userProfileBtn) userProfileBtn.addEventListener('click', openUserProfileModal);
  if (userProfileCloseBtn) userProfileCloseBtn.addEventListener('click', closeUserProfileModal);
  if (userProfileBackdrop) userProfileBackdrop.addEventListener('click', closeUserProfileModal);
  if (profilePassCancelBtn) profilePassCancelBtn.addEventListener('click', closeUserProfileModal);
  if (profileDataCancelBtn) profileDataCancelBtn.addEventListener('click', closeUserProfileModal);

  if (tabProfilePassBtn) tabProfilePassBtn.addEventListener('click', () => switchProfileTab('pass'));
  if (tabProfileDataBtn) tabProfileDataBtn.addEventListener('click', () => switchProfileTab('data'));

  if (profileChangePassForm) profileChangePassForm.addEventListener('submit', handleProfilePasswordChangeSubmit);
  if (profileUpdateDataForm) profileUpdateDataForm.addEventListener('submit', handleProfileUpdateSubmit);

  if (profileCurrentPassToggle) profileCurrentPassToggle.addEventListener('click', () => togglePasswordInputVisibility('profileCurrentPassInput', 'profileCurrentPassToggle'));
  if (profileNewPassToggle) profileNewPassToggle.addEventListener('click', () => togglePasswordInputVisibility('profileNewPassInput', 'profileNewPassToggle'));
  if (profileConfirmPassToggle) profileConfirmPassToggle.addEventListener('click', () => togglePasswordInputVisibility('profileConfirmNewPassInput', 'profileConfirmPassToggle'));

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', checkAdminUrlRoute);
    window.addEventListener('popstate', checkAdminUrlRoute);
  }

  // Inicializa o banco de dados de usuários
  if (typeof window !== 'undefined' && window.UserDB && typeof window.UserDB.initialize === 'function') {
    try {
      await window.UserDB.initialize();
    } catch (e) {
      console.warn('Aviso ao inicializar UserDB:', e);
    }
  }

  const session = getAuthSession();
  if (session && session.user) {
    const user = findUserRecord(session.user) || findUserRecord(session.uid);
    if (user) {
      const currentStatus = normalizeStatus(user.status);
      const isSuper = user.role === 'admin' || isSuperUser(user.email);
      if (!isSuper && currentStatus !== 'approved') {
        clearAuthSession();
        updateAuthStateUI(null);
        showLoginFeedback('⏳ Sua conta está com acesso pendente ou foi alterada pelo administrador.', 'is-warning');
        return;
      }
    }
  }
  updateAuthStateUI(session);
}

// Inicialização principal da aplicação
function startMainApp() {
  resolveDOMElements();
  renderWelcomeBanner();
  updateHistoryCounter();
  updateAIStatus();
  initializeAuth();

  // Event Listeners
  if (cliInput) cliInput.addEventListener('keydown', handleInputKeydown);
  
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (crtToggleBtn) crtToggleBtn.addEventListener('click', toggleCRT);
  initializeGeminiConfigPanel();
  initializeCampaignModule();
  
  // Manter foco no terminal ao clicar na tela (apenas no Desktop com mouse para não abrir teclado indesejado no celular)
  const appContainer = document.querySelector('.app-container');
  if (appContainer) {
    appContainer.addEventListener('click', (e) => {
      const loginPanel = document.getElementById('loginPanel');
      if (loginPanel && !loginPanel.hidden) return;
      const isTouchDevice = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (!isTouchDevice && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        cliInput?.focus();
      }
    });
  }
}

// Atualiza o contador de mensagens
function updateHistoryCounter() {
  const count = generatedMessagesHistory.length;
  if (historyCounter) {
    historyCounter.innerHTML = `📋 Histórico: <strong>${count}</strong> mensagem(ns)`;
  }
}

const THEME_META_COLORS = {
  matrix: '#0a0d0a',
  amber: '#0d0a04',
  cyberpunk: '#090614',
  dark: '#121417'
};

function applyTheme(themeName) {
  if (!THEMES.includes(themeName)) return;
  currentThemeIndex = THEMES.indexOf(themeName);
  document.body.className = `theme-${themeName}`;
  const metaTheme = document.getElementById('metaThemeColor');
  if (metaTheme && THEME_META_COLORS[themeName]) {
    metaTheme.setAttribute('content', THEME_META_COLORS[themeName]);
  }
}

// Alternar Temas
function toggleTheme() {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  const newTheme = THEMES[currentThemeIndex];
  applyTheme(newTheme);
  appendLog(`🎨 Tema alterado para: <strong class="log-info">${newTheme.toUpperCase()}</strong>`, 'log-info');
}

// Alternar Efeito CRT
function toggleCRT() {
  const overlay = crtOverlay || (typeof document !== 'undefined' ? document.getElementById('crtOverlay') : null);
  const btn = crtToggleBtn || (typeof document !== 'undefined' ? document.getElementById('crtToggleBtn') : null);
  if (overlay) {
    overlay.classList.toggle('disabled');
    const isActive = !overlay.classList.contains('disabled');
    if (btn) btn.classList.toggle('active', isActive);
    appendLog(`📺 Efeito CRT Scanlines: <strong>${isActive ? 'ATIVADO' : 'DESATIVADO'}</strong>`, 'log-info');
  }
}

// Imprimir Banner Inicial
function renderWelcomeBanner() {
  resolveDOMElements();
  const drogaria = escapeHTML(DEFAULT_CONFIG.drogaria || 'Drogaria');
  const farmaceutico = escapeHTML(DEFAULT_CONFIG.farmaceutico || 'Farmacêutico');
  const bannerHTML = `
    <div class="welcome-banner">
      <div class="welcome-title">
        <span>💊 Apoio ao Tratamento v3.3</span>
        <span class="badge-tag" id="welcomeDrogariaBadge">${drogaria}</span>
        <span class="badge-tag" id="welcomeFarmaceuticoBadge">Farmacêutico: ${farmaceutico}</span>
      </div>
      <p class="log-dim">Gerador de mensagens humanizadas e personalizadas de acompanhamento farmacêutico pós-venda / pós-tratamento.</p>
      <div class="welcome-creator">
        <span>👨‍⚕️💻 Criado pelo desenvolvedor e farmacêutico <strong>Maxwell Rodrigues Ferreira</strong> · Inscrito no <strong>CRF-SP nº 86426</strong></span>
      </div>
      <p style="margin-top: 8px;">✨ <strong>Como começar:</strong> Clique nos botões acima ou digite <code class="log-info">novo</code>, <code class="log-info">lote</code>, <code class="log-info">campanha</code> ou <code class="log-info">sobre</code> no terminal abaixo.</p>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = bannerHTML;
  const out = terminalOutput || (typeof document !== 'undefined' ? document.getElementById('terminalOutput') : null);
  if (out) {
    out.appendChild(div);
  }
  renderCampaignActiveBanner();
  scrollToBottom();
}

/* ==========================================================================
   MÓDULO DE GESTÃO DE CAMPANHAS DE SAÚDE (GLICEMIA, PRESSÃO, BIOIMPEDÂNCIA)
   ========================================================================== */

const CAMPAIGN_PRESETS = {
  pressao: {
    id: 'pressao',
    name: 'Campanha de Aferição de Pressão Arterial Gratuita',
    icon: '🩺',
    period: 'nesta semana',
    services: ['Aferição de Pressão Gratuita'],
    highlightText: 'Aproveite para passar na farmácia esta semana para realizar gratuitamente sua aferição de pressão arterial com nossa equipe farmacêutica!',
    extraNote: 'Atendimento rápido e preventivo para cuidar da sua saúde cardiovascular.'
  },
  glicemia: {
    id: 'glicemia',
    name: 'Campanha de Teste de Glicemia Capilar Gratuito',
    icon: '🩸',
    period: 'nesta semana',
    services: ['Teste de Glicemia Capilar Gratuito'],
    highlightText: 'Venha realizar seu teste de glicemia capilar gratuito na farmácia e receba orientações personalizadas para o controle do açúcar no sangue!',
    extraNote: 'Monitore sua glicose de forma rápida e segura com nossos farmacêuticos.'
  },
  bioimpedancia: {
    id: 'bioimpedancia',
    name: 'Semana da Avaliação Corporal & Bioimpedância Gratuita',
    icon: '⚖️',
    period: 'durante este mês',
    services: ['Exame de Bioimpedância Gratuito'],
    highlightText: 'Estamos realizando o exame de bioimpedância gratuito na drogaria para você acompanhar sua massa magra, porcentagem de gordura e hidratação!',
    extraNote: 'Relatório completo e orientações farmacêuticas imediatas.'
  },
  orientacao: {
    id: 'orientacao',
    name: 'Campanha de Orientação Farmacêutica & Cuidado Continuado Gratuito',
    icon: '👨‍⚕️',
    period: 'nesta semana',
    services: ['Orientação Farmacêutica Especializada Gratuita'],
    highlightText: 'Traga suas dúvidas sobre horários e combinações de remédios para uma conversa e orientação farmacêutica 100% gratuita na nossa farmácia!',
    extraNote: 'Segurança e eficácia no seu tratamento diário.'
  },
  furo: {
    id: 'furo',
    name: 'Ação de Perfuração de Lóbulo Auricular (Furo de Orelha) Humanizado',
    icon: '👂',
    period: 'neste período',
    services: ['Perfuração do Lóbulo Auricular Gratuita'],
    highlightText: 'Oferecemos colocação humanizada de brincos e perfuração de lóbulo com materiais 100% estéreis e todo o carinho que você e seu bebê merecem!',
    extraNote: 'Procedimento asséptico, silencioso e seguro realizado por farmacêuticos.'
  },
  injetaveis: {
    id: 'injetaveis',
    name: 'Serviço Clínico de Aplicação Segura de Medicamentos Injetáveis',
    icon: '💉',
    period: 'todos os dias',
    services: ['Aplicação de Injetáveis'],
    highlightText: 'Realizamos a aplicação do seu medicamento injetável com receita médica em nossa sala de atendimento farmacêutico climatizada!',
    extraNote: 'Profissionalismo, técnica asséptica e total segurança para seu tratamento.'
  },
  combo: {
    id: 'combo',
    name: 'Semana da Saúde Total: Pressão, Glicemia & Bioimpedância Gratuitas',
    icon: '🌟',
    period: 'nesta semana',
    services: ['Aferição de Pressão Gratuita', 'Teste de Glicemia Capilar Gratuito', 'Exame de Bioimpedância Gratuito', 'Orientação Farmacêutica Especializada Gratuita'],
    highlightText: 'Aproveite nossa Semana da Saúde Total com aferição de pressão, teste de glicemia e exame de bioimpedância 100% gratuitos na drogaria!',
    extraNote: 'Avaliação clínica completa para toda a família.'
  },
  cardio: {
    id: 'cardio',
    name: 'Campanha de Saúde Cardiovascular & Aferição de Pressão Gratuita',
    icon: '🩺',
    period: 'nesta semana',
    services: ['Aferição de Pressão Gratuita', 'Teste de Glicemia Capilar Gratuito'],
    highlightText: 'Aproveite para passar na farmácia esta semana para realizar gratuitamente sua aferição de pressão arterial e teste de glicemia com nossa equipe farmacêutica!',
    extraNote: 'Atendimento preventivo e rápido para monitorar sua saúde de perto.'
  },
  diabetes: {
    id: 'diabetes',
    name: 'Campanha de Prevenção ao Diabetes & Glicemia Gratuita',
    icon: '🩸',
    period: 'neste mês',
    services: ['Teste de Glicemia Capilar Gratuito', 'Orientação Farmacêutica Especializada Gratuita'],
    highlightText: 'Participe da nossa ação especial de prevenção ao diabetes com teste de glicemia gratuito e orientações de saúde na farmácia!',
    extraNote: 'Cuidado contínuo e acolhimento para sua qualidade de vida.'
  },
  custom: {
    id: 'custom',
    name: 'Campanha de Serviços Farmacêuticos Gratuitos',
    icon: '✨',
    period: 'neste período',
    services: ['Aferição de Pressão Gratuita', 'Teste de Glicemia Capilar Gratuito'],
    highlightText: 'Venha conferir nossos serviços de saúde gratuitos e orientações farmacêuticas especiais na drogaria!',
    extraNote: 'Esperamos por você para cuidar do seu bem-estar.'
  }
};

const DEFAULT_CAMPAIGN_STATE = {
  enabled: true,
  id: 'pressao',
  name: 'Campanha de Aferição de Pressão Arterial Gratuita',
  icon: '🩺',
  period: 'nesta semana',
  services: ['Aferição de Pressão Gratuita'],
  highlightText: 'Aproveite para passar na farmácia esta semana para realizar gratuitamente sua aferição de pressão arterial com nossa equipe farmacêutica!',
  extraNote: 'Atendimento humanizado e 100% gratuito para toda a família.'
};

function getActiveCampaign() {
  try {
    const raw = localStorage.getItem('apoio_active_campaign');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('Erro ao recuperar campanha ativa:', e);
  }
  return { ...DEFAULT_CAMPAIGN_STATE };
}

function saveActiveCampaign(campaign) {
  try {
    localStorage.setItem('apoio_active_campaign', JSON.stringify(campaign));
  } catch (e) {
    console.error('Erro ao persistir campanha:', e);
  }
  if (typeof updateCampaignUIStatus === 'function') updateCampaignUIStatus();
  if (typeof renderCampaignActiveBanner === 'function') renderCampaignActiveBanner();
  const wizBox = typeof document !== 'undefined' ? document.getElementById('wizardBox') : null;
  if (wizBox && typeof startBatchWizard === 'function') {
    startBatchWizard();
  }
}

function isCampaignActive() {
  const camp = getActiveCampaign();
  return Boolean(camp && camp.enabled);
}

function formatCampaignMessageBlock(campaign, drogaria = '') {
  if (!campaign || !campaign.enabled) return '';
  const drogStr = drogaria ? ` na ${drogaria}` : '';
  const servicesStr = (campaign.services && campaign.services.length) ? ` (${campaign.services.join(' • ')})` : '';
  const periodStr = campaign.period ? ` _[${campaign.period}]_` : '';
  
  return `\n\n📢 *${campaign.icon || '🎯'} Ação de Saúde 100% Gratuita${drogStr}:* *${campaign.name}*${periodStr}!\n` +
         `👉 ${campaign.highlightText}${servicesStr ? '\n✨ *Serviços 100% Gratuitos:* ' + campaign.services.join(', ') : ''}`;
}

function updateCampaignUIStatus() {
  const camp = getActiveCampaign();
  const badge = document.getElementById('campaignToolbarBadge');
  const btn = document.getElementById('campaignToolbarBtn');
  
  if (badge) {
    if (camp && camp.enabled) {
      badge.style.display = 'inline-block';
      badge.textContent = '1 ATIVA';
      badge.className = 'badge-counter badge-campaign';
    } else {
      badge.style.display = 'none';
    }
  }

  if (btn) {
    btn.classList.toggle('active', Boolean(camp && camp.enabled));
  }
}

function renderCampaignActiveBanner() {
  const existing = document.getElementById('campaignActiveBanner');
  if (existing && typeof existing.remove === 'function') {
    existing.remove();
  }

  const camp = getActiveCampaign();
  if (!camp || !camp.enabled) return;

  const servicesText = (camp.services && camp.services.length) ? camp.services.join(' • ') : 'Serviços Gratuitos';
  const periodText = camp.period ? ` (${camp.period})` : '';

  const bannerDiv = document.createElement('div');
  bannerDiv.className = 'campaign-active-banner';
  bannerDiv.id = 'campaignActiveBanner';
  bannerDiv.innerHTML = `
    <div class="campaign-active-banner-content">
      <span class="campaign-active-icon">${escapeHTML(camp.icon || '🎯')}</span>
      <div>
        <div class="campaign-active-title">
          <span>📢 CAMPANHA ATIVA: <strong>${escapeHTML(camp.name)}</strong></span>
          <span class="badge-tag" style="background: #00ff66; color: #000; font-weight: 700; font-size: 0.65rem;">DESTAQUE ATIVADO</span>
        </div>
        <div class="campaign-active-services">
          ✨ <strong>${escapeHTML(servicesText)}</strong>${escapeHTML(periodText)} &bull; ${escapeHTML(camp.highlightText)}
        </div>
      </div>
    </div>
    <div class="campaign-active-actions">
      <button type="button" class="tool-btn" onclick="openCampaignModal()" style="font-size: 0.74rem; padding: 4px 10px;">⚙️ Gerenciar</button>
      <button type="button" class="tool-btn danger" onclick="deactivateCampaign()" title="Desativar campanha" style="font-size: 0.74rem; padding: 4px 8px;">✕</button>
    </div>
  `;

  // Inserir no topo do terminal após o banner inicial, se houver
  const out = terminalOutput || (typeof document !== 'undefined' ? document.getElementById('terminalOutput') : null);
  if (out) {
    const welcome = typeof out.querySelector === 'function' ? out.querySelector('.welcome-banner') : null;
    if (welcome && welcome.nextSibling && typeof out.insertBefore === 'function') {
      out.insertBefore(bannerDiv, welcome.nextSibling);
    } else if (out.firstChild && typeof out.insertBefore === 'function') {
      out.insertBefore(bannerDiv, out.firstChild);
    } else if (typeof out.appendChild === 'function') {
      out.appendChild(bannerDiv);
    }
  }
}

function openCampaignModal() {
  const panel = document.getElementById('campaignPanel');
  if (!panel) return;
  panel.hidden = false;

  const camp = getActiveCampaign();
  const nameInput = document.getElementById('campaignNameInput');
  const periodInput = document.getElementById('campaignPeriodInput');
  const iconSelect = document.getElementById('campaignIconSelect');
  const highlightInput = document.getElementById('campaignHighlightInput');
  const toggleSwitch = document.getElementById('campaignToggleSwitch');
  const deactivateBtn = document.getElementById('campaignDeactivateActionBtn');
  const saveBtn = document.getElementById('campaignSaveBtn');

  if (nameInput) nameInput.value = camp.name || '';
  if (periodInput) periodInput.value = camp.period || '';
  if (iconSelect) iconSelect.value = camp.icon || '🩺';
  if (highlightInput) highlightInput.value = camp.highlightText || '';
  if (toggleSwitch) toggleSwitch.checked = Boolean(camp.enabled);

  if (deactivateBtn) deactivateBtn.style.display = camp.enabled ? 'inline-block' : 'none';
  if (saveBtn) saveBtn.textContent = camp.enabled ? '🚀 Salvar & Ativar Campanha' : '💾 Salvar Configurações';

  toggleCampaignActive(Boolean(camp.enabled));

  // Atualizar chips de serviços selecionados
  const container = document.getElementById('campaignServicesTags');
  if (container) {
    const chips = container.querySelectorAll('.service-chip');
    chips.forEach(chip => {
      const sName = chip.dataset.service;
      const isSelected = Array.isArray(camp.services) && camp.services.includes(sName);
      chip.classList.toggle('active', isSelected);
    });
  }

  // Atualizar preset ativo se houver correspondência
  document.querySelectorAll('.campaign-preset-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === camp.id);
  });

  updateCampaignPreview();
}

function closeCampaignModal() {
  const panel = document.getElementById('campaignPanel');
  if (panel) panel.hidden = true;
  const input = document.getElementById('cliInput');
  if (input) {
    setTimeout(() => {
      input.focus();
      scrollToBottom();
    }, 50);
  }
}

function toggleCampaignActive(isChecked) {
  const camp = getActiveCampaign();
  camp.enabled = Boolean(isChecked);
  saveActiveCampaign(camp);

  const statusBox = document.getElementById('campaignStatusBox');
  const statusDot = document.getElementById('campaignStatusDot');
  const statusLabel = document.getElementById('campaignStatusLabel');
  const statusPill = document.getElementById('campaignStatusPill');
  const statusDesc = document.getElementById('campaignStatusDesc');
  const deactivateBtn = document.getElementById('campaignDeactivateActionBtn');
  const saveBtn = document.getElementById('campaignSaveBtn');

  if (statusBox) statusBox.classList.toggle('is-active', isChecked);
  if (statusDot) statusDot.classList.toggle('is-active', isChecked);
  if (statusPill) {
    statusPill.classList.toggle('is-active', isChecked);
    statusPill.textContent = isChecked ? '🟢 ATIVA' : '⚪ INATIVA';
  }
  if (statusLabel) {
    statusLabel.textContent = isChecked ? 'Campanha Ativa e em Destaque' : 'Campanha Desativada';
  }
  if (statusDesc) {
    statusDesc.textContent = isChecked 
      ? 'Os convites dos serviços selecionados estão sendo anexados nas mensagens geradas em lote.' 
      : 'Nenhuma campanha em vigor. As mensagens geradas não incluirão convites adicionais.';
  }

  if (deactivateBtn) {
    deactivateBtn.style.display = isChecked ? 'inline-block' : 'none';
  }
  if (saveBtn) {
    saveBtn.textContent = isChecked ? '🚀 Salvar & Ativar Campanha' : '💾 Salvar Configurações';
  }

  updateCampaignUIStatus();
  updateCampaignPreview();
}

function applyCampaignPreset(presetId) {
  const preset = CAMPAIGN_PRESETS[presetId];
  if (!preset) return;

  const nameInput = document.getElementById('campaignNameInput');
  const periodInput = document.getElementById('campaignPeriodInput');
  const iconSelect = document.getElementById('campaignIconSelect');
  const highlightInput = document.getElementById('campaignHighlightInput');
  const toggleSwitch = document.getElementById('campaignToggleSwitch');

  if (nameInput) nameInput.value = preset.name;
  if (periodInput) periodInput.value = preset.period;
  if (iconSelect) iconSelect.value = preset.icon;
  if (highlightInput) highlightInput.value = preset.highlightText;
  if (toggleSwitch) toggleSwitch.checked = true;

  toggleCampaignActive(true);

  // Atualizar seleção visual de cada chip de serviço
  const container = document.getElementById('campaignServicesTags');
  if (container) {
    const chips = container.querySelectorAll('.service-chip');
    chips.forEach(chip => {
      const sName = chip.dataset.service;
      const isIncluded = Array.isArray(preset.services) && preset.services.includes(sName);
      chip.classList.toggle('active', isIncluded);
    });
  }

  // Atualizar seleção visual do preset selecionado
  document.querySelectorAll('.campaign-preset-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetId);
  });

  updateCampaignPreview();
}

function toggleServiceTag(chipEl) {
  if (!chipEl) return;
  chipEl.classList.toggle('active');

  const selectedServices = getSelectedServicesFromModal();
  document.querySelectorAll('.campaign-preset-card').forEach(btn => {
    const p = CAMPAIGN_PRESETS[btn.dataset.preset];
    if (p && Array.isArray(p.services)) {
      const isMatch = p.services.length === selectedServices.length && p.services.every(s => selectedServices.includes(s));
      btn.classList.toggle('active', isMatch);
    }
  });

  updateCampaignPreview();
}

function getSelectedServicesFromModal() {
  const container = document.getElementById('campaignServicesTags');
  if (!container) return [];
  const selected = [];
  container.querySelectorAll('.service-chip.active').forEach(chip => {
    if (chip.dataset.service) selected.push(chip.dataset.service);
  });
  return selected;
}

function updateCampaignPreview() {
  const previewBody = document.getElementById('campaignPreviewBody');
  if (!previewBody) return;

  const isEnabled = document.getElementById('campaignToggleSwitch')?.checked;
  if (!isEnabled) {
    previewBody.innerHTML = '<span class="log-dim">⚪ A campanha está desativada. As mensagens não conterão convites de campanha.</span>';
    return;
  }

  const name = document.getElementById('campaignNameInput')?.value.trim() || 'Campanha de Saúde';
  const period = document.getElementById('campaignPeriodInput')?.value.trim() || 'neste período';
  const icon = document.getElementById('campaignIconSelect')?.value || '🩺';
  const highlight = document.getElementById('campaignHighlightInput')?.value.trim() || 'Venha conferir nossos atendimentos gratuitos!';
  const services = getSelectedServicesFromModal();
  const drogaria = DEFAULT_CONFIG.drogaria || 'Drogasil Mogilar';

  const mockCamp = {
    enabled: true,
    name,
    period,
    icon,
    highlightText: highlight,
    services
  };

  const previewText = formatCampaignMessageBlock(mockCamp, drogaria);
  previewBody.textContent = previewText.trim();
}

function handleSaveCampaign(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('campaignNameInput')?.value.trim();
  const period = document.getElementById('campaignPeriodInput')?.value.trim();
  const icon = document.getElementById('campaignIconSelect')?.value || '🩺';
  const highlightText = document.getElementById('campaignHighlightInput')?.value.trim();
  const services = getSelectedServicesFromModal();
  const isEnabled = document.getElementById('campaignToggleSwitch')?.checked !== false;

  if (!name || !highlightText) {
    const feedback = document.getElementById('campaignFeedback');
    if (feedback) {
      feedback.className = 'login-feedback is-error';
      feedback.textContent = '⚠️ Por favor, informe o nome da campanha e o texto de convite.';
    }
    return;
  }

  const activePresetBtn = document.querySelector('.campaign-preset-card.active');
  const presetId = activePresetBtn ? activePresetBtn.dataset.preset : 'custom';

  const updatedCamp = {
    enabled: isEnabled,
    id: presetId,
    name,
    period: period || 'nesta semana',
    icon,
    services: services.length > 0 ? services : ['Aferição de Pressão Gratuita'],
    highlightText,
    extraNote: 'Atendimento profissional humanizado.'
  };

  saveActiveCampaign(updatedCamp);
  toggleCampaignActive(isEnabled);

  const feedback = document.getElementById('campaignFeedback');
  if (feedback) {
    feedback.className = 'login-feedback is-success';
    feedback.textContent = isEnabled 
      ? '🎉 Campanha salva e ativada com sucesso! Redirecionando para Gerador em Lote...' 
      : '💾 Configurações de campanha salvas com sucesso!';
  }

  if (isEnabled) {
    appendLog(`🎯 <strong>Campanha Ativada:</strong> <strong>${escapeHTML(name)}</strong> (${escapeHTML((services.length > 0 ? services : ['Serviços Gratuitos']).join(', '))}) agora será incluída nas mensagens!`, 'log-success');
  } else {
    appendLog(`💾 Configurações da campanha <strong>${escapeHTML(name)}</strong> salvas (atualmente desativada).`, 'log-info');
  }

  setTimeout(() => {
    closeCampaignModal();
    if (feedback) feedback.textContent = '';
    // Retorna para a tela de gerar novas mensagens em lote
    startBatchWizard();
  }, 350);
}

function deactivateCampaign() {
  const camp = getActiveCampaign();
  camp.enabled = false;
  saveActiveCampaign(camp);

  const toggleSwitch = document.getElementById('campaignToggleSwitch');
  if (toggleSwitch) toggleSwitch.checked = false;
  toggleCampaignActive(false);

  const feedback = document.getElementById('campaignFeedback');
  if (feedback) {
    feedback.className = 'login-feedback is-warning';
    feedback.textContent = '⚪ Campanha desativada com sucesso.';
  }

  appendLog(`⚪ <strong>Campanha Desativada:</strong> As próximas mensagens em lote não conterão convites de campanha.`, 'log-info');
  setTimeout(() => {
    closeCampaignModal();
    if (feedback) feedback.textContent = '';
    startBatchWizard();
  }, 350);
}

function initializeCampaignModule() {
  const closeBtn = document.getElementById('campaignCloseBtn');
  const backdrop = document.getElementById('campaignBackdrop');
  if (closeBtn) closeBtn.addEventListener('click', closeCampaignModal);
  if (backdrop) backdrop.addEventListener('click', closeCampaignModal);
  updateCampaignUIStatus();
}

/* ==========================================================================
   ENGINE DE GERAÇÃO DE MENSAGENS HUMANIZADAS
   ========================================================================== */
/**
 * Classifica automaticamente se o item é um MEDICAMENTO ou SERVIÇO FARMACÊUTICO
 */
function classifyItem(itemName, overrideType = 'auto') {
  if (overrideType && overrideType !== 'auto') {
    if (overrideType === 'servico') {
      return { type: 'servico', subType: 'geral', label: 'Serviço Farmacêutico', icon: '🩺' };
    }
    return { type: 'medicamento', subType: 'medicamento', label: 'Medicamento', icon: '💊' };
  }

  if (!itemName) return { type: 'medicamento', subType: 'medicamento', label: 'Medicamento', icon: '💊' };

  const rawText = itemName.toLowerCase().trim();
  const normText = rawText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const text = rawText + ' ' + normText;

  // Lista expandida de termos e serviços farmacêuticos
  const serviceKeywords = [
    'injetavel', 'injecao', 'aplica',
    'sensor', 'libre', 'freestyle', 'glicemia continua',
    'pressao', 'arterial', 'afericao', 'medicao',
    'glicemia', 'glicose', 'dextro',
    'furo de orelha', 'orelha', 'brinco', 'lobulo', 'auricular', 'perfuracao',
    'influenza', 'gripe', 'h1n1', 'h3n2',
    'covid', 'coronavirus', 'antigeno',
    'painel respiratorio', 'respiratorio', 'virus',
    'bioimpedancia', 'composicao corporal', 'massa magra', 'gordura corporal',
    'curativo', 'nebulizacao', 'inalacao',
    'vacina', 'vacinacao', 'testagem', 'exame', 'servico', 'atendimento', 'procedimento'
  ];

  let subType = 'geral';

  if (text.includes('libre') || (text.includes('sensor') && (text.includes('glicem') || text.includes('glicose')))) {
    subType = 'sensor_libre';
  } else if (text.includes('bioimpedan') || text.includes('composicao corporal') || text.includes('composição corporal')) {
    subType = 'bioimpedancia';
  } else if (text.includes('painel') || (text.includes('respirat') && text.includes('teste'))) {
    subType = 'painel_respiratorio';
  } else if (text.includes('influenza') || text.includes('gripe')) {
    subType = 'influenza';
  } else if (text.includes('covid') || text.includes('corona') || text.includes('antigen')) {
    subType = 'covid';
  } else if (text.includes('orelh') || text.includes('brinco') || text.includes('lobul') || text.includes('auricular') || text.includes('perfur') || text.includes('furo')) {
    subType = 'orelha';
  } else if (text.includes('press') || text.includes('arterial')) {
    subType = 'pressao';
  } else if (text.includes('injet') || text.includes('injec') || text.includes('aplica')) {
    subType = 'injetavel';
  } else if (text.includes('glicem') || text.includes('glicose') || text.includes('dextro')) {
    subType = 'glicemia';
  } else if (text.includes('curativ') || text.includes('nebuliz') || text.includes('inala')) {
    subType = 'curativo';
  } else if (text.includes('vacin') || text.includes('imuniz')) {
    subType = 'vacina';
  }

  const isService = serviceKeywords.some(kw => text.includes(kw));

  if (isService) {
    return { type: 'servico', subType: subType, label: 'Serviço Farmacêutico', icon: '🩺' };
  }

  return { type: 'medicamento', subType: 'medicamento', label: 'Medicamento', icon: '💊' };
}


const MESSAGE_TEMPLATES = {
  empatico: (data) => {
    const saudacao = getSaudacaoHorario();
    const sintomaTxt = data.sintoma ? ` em relação a ${data.sintoma}` : '';
    const dicaTxt = data.dica ? `\n\n💡 *Dica do Farmacêutico:* ${data.dica}` : '';
    const tempoTxt = data.tempo ? ` (${data.tempo})` : '';
    const campTxt = data.campaignBlock || '';

    if (data.classification.type === 'servico') {
      const sub = data.classification.subType;
      let pergServico = `como você está se sentindo após o atendimento de **${data.medicamento}** realizado aqui com a gente${tempoTxt}. Deu tudo certo com o procedimento?`;
      
      if (sub === 'injetavel') {
        pergServico = `como você está se sentindo após a **${data.medicamento}** realizada na farmácia${tempoTxt}. Sentiu alguma dor no local da aplicação ou qualquer outro desconforto?`;
      } else if (sub === 'sensor_libre') {
        pergServico = `como está sendo a experiência após a **colocação do Sensor Libre** realizada na farmácia${tempoTxt}. O sensor está firme no braço e as leituras de glicose no aplicativo/leitor estão normais?`;
      } else if (sub === 'pressao') {
        pergServico = `como você está se sentindo após a **aferição de pressão arterial** realizada aqui na farmácia${tempoTxt}. Notou melhora no seu bem-estar ou em sintomas de mal-estar?`;
      } else if (sub === 'orelha') {
        pergServico = `como está a cicatrização após a **perfuração do lóbulo auricular** realizada na farmácia${tempoTxt}. Está higienizando o local certinho com o antisséptico e sem inchaço?`;
      } else if (sub === 'influenza') {
        pergServico = `como você está se sentindo após a realização do **teste de Influenza (Gripe)** na farmácia${tempoTxt}. Os sintomas de febre ou indisposição já melhoraram?`;
      } else if (sub === 'covid') {
        pergServico = `como você está se sentindo após a realização do **teste de COVID-19** na farmácia${tempoTxt}. Está conseguindo manter o repouso e a hidratação recomendados?`;
      } else if (sub === 'painel_respiratorio') {
        pergServico = `como você está se sentindo após a realização do **teste de Painel Respiratório** feito na farmácia${tempoTxt}. Notou alívio nos sintomas de tosse ou congestão?`;
      } else if (sub === 'bioimpedancia') {
        pergServico = `como foi seu acompanhamento após o exame de **Bioimpedância (composição corporal)** na farmácia${tempoTxt}. Ficou com alguma dúvida sobre o relatório ou sobre suas metas de saúde?`;
      } else if (sub === 'glicemia') {
        pergServico = `como você está se sentindo após o teste de **glicemia capilar** realizado na farmácia${tempoTxt}. Está conseguindo manter os cuidados com os horários das refeições e remédios?`;
      }

      return `${saudacao}, ${data.nome}! Tudo bem com você? 😊\n\n` +
        `Aqui é o farmacêutico **${data.farmaceutico}**, da **${data.drogaria}**!\n\n` +
        `Estou passando para acompanhar ${pergServico}\n\n` +
        `Se tiver qualquer dúvida sobre os cuidados pós-atendimento ou precisar de um novo serviço, pode me avisar por aqui a qualquer momento. Estou à sua inteira disposição!${dicaTxt}${campTxt}\n\n` +
        `Desejo muita saúde e um dia abençoado! 💚\n\n` +
        `Atenciosamente,\n` +
        `*${data.farmaceutico}* | ${data.drogaria}`;
    }

    return `${saudacao}, ${data.nome}! Tudo bem com você? 😊\n\n` +
      `Aqui é o farmacêutico **${data.farmaceutico}**, da **${data.drogaria}**!\n\n` +
      `Estou passando para saber como você está se sentindo${sintomaTxt} e como está indo o acompanhamento com o medicamento **${data.medicamento}**${tempoTxt}. O tratamento está sendo tranquilo?\n\n` +
      `Se tiver qualquer dúvida sobre as doses, horários ou se sentir algum desconforto, pode me avisar por aqui a qualquer momento. Meu compromisso é garantir que você se recupere com toda a segurança e conforto!${dicaTxt}${campTxt}\n\n` +
      `Desejo uma excelente recuperação e um dia abençoado! 💚\n\n` +
      `Atenciosamente,\n` +
      `*${data.farmaceutico}* | ${data.drogaria}`;
  },

  atencioso: (data) => {
    const saudacao = getSaudacaoHorario();
    const sintomaTxt = data.sintoma ? ` em relação a ${data.sintoma}` : '';
    const dicaTxt = data.dica ? `\n\n📌 *Lembrete importante:* ${data.dica}` : '';
    const campTxt = data.campaignBlock || '';

    if (data.classification.type === 'servico') {
      return `${saudacao}, ${data.nome}! Como vai? Espero que esteja muito bem!\n\n` +
        `Quem fala é o ${data.farmaceutico}, farmacêutico da ${data.drogaria}.\n\n` +
        `Gostaria de acompanhar de perto o seu atendimento de **${data.medicamento}**: correu tudo bem? Notou estabilização ou melhora dos seus sintomas${sintomaTxt}?\n\n` +
        `Lembre-se da importância de manter as rotinas e cuidados orientados na farmácia.${dicaTxt}${campTxt}\n\n` +
        `Caso precise de qualquer suporte ou novo procedimento/aferição, conte comigo!\n\n` +
        `Um abraço e se cuide!\n` +
        `*${data.farmaceutico}* - ${data.drogaria}`;
    }

    return `${saudacao}, ${data.nome}! Como vai? Espero que esteja muito bem!\n\n` +
      `Quem fala é o ${data.farmaceutico}, farmacêutico da ${data.drogaria}.\n\n` +
      `Gostaria de acompanhar de perto o seu bem-estar: deu tudo certo com a medicação **${data.medicamento}**? Notou melhorias nos sintomas${sintomaTxt}?\n\n` +
      `Lembre-se da importância de manter os horários certinhos da dose para a eficácia completa do seu tratamento.${dicaTxt}${campTxt}\n\n` +
      `Caso precise de qualquer orientação ou apoio profissional, pode contar comigo!\n\n` +
      `Um abraço e se cuide!\n` +
      `*${data.farmaceutico}* - ${data.drogaria}`;
  },

  descontraido: (data) => {
    const dicaTxt = data.dica ? `\n\n Ah, e não se esqueça: ${data.dica} 😉` : '';
    const campTxt = data.campaignBlock || '';

    if (data.classification.type === 'servico') {
      return `Oi, ${data.nome}! Tudo certinho com você? 🙋♂️\n\n` +
        `Aqui é o ${data.farmaceutico} da ${data.drogaria}!\n\n` +
        `Estou passando rapidinho pra saber como você está após o procedimento de **${data.medicamento}**! Correu tudo bem no atendimento?\n\n` +
        `Se precisar de mais alguma coisa ou tiver qualquer dúvida, só me mandar uma mensagem aqui, tá bom?${dicaTxt}${campTxt}\n\n` +
        `Tenha um ótimo dia! ✨\n\n` +
        `Abraço,\n` +
        `*${data.farmaceutico}* | ${data.drogaria}`;
    }

    return `Oi, ${data.nome}! Tudo certinho com você? 🙋♂️\n\n` +
      `Aqui é o ${data.farmaceutico} da ${data.drogaria}!\n\n` +
      `Estou passando rapidinho pra saber como você está se sentindo e se deu tudo certo com o **${data.medicamento}**! Já sentiu a melhora?\n\n` +
      `Qualquer dúvida que você tiver sobre o remédio, só me mandar uma mensagem aqui, tá bom? Estou sempre por aqui pra ajudar!${dicaTxt}${campTxt}\n\n` +
      `Tenha um ótimo dia e melhore logo! ✨\n\n` +
      `Abraço,\n` +
      `*${data.farmaceutico}* | ${data.drogaria}`;
  },

  pos_tratamento: (data) => {
    const campTxt = data.campaignBlock || '';

    if (data.classification.type === 'servico') {
      return `Olá, ${data.nome}! Como você está?\n\n` +
        `Aqui é o farmacêutico ${data.farmaceutico}, da ${data.drogaria}.\n\n` +
        `Passando para saber como ficou sua saúde após a realização do serviço de **${data.medicamento}**. Está se sentindo 100% recuperado(a)?\n\n` +
        `Caso precise agendar um novo atendimento, nova aferição ou qualquer outro suporte para sua saúde, conte sempre com nossa equipe na ${data.drogaria}.${campTxt}\n\n` +
        `Desejo muita saúde!\n\n` +
        `Atenciosamente,\n` +
        `*${data.farmaceutico}* - ${data.drogaria}`;
    }

    return `Olá, ${data.nome}! Como você está?\n\n` +
      `Aqui é o farmacêutico ${data.farmaceutico}, da ${data.drogaria}.\n\n` +
      `Passando para acompanhar a fase final do seu tratamento com o **${data.medicamento}**. Como você está se sentindo agora? Já se sente 100% recuperado(a)?\n\n` +
      `Caso precise de reposição, nova orientação médica/farmacêutica ou qualquer suporte para sua saúde, conte sempre com nossa equipe na ${data.drogaria}.${campTxt}\n\n` +
      `Desejo muita saúde!\n\n` +
      `Atenciosamente,\n` +
      `*${data.farmaceutico}* - ${data.drogaria}`;
  }
};

function getSaudacaoHorario() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Gera as mensagens personalizadas com base nos parâmetros
 */
function generateMessages(params) {
  const itemInput = params.medicamento || params.item || 'Medicamento / Serviço';
  const classification = classifyItem(itemInput, params.tipoOverride || 'auto');
  const activeCampaign = (params.includeCampaign !== false && isCampaignActive()) ? getActiveCampaign() : null;
  const campaignBlock = activeCampaign ? formatCampaignMessageBlock(activeCampaign, params.drogaria || DEFAULT_CONFIG.drogaria) : '';

  const data = {
    nome: capitalizeName(params.nome || 'Cliente'),
    drogaria: params.drogaria || DEFAULT_CONFIG.drogaria,
    farmaceutico: params.farmaceutico || DEFAULT_CONFIG.farmaceutico,
    medicamento: itemInput,
    classification: classification,
    sintoma: params.sintoma || '',
    tempo: params.tempo || '',
    dica: params.dica || '',
    telefone: params.telefone ? params.telefone.replace(/\D/g, '') : '',
    campaign: activeCampaign,
    campaignBlock: campaignBlock
  };

  const generated = {
    id: Date.now(),
    timestamp: new Date().toLocaleString('pt-BR'),
    clientData: data,
    campaign: activeCampaign,
    versions: {
      empatico: MESSAGE_TEMPLATES.empatico(data),
      atencioso: MESSAGE_TEMPLATES.atencioso(data),
      descontraido: MESSAGE_TEMPLATES.descontraido(data),
      pos_tratamento: MESSAGE_TEMPLATES.pos_tratamento(data)
    }
  };

  generatedMessagesHistory.unshift(generated);
  localStorage.setItem('apoio_tratamento_history', JSON.stringify(generatedMessagesHistory));
  updateHistoryCounter();

  return generated;
}

/* ==========================================================================
   INTEGRAÇÃO DE IA (GOOGLE GEMINI FLASH)
   POLÍTICA DE PRIVACIDADE:
   - Apenas a API Key do Gemini é salva nas configurações da aplicação.
   - 0 dados de clientes ou pacientes são persistidos em bancos de dados.
   ========================================================================== */

function getGeminiApiKey() {
  if (typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getGeminiApiKey === 'function') {
    return window.AppConfig.getGeminiApiKey();
  }
  return (typeof localStorage !== 'undefined' ? localStorage.getItem('apoio_gemini_api_key') : '') || '';
}

function saveGeminiApiKey(key) {
  if (typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.setGeminiApiKey === 'function') {
    window.AppConfig.setGeminiApiKey(key);
  }
  if (typeof localStorage !== 'undefined') {
    if (key) localStorage.setItem('apoio_gemini_api_key', key);
    else localStorage.removeItem('apoio_gemini_api_key');
  }
}

function removeGeminiApiKey() {
  saveGeminiApiKey('');
}

const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro'
];

let activeGeminiModel = (typeof window !== 'undefined' && window.AppConfig && typeof window.AppConfig.getGeminiModel === 'function') 
  ? window.AppConfig.getGeminiModel() 
  : 'gemini-3.8-flash';

const GEMINI_MODEL = activeGeminiModel;
const GEMINI_MODEL_LABEL = 'Google Gemini Flash';

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    empatico: { type: 'STRING' },
    atencioso: { type: 'STRING' },
    descontraido: { type: 'STRING' },
    pos_tratamento: { type: 'STRING' }
  },
  required: ['empatico', 'atencioso', 'descontraido', 'pos_tratamento']
};

const GEMINI_BATCH_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      index: { type: 'INTEGER' },
      nome: { type: 'STRING' },
      mensagem: { type: 'STRING' }
    },
    required: ['index', 'nome', 'mensagem']
  }
};

const GEMINI_FAILURE_RESET_MS = 10 * 60 * 1000;
const GEMINI_FAILURE_THRESHOLD = 3;

function getGeminiFailureState() {
  try {
    const payload = JSON.parse(localStorage.getItem('apoio_gemini_failure_state') || '{"count":0,"lastFailureAt":0,"blockedUntil":0}');
    return {
      count: Number(payload.count) || 0,
      lastFailureAt: Number(payload.lastFailureAt) || 0,
      blockedUntil: Number(payload.blockedUntil) || 0
    };
  } catch (error) {
    return { count: 0, lastFailureAt: 0, blockedUntil: 0 };
  }
}

function setGeminiFailureState(nextState) {
  localStorage.setItem('apoio_gemini_failure_state', JSON.stringify(nextState));
}

function isGeminiTemporarilyBlocked() {
  const state = getGeminiFailureState();
  if (state.blockedUntil && Date.now() < state.blockedUntil) {
    return true;
  }

  if (state.blockedUntil && Date.now() >= state.blockedUntil) {
    setGeminiFailureState({ count: 0, lastFailureAt: 0, blockedUntil: 0 });
  }

  return false;
}

function registerGeminiFailure(err) {
  const now = Date.now();
  const state = getGeminiFailureState();
  const isInWindow = state.lastFailureAt && now - state.lastFailureAt <= GEMINI_FAILURE_RESET_MS;

  const nextState = {
    count: isInWindow ? state.count + 1 : 1,
    lastFailureAt: now,
    blockedUntil: 0
  };

  if (nextState.count >= GEMINI_FAILURE_THRESHOLD) {
    nextState.blockedUntil = now + GEMINI_FAILURE_RESET_MS;
  }

  setGeminiFailureState(nextState);

  if (nextState.blockedUntil) {
    appendLog(`🛑 <strong>Gemini IA:</strong> muitas falhas consecutivas. A IA ficará bloqueada por 10 minutos antes de tentar novamente.`, 'log-warning');
  } else {
    appendLog(`⚠️ <strong>Gemini IA:</strong> falha de resposta. ${escapeHTML(err?.message || 'Erro desconhecido')} → fallback local.`, 'log-warning');
  }
}

function resetGeminiFailureState() {
  setGeminiFailureState({ count: 0, lastFailureAt: 0, blockedUntil: 0 });
}

function getGeminiEndpoint(apiKey, modelName = null) {
  const model = modelName || activeGeminiModel || 'gemini-3.8-flash';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

async function callGeminiAPI(promptText, customSchema = null) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Chave de API do Gemini não configurada. Digite 'apikey SUACHAVE' no terminal ou configure no painel.");
  }

  const schemaToUse = customSchema !== null && customSchema !== undefined ? customSchema : GEMINI_RESPONSE_SCHEMA;

  const generationConfig = {
    temperature: 0.7,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json'
  };

  if (schemaToUse) {
    generationConfig.responseSchema = schemaToUse;
  }

  const requestBody = JSON.stringify({
    contents: [{
      parts: [{ text: promptText }]
    }],
    generationConfig: generationConfig
  });

  // Tenta primeiro o modelo ativo, depois os demais candidatos caso retorne 404 (modelo descontinuado)
  const modelsToTry = [activeGeminiModel, ...GEMINI_CANDIDATE_MODELS.filter(m => m !== activeGeminiModel)];
  let lastError = null;

  for (const modelCandidate of modelsToTry) {
    try {
      const endpoint = getGeminiEndpoint(apiKey, modelCandidate);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      if (response.status === 404) {
        // Modelo não disponível para este usuário/região, tenta o próximo candidato
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || response.statusText;
        throw new Error(`Erro na API Gemini (${response.status}): ${msg}`);
      }

      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        // Salva modelo que funcionou para próximas chamadas
        activeGeminiModel = modelCandidate;
        return data.candidates[0].content.parts[0].text;
      }
      throw new Error("Resposta inválida recebida da API Gemini.");
    } catch (err) {
      lastError = err;
      if (err.message && err.message.includes('404')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Nenhum modelo Gemini compatível respondeu com sucesso.");
}

function sanitizeGeminiJsonResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Resposta vazia recebida da API Gemini.');
  }
  const synonyms = {
    empatico: 'empatico', empático: 'empatico', empatica: 'empatico', tom_empatico: 'empatico', opcao_1: 'empatico',
    atencioso: 'atencioso', atenciosa: 'atencioso', padrao: 'atencioso', padrão: 'atencioso', tom_atencioso: 'atencioso', opcao_2: 'atencioso',
    descontraido: 'descontraido', descontraído: 'descontraido', leve: 'descontraido', tom_descontraido: 'descontraido', opcao_3: 'descontraido',
    pos_tratamento: 'pos_tratamento', postratamento: 'pos_tratamento', pos_atendimento: 'pos_tratamento', pos_venda: 'pos_tratamento', retorno: 'pos_tratamento', pos: 'pos_tratamento', opcao_4: 'pos_tratamento'
  };
  const normKey = (k) => {
    if (!k) return '';
    const c = String(k).toLowerCase().replace(/[\s_-]+/g, '_').trim();
    if (synonyms[c]) return synonyms[c];
    const c2s = c.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    if (synonyms[c2s]) return synonyms[c2s];
    if (c.includes('empat')) return 'empatico';
    if (c.includes('atenc')) return 'atencioso';
    if (c.includes('descon') || c.includes('leve')) return 'descontraido';
    if (c.includes('pos') || c.includes('pós') || c.includes('retorn')) return 'pos_tratamento';
    return '';
  };
  const cleanVal = (v) => {
    if (typeof v !== 'string') return v ? String(v) : '';
    return v.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  };
  const extractObj = (obj) => {
    if (!obj || typeof obj !== 'object') return null;
    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'string') {
        const res = {};
        if (obj[0]) res.empatico = cleanVal(obj[0]);
        if (obj[1]) res.atencioso = cleanVal(obj[1]);
        if (obj[2]) res.descontraido = cleanVal(obj[2]);
        if (obj[3]) res.pos_tratamento = cleanVal(obj[3]);
        return Object.keys(res).length > 0 ? res : null;
      }
      const merged = {};
      for (const it of obj) {
        const sub = extractObj(it);
        if (sub) Object.assign(merged, sub);
      }
      return Object.keys(merged).length > 0 ? merged : null;
    }
    const collected = {};
    for (const [k, v] of Object.entries(obj)) {
      const nk = normKey(k);
      if (nk && typeof v === 'string' && v.trim()) {
        collected[nk] = cleanVal(v);
      } else if (v && typeof v === 'object') {
        const sub = extractObj(v);
        if (sub) {
          for (const [sk, sv] of Object.entries(sub)) {
            if (sv && !collected[sk]) collected[sk] = sv;
          }
        }
      }
    }
    return Object.keys(collected).length > 0 ? collected : null;
  };
  let cleaned = rawText.replace(/^```(?:json)?/gim, '').replace(/```$/gim, '').trim();
  const candidates = [];
  const b1 = cleaned.indexOf('{'), b2 = cleaned.lastIndexOf('}');
  if (b1 !== -1 && b2 > b1) candidates.push(cleaned.slice(b1, b2 + 1));
  const k1 = cleaned.indexOf('['), k2 = cleaned.lastIndexOf(']');
  if (k1 !== -1 && k2 > k1) candidates.push(cleaned.slice(k1, k2 + 1));
  candidates.push(cleaned);
  for (const cand of candidates) {
    try {
      const ext = extractObj(JSON.parse(cand));
      if (ext && Object.keys(ext).length > 0) {
        return { empatico: ext.empatico || '', atencioso: ext.atencioso || '', descontraido: ext.descontraido || '', pos_tratamento: ext.pos_tratamento || '' };
      }
    } catch (e) {
      try {
        const sanitized = cand.replace(/"(?:[^"\\]|\\.)*"/gs, (m) => m.replace(/\r?\n/g, '\\n'));
        const ext = extractObj(JSON.parse(sanitized));
        if (ext && Object.keys(ext).length > 0) {
          return { empatico: ext.empatico || '', atencioso: ext.atencioso || '', descontraido: ext.descontraido || '', pos_tratamento: ext.pos_tratamento || '' };
        }
      } catch (e2) {}
    }
  }
  const recovered = {};
  const keys = ['empatico', 'atencioso', 'descontraido', 'pos_tratamento', 'posTratamento', 'postratamento', 'pos-tratamento', 'pos_atendimento', 'pos_venda', 'pos', 'empático', 'descontraído', 'padrão', 'padrao'];
  const keyRe = new RegExp(`(?:"|'|\\b)(${keys.join('|')})(?:"|'|\\b)\\s*:\\s*`, 'gi');
  const matches = [];
  let m;
  while ((m = keyRe.exec(cleaned)) !== null) {
    matches.push({ normKey: normKey(m[1]), start: m.index + m[0].length, index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nxt = matches[i + 1];
    let seg = (nxt ? cleaned.slice(cur.start, nxt.index) : cleaned.slice(cur.start)).trim();
    if (seg.startsWith('"') || seg.startsWith("'")) {
      const q = seg[0];
      let val = '', esc = false, closed = false;
      for (let j = 1; j < seg.length; j++) {
        const ch = seg[j];
        if (esc) { val += ch; esc = false; continue; }
        if (ch === '\\') { val += ch; esc = true; continue; }
        if (ch === q) {
          const rest = seg.slice(j + 1).trim();
          if (rest === '' || rest.startsWith(',') || rest.startsWith('}') || rest.startsWith(']') || /^(?:(?:"|'|\b)[a-z0-9_]+(?:"|'|\b)\s*:)/i.test(rest)) {
            closed = true;
            break;
          }
        }
        val += ch;
      }
      if (cur.normKey && (!recovered[cur.normKey] || closed)) recovered[cur.normKey] = cleanVal(val);
    } else {
      let raw = seg.replace(/[,}\]]+$/, '').trim();
      if (cur.normKey && !recovered[cur.normKey]) recovered[cur.normKey] = cleanVal(raw);
    }
  }
  if (Object.keys(recovered).length > 0) {
    return { empatico: recovered.empatico || '', atencioso: recovered.atencioso || '', descontraido: recovered.descontraido || '', pos_tratamento: recovered.pos_tratamento || '' };
  }
  const secRe = /(?:^|\n)\s*(?:[\d*-.]+\s*)?(?:tom\s+)?(emp[aá]tico|atencioso|padr[aã]o|descontra[ií]do|leve|p[oó]s[-_ ]?tratamento|p[oó]s[-_ ]?atendimento|p[oó]s)\s*[:=-]\s*([\s\S]*?)(?=(?:\n\s*(?:[\d*-.]+\s*)?(?:tom\s+)?(?:emp[aá]tico|atencioso|padr[aã]o|descontra[ií]do|leve|p[oó]s[-_ ]?tratamento|p[oó]s[-_ ]?atendimento|p[oó]s)\s*[:=-])|$)/gi;
  let sm;
  while ((sm = secRe.exec(cleaned)) !== null) {
    const nk = normKey(sm[1]), sv = cleanVal(sm[2]);
    if (nk && sv) recovered[nk] = sv;
  }
  if (Object.keys(recovered).length > 0) {
    return { empatico: recovered.empatico || '', atencioso: recovered.atencioso || '', descontraido: recovered.descontraido || '', pos_tratamento: recovered.pos_tratamento || '' };
  }
  throw new Error('A resposta da IA não estava em JSON válido para as mensagens.');
}

async function generateMessagesAI(params) {
  const itemInput = params.medicamento || params.item || 'Medicamento / Serviço';
  const classification = classifyItem(itemInput, params.tipoOverride || 'auto');
  const activeCampaign = (params.includeCampaign !== false && isCampaignActive()) ? getActiveCampaign() : null;

  const data = {
    nome: capitalizeName(params.nome || 'Cliente'),
    drogaria: params.drogaria || DEFAULT_CONFIG.drogaria,
    farmaceutico: params.farmaceutico || DEFAULT_CONFIG.farmaceutico,
    medicamento: itemInput,
    classification: classification,
    sintoma: params.sintoma || '',
    tempo: params.tempo || '',
    dica: params.dica || '',
    telefone: params.telefone ? params.telefone.replace(/\D/g, '') : '',
    campaign: activeCampaign
  };

  const campaignPromptInstruction = activeCampaign ? `
- CAMPANHA DE SAÚDE EM DESTAQUE NA DROGARIA: "${activeCampaign.name}" (${activeCampaign.period}).
  Serviços Gratuitos/Inclusos: ${activeCampaign.services.join(', ')}.
  Texto de Destaque/Convite: "${activeCampaign.highlightText}".
  DIRETRIZ DE CAMPANHA: Destaque de forma acolhedora, calorosa e fluida nas 4 variações de mensagens um convite para o cliente aproveitar esses serviços de saúde gratuitos/promocionais na drogaria como um benefício especial!
` : '';

  const prompt = `
Você é o Farmacêutico ${data.farmaceutico} da filial ${data.drogaria}.
Sua missão é gerar 4 variações de mensagens de acompanhamento de pós-venda em português do Brasil para o WhatsApp do cliente.

DADOS DO ATENDIMENTO:
- Cliente: ${data.nome}
- Item/Serviço: ${data.medicamento} (Categoria Identificada: ${data.classification.label})
- Sintoma/Motivo relatado pelo cliente: ${data.sintoma || 'Não informado'}
- Tempo decorrido: ${data.tempo || 'Atendimento recente'}
- Orientação/Dica de saúde específica: ${data.dica || 'Recomendações gerais de saúde e adesão ao tratamento'}${campaignPromptInstruction}

REGRAS OBRIGATÓRIAS:
1. Tom estritamente humanizado, acolhedor, ético e farmacêutico.
2. Formate as mensagens adequadamente para o WhatsApp (use quebras de linha limpas e emojis pertinentes).
3. Adapte se for medicamento ou serviço (ex: para bioimpedância comente sobre o relatório; para sensor libre sobre a fixação/sincronização; para medicamentos sobre posologia e hidratação).
4. RESPOSTA ESTRITAMENTE COMO JSON VÁLIDO, SEM QUALQUER TEXTO EXTRA, SEM MARKDOWN, SEM EXPLICAÇÃO, SEM COMENTÁRIOS, SEM LINHA DE ABERTURA OU FECHAMENTO.
5. A resposta deve ser um único objeto JSON com exatamente estas chaves, em ordem: empatico, atencioso, descontraido, pos_tratamento.
6. Cada valor deve ser uma string em português do Brasil, sem aspas escapadas desnecessárias, sem caracteres de quebra de linha soltos e sem texto fora do JSON.
7. Se houver qualquer dúvida, devolva JSON válido com strings curtas e profissionais, nunca com prosa fora do objeto.
JSON EXATO:
{
  "empatico": "mensagem tom empático...",
  "atencioso": "mensagem tom atencioso e profissional...",
  "descontraido": "mensagem tom leve e descontraído...",
  "pos_tratamento": "mensagem focada em pós-tratamento e retorno..."
}
`;

  const rawText = await callGeminiAPI(prompt);
  const parsedJSON = sanitizeGeminiJsonResponse(rawText);

  // Aplicar proteção Anti-Spam nas mensagens da IA (Zero-Width Space + Hash Signature)
  function applyAntiSpamProtection(text) {
    const zeroWidthPadding = '\u200B'.repeat(Math.floor(Math.random() * 5) + 1);
    const finalText = `${text}${zeroWidthPadding}`;
    let hash = 0;
    for (let i = 0; i < finalText.length; i++) {
      const char = finalText.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const signature = 'SIG_' + Math.abs(hash).toString(36);
    return { text: finalText, signature };
  }

  const versionsWithAntiSpam = {};
  for (const [key, value] of Object.entries({
    empatico: parsedJSON.empatico || MESSAGE_TEMPLATES.empatico(data),
    atencioso: parsedJSON.atencioso || MESSAGE_TEMPLATES.atencioso(data),
    descontraido: parsedJSON.descontraido || MESSAGE_TEMPLATES.descontraido(data),
    pos_tratamento: parsedJSON.pos_tratamento || MESSAGE_TEMPLATES.pos_tratamento(data)
  })) {
    versionsWithAntiSpam[key] = applyAntiSpamProtection(value);
  }

  const generated = {
    id: Date.now(),
    timestamp: new Date().toLocaleString('pt-BR'),
    clientData: data,
    campaign: activeCampaign,
    isAI: true,
    versions: versionsWithAntiSpam
  };

  generatedMessagesHistory.unshift(generated);
  localStorage.setItem('apoio_tratamento_history', JSON.stringify(generatedMessagesHistory));
  updateHistoryCounter();

  return generated;
}

async function generateMessagesSmart(params) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return generateMessages(params);
  }

  if (isGeminiTemporarilyBlocked()) {
    appendLog(`🛑 <strong>Gemini IA bloqueada temporariamente.</strong> Usando gerador local de fallback.`, 'log-warning');
    return generateMessages(params);
  }

  appendLog(`🤖 <strong>Gemini IA:</strong> Consultando a inteligência artificial para <strong>${escapeHTML(params.nome || 'Cliente')}</strong>...`, 'log-info');

  try {
    const aiResult = await generateMessagesAI(params);
    resetGeminiFailureState();
    appendLog(`✨ Mensagem gerada via <strong>Gemini IA</strong> com sucesso!`, 'log-success');
    return aiResult;
  } catch (err) {
    registerGeminiFailure(err);
    appendLog(`⚠️ <strong>Gemini IA indisponível:</strong> ${escapeHTML(err.message)} → Usando gerador local de fallback.`, 'log-warning');
    return generateMessages(params);
  }
}

function capitalizeName(name) {
  return name.trim().split(' ').map(word => {
    if (word.length <= 2 && ['de', 'da', 'do', 'dos', 'das'].includes(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function updateAIStatus() {
  const statusEl = document.getElementById('ai-status');
  const key = getGeminiApiKey();
  if (statusEl) {
    if (key && !isGeminiTemporarilyBlocked()) {
      statusEl.innerHTML = `🟢 <strong>Gemini IA Ativa</strong>`;
      statusEl.style.color = '#00ffcc';
      statusEl.style.opacity = '1';
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = openGeminiConfigPanel;
    } else if (key && isGeminiTemporarilyBlocked()) {
      statusEl.innerHTML = `🟡 <strong>Gemini IA Temporariamente Bloqueada</strong>`;
      statusEl.style.color = '#ffcc66';
      statusEl.style.opacity = '1';
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = openGeminiConfigPanel;
    } else {
      statusEl.innerHTML = `🔴 IA Inativa`;
      statusEl.style.color = '';
      statusEl.style.opacity = '0.6';
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = openGeminiConfigPanel;
    }
  }
}

function initializeGeminiConfigPanel() {
  const panel = document.getElementById('geminiConfigPanel');
  const form = document.getElementById('geminiConfigForm');
  const openButton = document.getElementById('geminiConfigBtn');
  const closeButton = document.getElementById('geminiCloseBtn');
  const toggleButton = document.getElementById('geminiKeyToggle');
  const testButton = document.getElementById('geminiTestBtn');
  const removeButton = document.getElementById('geminiRemoveBtn');

  if (!panel || !form || !openButton) return;

  openButton.addEventListener('click', openGeminiConfigPanel);
  closeButton?.addEventListener('click', closeGeminiConfigPanel);
  if (panel && typeof panel.querySelector === 'function') {
    panel.querySelector('[data-gemini-close]')?.addEventListener('click', closeGeminiConfigPanel);
  }
  form.addEventListener('submit', handleGeminiSave);
  toggleButton?.addEventListener('click', toggleGeminiKeyVisibility);
  testButton?.addEventListener('click', handleGeminiTest);
  removeButton?.addEventListener('click', handleGeminiRemove);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) closeGeminiConfigPanel();
  });
}

function openGeminiConfigPanel() {
  const panel = document.getElementById('geminiConfigPanel');
  const input = document.getElementById('geminiKeyInput');
  if (!panel || !input) return;

  panel.hidden = false;
  renderGeminiConfigState();
  input.focus();
}

function closeGeminiConfigPanel() {
  const panel = document.getElementById('geminiConfigPanel');
  if (panel) panel.hidden = true;
  cliInput?.focus();
}

function renderGeminiConfigState() {
  const key = getGeminiApiKey();
  const status = document.getElementById('geminiConfigStatus');
  const input = document.getElementById('geminiKeyInput');
  const removeButton = document.getElementById('geminiRemoveBtn');

  if (status) {
    status.textContent = key ? `🟢 Chave configurada (${maskGeminiKey(key)})` : '🔴 Nenhuma chave configurada';
    status.classList.toggle('is-active', Boolean(key));
  }
  if (input) input.value = '';
  if (removeButton) removeButton.hidden = !key;
  setGeminiConfigFeedback('');
}

function maskGeminiKey(key) {
  return key.length <= 10 ? '••••••••' : `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

function setGeminiConfigFeedback(message, type = '') {
  const feedback = document.getElementById('geminiConfigFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `gemini-config-feedback${type ? ` is-${type}` : ''}`;
}

function toggleGeminiKeyVisibility() {
  const input = document.getElementById('geminiKeyInput');
  const button = document.getElementById('geminiKeyToggle');
  if (!input || !button) return;
  const showKey = input.type === 'password';
  input.type = showKey ? 'text' : 'password';
  button.textContent = showKey ? 'Ocultar' : 'Mostrar';
  button.setAttribute('aria-pressed', String(showKey));
}

function handleGeminiSave(event) {
  event?.preventDefault();
  const input = document.getElementById('geminiKeyInput');
  const key = input?.value.trim() || '';

  if (!key) {
    setGeminiConfigFeedback('Insira uma chave de API antes de salvar.', 'error');
    input?.focus();
    return;
  }

  saveGeminiApiKey(key);
  updateAIStatus();
  renderGeminiConfigState();
  setGeminiConfigFeedback('Chave salva nas configurações da aplicação. Clique em “Testar conexão” para validá-la.', 'success');
  appendLog(`🔑 <strong>Chave do Gemini IA salva com sucesso nas configurações!</strong>`, 'log-success');
}

async function handleGeminiTest() {
  const input = document.getElementById('geminiKeyInput');
  const testKey = input?.value.trim() || getGeminiApiKey();

  if (!testKey) {
    setGeminiConfigFeedback('Cole ou salve uma chave antes de testar a conexão.', 'error');
    input?.focus();
    return;
  }

  setGeminiConfigFeedback(`Testando conexão com a API do Google Gemini...`);

  try {
    const modelsToTry = [activeGeminiModel, ...GEMINI_CANDIDATE_MODELS.filter(m => m !== activeGeminiModel)];
    let connected = false;
    let successfulModel = '';

    for (const m of modelsToTry) {
      try {
        const response = await fetch(getGeminiEndpoint(testKey, m), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'OK' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        });

        if (response.status === 404) continue;

        if (response.ok) {
          activeGeminiModel = m;
          successfulModel = m;
          connected = true;
          break;
        }
      } catch (e) {}
    }

    if (connected) {
      setGeminiConfigFeedback(`Conexão bem-sucedida! Modelo ${successfulModel} ativo e pronto para uso.`, 'success');
    } else {
      setGeminiConfigFeedback(`Não foi possível validar a chave. Verifique se sua chave do Google AI Studio está ativa.`, 'error');
    }
  } catch (error) {
    setGeminiConfigFeedback(`Erro de rede: ${error.message}. Verifique sua conexão e tente novamente.`, 'error');
  }
}

function handleGeminiRemove() {
  removeGeminiApiKey();
  updateAIStatus();
  renderGeminiConfigState();
  setGeminiConfigFeedback('Chave removida da aplicação. O gerador local continuará disponível.', 'warning');
  appendLog(`🗑️ Chave do Gemini IA removida das configurações. O sistema voltou ao modo de geração local.`, 'log-warning');
}
/**
 * Exibe o resultado da geração com cards e botões de ação rápidos
 */
function renderGeneratedOutput(genData) {
  const { id, clientData, versions } = genData;
  const rawPhone = String(clientData.telefone || '').replace(/[^\d]/g, '');
  const cleanPhone = rawPhone ? (rawPhone.length === 11 || rawPhone.length === 10 ? '55' + rawPhone : rawPhone) : '';
  const campaignObj = clientData.campaign || genData.campaign;

  const cardHTML = `
    <div class="message-card" id="card-${id}">
      <div class="card-header">
        <div class="card-meta">
          ${genData.isAI ? `<span class="meta-pill" style="background: rgba(0, 255, 204, 0.15); color: #00ffcc; border: 1px solid #00ffcc;">🤖 Gemini IA</span>` : ''}
          ${campaignObj ? `<span class="meta-pill pill-campaign">📢 Campanha: <strong>${escapeHTML(campaignObj.name)}</strong></span>` : ''}
          <span class="meta-pill">👤 Cliente: <strong>${escapeHTML(clientData.nome)}</strong></span>
          <span class="meta-pill">${clientData.classification.icon} ${escapeHTML(clientData.classification.label)}: <strong>${escapeHTML(clientData.medicamento)}</strong></span>
          <span class="meta-pill">🏬 Drogaria: <strong>${escapeHTML(clientData.drogaria)}</strong></span>
          <span class="meta-pill">👨⚕️ Farmacêutico: <strong>${escapeHTML(clientData.farmaceutico)}</strong></span>
        </div>
        <span class="log-dim">${genData.timestamp}</span>
      </div>

      <div style="margin-bottom: 8px; display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="card-btn active" id="tab-btn-empatico-${id}" onclick="switchToneTab(${id}, 'empatico')">💚 Empático & Carinhoso</button>
        <button class="card-btn" id="tab-btn-atencioso-${id}" onclick="switchToneTab(${id}, 'atencioso')">📋 Atencioso & Padrão</button>
        <button class="card-btn" id="tab-btn-descontraido-${id}" onclick="switchToneTab(${id}, 'descontraido')">😊 Descontraído</button>
        <button class="card-btn" id="tab-btn-pos_tratamento-${id}" onclick="switchToneTab(${id}, 'pos_tratamento')">🎯 Pós-Tratamento</button>
      </div>

      <div class="card-body-text" id="text-container-${id}">${escapeHTML(typeof versions.empatico === 'object' ? versions.empatico.text : versions.empatico)}</div>

      <div class="card-actions">
        <button class="card-btn btn-copy" onclick="copyMessageText(${id})">📋 Copiar Mensagem</button>
        ${cleanPhone ? `<button class="card-btn btn-whatsapp" onclick="openWhatsApp('${cleanPhone}', ${id})">💬 Enviar via WhatsApp (${escapeHTML(clientData.telefone)})</button>` : `<button class="card-btn btn-whatsapp" onclick="openWhatsApp('', ${id})">💬 Abrir no WhatsApp</button>`}
        <button class="card-btn" onclick="startWizardFromCard(${id})">🔄 Novo Ajuste</button>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = cardHTML;
  terminalOutput.appendChild(container);
  
  // Guardar versões de texto associadas no DOM element
  const cardElem = document.getElementById(`card-${id}`);
  if (cardElem) {
    cardElem.dataset.versions = JSON.stringify(versions);
    cardElem.dataset.activeTone = 'empatico';
    cardElem.dataset.clientNome = clientData.nome || '';
    cardElem.dataset.clientMed = clientData.medicamento || '';
  }

  scrollToBottom();
}

function startWizardFromCard(id) {
  const cardElem = document.getElementById(`card-${id}`);
  if (!cardElem) {
    startWizard();
    return;
  }
  const nome = cardElem.dataset.clientNome || '';
  const med = cardElem.dataset.clientMed || '';
  startWizard(nome, med);
}

function switchToneTab(id, toneKey) {
  const cardElem = document.getElementById(`card-${id}`);
  if (!cardElem) return;
  const versions = JSON.parse(cardElem.dataset.versions);
  cardElem.dataset.activeTone = toneKey;

  const textContainer = document.getElementById(`text-container-${id}`);
  if (textContainer && versions[toneKey]) {
    const val = versions[toneKey];
    textContainer.innerText = typeof val === 'object' ? val.text : val;
  }

  ['empatico', 'atencioso', 'descontraido', 'pos_tratamento'].forEach(key => {
    const btn = document.getElementById(`tab-btn-${key}-${id}`);
    if (btn) {
      btn.classList.toggle('active', key === toneKey);
    }
  });
}

function copyTextToClipboard(textToCopy, successMsg = '✅ Mensagem copiada com sucesso!') {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (successMsg) appendLog(successMsg, 'log-success');
    }).catch(() => {
      fallbackCopyText(textToCopy, successMsg);
    });
  } else {
    fallbackCopyText(textToCopy, successMsg);
  }
}

function fallbackCopyText(textToCopy, successMsg) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful && successMsg) {
      appendLog(successMsg, 'log-success');
    } else if (!successful) {
      appendLog('⚠️ Não foi possível copiar para a área de transferência.', 'log-warning');
    }
  } catch (err) {
    appendLog('⚠️ Erro ao copiar texto.', 'log-error');
  }
}

function copyMessageText(id) {
  const cardElem = document.getElementById(`card-${id}`);
  if (!cardElem) return;
  const activeTone = cardElem.dataset.activeTone || 'empatico';
  const versions = JSON.parse(cardElem.dataset.versions);
  const rawVal = versions[activeTone];
  const textToCopy = (typeof rawVal === 'object' ? rawVal.text : rawVal).replace(/\*\*/g, '').replace(/\*/g, '');

  copyTextToClipboard(textToCopy, '✅ Mensagem copiada com sucesso para a área de transferência!');
}
/**
 * Redireciona para o Gerador de Mensagens em Lote Inteligente (Fluxo Único do Sistema)
 */
function startWizard(defaultNome = '', defaultMed = '') {
  startBatchWizard();
}

function cancelWizard() {
  const wiz = document.getElementById('wizardBox');
  if (wiz) wiz.remove();
  appendLog(`Formulário cancelado.`, 'log-dim');
  cliInput.focus();
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  setTimeout(() => {
    const out = terminalOutput || (typeof document !== 'undefined' ? document.getElementById('terminalOutput') : null);
    if (out) out.scrollTop = out.scrollHeight;
  }, 50);
}

function appendLog(content, className = '') {
  const out = terminalOutput || (typeof document !== 'undefined' ? document.getElementById('terminalOutput') : null);
  if (!out) return;
  const div = document.createElement('div');
  div.className = `log-line ${className}`;
  div.innerHTML = content;
  out.appendChild(div);
  scrollToBottom();
}
/* ==========================================================================
   MOTOR DE GERAÇÃO EM LOTE COM PROTEÇÃO ANTI-SPAM (WHATSAPP SAFE)
   ========================================================================== */

const ANTI_SPAM_BLOCKS = {
  saudacoes: [
    (nome) => `Olá, ${nome}! Tudo bem? 😊`,
    (nome) => `Oi, ${nome}! Como você está?`,
    (nome) => `Olá, ${nome}, tudo certinho por aí?`,
    (nome) => `${getSaudacaoHorario()}, ${nome}! Tudo bom?`,
    (nome) => `${getSaudacaoHorario()}, ${nome}! Espero que esteja bem!`,
    (nome) => `Oi ${nome}, como vai? Tudo tranquilo?`,
    (nome) => `Olá ${nome}! Espero te encontrar com muita saúde!`
  ],

  apresentacoes: [
    (farm, drog) => `Aqui é o farmacêutico **${farm}**, da **${drog}**!`,
    (farm, drog) => `Quem fala é o **${farm}**, farmacêutico aqui da **${drog}**.`,
    (farm, drog) => `Passando por aqui o **${farm}**, farmacêutico na **${drog}**.`,
    (farm, drog) => `Sou eu, o **${farm}**, seu farmacêutico da **${drog}**.`,
    (farm, drog) => `Aqui é o **${farm}** da equipe de atenção farmacêutica da **${drog}**.`
  ],

  perguntasMedicamento: [
    (med, tempo, sintoma) => `Estou te escrevendo para acompanhar como você está se sentindo${sintoma ? ' em relação a ' + sintoma : ''} e se deu tudo certo com o uso do **${med}**${tempo ? ' (' + tempo + ')' : ''}. O tratamento está sendo tranquilo?`,
    (med, tempo, sintoma) => `Passando rapidinho para saber como você passou após iniciar o tratamento com o **${med}**${tempo ? ' (' + tempo + ')' : ''}. Notou melhora nos sintomas${sintoma ? ' de ' + sintoma : ''}?`,
    (med, tempo, sintoma) => `Fiz este contato para saber como está sendo a sua recuperação com o **${med}**${tempo ? ' ' + tempo : ''}. Correu tudo bem com o início das doses?`,
    (med, tempo, sintoma) => `Gostaria de acompanhar de perto a sua saúde: correu tudo bem com a medicação **${med}**${tempo ? ' (' + tempo + ')' : ''}? Está se sentindo melhor?`,
    (med, tempo, sintoma) => `Vim te perguntar como você está se sentindo em relação ao **${med}**${tempo ? ' iniciado ' + tempo : ''}. Conseguiu tomar os remédios nos horários corretos?`
  ],

  perguntasServico: [
    (serv, tempo, sub) => {
      if (sub === 'injetavel') return `Estou te escrevendo para saber como você está se sentindo após a **${serv}** realizada aqui na farmácia. Ficou com alguma dor no local da aplicação?`;
      if (sub === 'sensor_libre') return `Passando para acompanhar a aplicação do **Sensor Libre** feita com você na farmácia. O sensor está bem fixado e as leituras de glicose estão tranquilas?`;
      if (sub === 'pressao') return `Passando para acompanhar seu bem-estar após a **aferição de pressão arterial** realizada aqui na farmácia. Notou melhora no seu estado geral?`;
      if (sub === 'orelha') return `Gostaria de saber como está a cicatrização após a **perfuração do lóbulo auricular** feita aqui na farmácia. Está tudo certinho com o local?`;
      if (sub === 'influenza') return `Estou te escrevendo para acompanhar seu estado de saúde após o **teste de Influenza (gripe)** feito com a gente. Teve melhora da febre ou indisposição?`;
      if (sub === 'covid') return `Passando para saber como você está se sentindo após o **teste de COVID-19** realizado na farmácia. Está conseguindo manter o repouso recomendado?`;
      if (sub === 'painel_respiratorio') return `Gostaria de acompanhar a sua recuperação após o **teste de painel respiratório** feito na farmácia. Notou alívio nos sintomas respiratórios?`;
      if (sub === 'bioimpedancia') return `Passando para saber se deu tudo certo com o seu exame de **Bioimpedância** e se ficou com alguma dúvida sobre o relatório de composição corporal!`;
      if (sub === 'glicemia') return `Gostaria de acompanhar como você passou após o teste de **glicemia capilar** feito com a gente. Está tudo tranquilo com sua rotina?`;
      return `Estou te escrevendo para acompanhar seu atendimento de **${serv}** feito aqui com a gente${tempo ? ' (' + tempo + ')' : ''}. Correu tudo bem com o procedimento?`;
    },
    (serv, tempo, sub) => {
      if (sub === 'injetavel') return `Passando rapidinho para conferir como ficou o local da aplicação da **${serv}**. Sentiu algum incômodo ou desconforto?`;
      if (sub === 'sensor_libre') return `Fiz este contato para saber se deu tudo certo com a **colocação do Sensor Libre** e se as medições no app estão normais.`;
      if (sub === 'pressao') return `Fiz este contato para saber como você está após a **medição de pressão** que fizemos aqui na farmácia. Está se sentindo mais disposto(a)?`;
      if (sub === 'orelha') return `Passando rapidinho para conferir o furo de orelha / lóbulo: está usando o antisséptico certinho e sem inchaço no local?`;
      if (sub === 'influenza') return `Vim te perguntar como você passou após a testagem de **gripe / Influenza**. Conseguiu seguir as recomendações?`;
      if (sub === 'covid') return `Fiz este contato para acompanhar sua evolução após o **teste rápido de COVID**. Está se alimentando e se hidratando bem?`;
      if (sub === 'painel_respiratorio') return `Vim te perguntar como estão seus sintomas após o **exame de vírus respiratórios**. Conseguiu o repouso necessário?`;
      if (sub === 'bioimpedancia') return `Fiz este contato para saber como você avaliou seus resultados de **Bioimpedância (massa magra / gordura)**. Quer tirar alguma dúvida?`;
      if (sub === 'glicemia') return `Vim te perguntar como você está após a checagem da **glicemia**. Seguiu direitinho as recomendações que conversamos?`;
      return `Passando para saber como você se sentiu após realizar o serviço de **${serv}** na nossa farmácia${tempo ? ' ' + tempo : ''}. Deu tudo certo?`;
    },
    (serv, tempo, sub) => {
      return `Fiz este contato para saber se deu tudo certo com o seu atendimento de **${serv}** na ${DEFAULT_CONFIG.drogaria}. Como você está se sentindo agora?`;
    }
  ],

  suporte: [
    () => `Se você tiver qualquer dúvida sobre os horários, doses ou recomendações, pode me chamar por aqui a qualquer momento!`,
    () => `Qualquer dúvida ou desconforto que sentir, estou totalmente à sua disposição aqui no WhatsApp para orientar.`,
    () => `Se precisar de qualquer esclarecimento ou apoio farmacêutico, é só responder esta mensagem!`,
    () => `Caso tenha dúvidas sobre como proceder ou precise de mais orientações, pode contar comigo por aqui.`,
    () => `Qualquer necessidade ou dúvida sobre sua saúde, estou sempre à disposição aqui na farmácia.`
  ],

  despedidas: [
    (farm, drog) => `Desejo uma excelente recuperação! 💚\n\nAbraços,\n*${farm}* | ${drog}`,
    (farm, drog) => `Tenha um ótimo dia e cuide-se bem! ✨\n\nAtenciosamente,\n*${farm}* - ${drog}`,
    (farm, drog) => `Desejo muita saúde para você! 💚\n\nUm grande abraço,\n*${farm}* | ${drog}`,
    (farm, drog) => `Fique com Deus e boa recuperação! 🙏\n\n*${farm}* (${drog})`,
    (farm, drog) => `Estou à disposição para o que precisar!\n\nCom carinho,\n*${farm}* - ${drog}`
  ]
};

const usedMessageHashes = new Set();

function generateUniqueAntiSpamMessage(itemData, indexInBatch) {
  const nome = capitalizeName(itemData.nome || 'Cliente');
  const item = itemData.medicamento || 'Atendimento';
  const drogaria = itemData.drogaria || DEFAULT_CONFIG.drogaria;
  const farmaceutico = itemData.farmaceutico || DEFAULT_CONFIG.farmaceutico;
  const tempo = itemData.tempo || '';
  const sintoma = itemData.sintoma || '';
  const classification = classifyItem(item, itemData.tipoOverride || 'auto');
  const activeCampaign = (itemData.includeCampaign !== false && typeof isCampaignActive === 'function' && isCampaignActive()) ? (typeof getActiveCampaign === 'function' ? getActiveCampaign() : null) : null;
  const campaignBlock = (activeCampaign && typeof formatCampaignMessageBlock === 'function') ? formatCampaignMessageBlock(activeCampaign, drogaria) : '';

  let attempts = 0;
  let finalMessage = '';
  let uniqueHash = '';

  while (attempts < 50) {
    attempts++;

    const idxSaudacao = (indexInBatch + attempts + Math.floor(Math.random() * 10)) % ANTI_SPAM_BLOCKS.saudacoes.length;
    const idxApres = (indexInBatch + attempts + Math.floor(Math.random() * 10)) % ANTI_SPAM_BLOCKS.apresentacoes.length;
    const idxSuporte = (indexInBatch + attempts + Math.floor(Math.random() * 10)) % ANTI_SPAM_BLOCKS.suporte.length;
    const idxDespedida = (indexInBatch + attempts + Math.floor(Math.random() * 10)) % ANTI_SPAM_BLOCKS.despedidas.length;

    const saudacaoStr = ANTI_SPAM_BLOCKS.saudacoes[idxSaudacao](nome);
    const apresStr = ANTI_SPAM_BLOCKS.apresentacoes[idxApres](farmaceutico, drogaria);
    
    let perguntaStr = '';
    if (classification.type === 'servico') {
      const idxPerg = (indexInBatch + attempts) % ANTI_SPAM_BLOCKS.perguntasServico.length;
      perguntaStr = ANTI_SPAM_BLOCKS.perguntasServico[idxPerg](item, tempo, classification.subType);
    } else {
      const idxPerg = (indexInBatch + attempts) % ANTI_SPAM_BLOCKS.perguntasMedicamento.length;
      perguntaStr = ANTI_SPAM_BLOCKS.perguntasMedicamento[idxPerg](item, tempo, sintoma);
    }

    const suporteStr = ANTI_SPAM_BLOCKS.suporte[idxSuporte]();
    const despedidaStr = ANTI_SPAM_BLOCKS.despedidas[idxDespedida](farmaceutico, drogaria);

    // Caractere invisível Zero-Width Space (\u200B) para diferenciar o rastro de bytes de cada envio no WhatsApp
    const zeroWidthPadding = '\u200B'.repeat((indexInBatch + 1) % 5 + 1);

    finalMessage = `${saudacaoStr}\n\n${apresStr}\n\n${perguntaStr}\n\n${suporteStr}${campaignBlock}\n\n${despedidaStr}${zeroWidthPadding}`;
    uniqueHash = simpleStringHash(finalMessage);

    if (!usedMessageHashes.has(uniqueHash)) {
      usedMessageHashes.add(uniqueHash);
      break;
    }
  }

  return {
    id: Date.now() + Math.random(),
    timestamp: new Date().toLocaleString('pt-BR'),
    clientData: {
      nome,
      medicamento: item,
      drogaria,
      farmaceutico,
      telefone: itemData.telefone ? itemData.telefone.replace(/\D/g, '') : '',
      classification,
      campaign: activeCampaign
    },
    campaign: activeCampaign,
    messageText: finalMessage,
    hashSignature: uniqueHash
  };
}

function simpleStringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'SIG_' + Math.abs(hash).toString(36);
}

function sanitizeGeminiBatchJsonResponse(rawText, expectedCount, startIndex = 0) {
  if (!rawText || typeof rawText !== 'string') {
    return new Array(expectedCount).fill(null);
  }

  const cleanVal = (v) => {
    if (typeof v !== 'string') return v ? String(v) : '';
    return v.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
  };

  const results = new Array(expectedCount).fill(null);

  const extractMessageFromItem = (item) => {
    if (!item) return '';
    if (typeof item === 'string') return cleanVal(item);
    if (typeof item === 'object') {
      const direct = item.mensagem || item.message || item.texto || item.text || item.conteudo || item.msg || item.atencioso || item.empatico;
      if (typeof direct === 'string' && direct.trim()) return cleanVal(direct);
      for (const val of Object.values(item)) {
        if (typeof val === 'string' && val.trim().length > 15) {
          return cleanVal(val);
        }
      }
    }
    return '';
  };

  let cleaned = rawText.replace(/^```(?:json)?/gim, '').replace(/```$/gim, '').trim();

  const candidates = [];
  const k1 = cleaned.indexOf('['), k2 = cleaned.lastIndexOf(']');
  if (k1 !== -1 && k2 > k1) candidates.push(cleaned.slice(k1, k2 + 1));
  const b1 = cleaned.indexOf('{'), b2 = cleaned.lastIndexOf('}');
  if (b1 !== -1 && b2 > b1) candidates.push(cleaned.slice(b1, b2 + 1));
  candidates.push(cleaned);

  for (const cand of candidates) {
    let parsed = null;
    try {
      parsed = JSON.parse(cand);
    } catch (e) {
      try {
        const sanitized = cand.replace(/"(?:[^"\\]|\\.)*"/gs, (m) => m.replace(/\r?\n/g, '\\n'));
        parsed = JSON.parse(sanitized);
      } catch (e2) {}
    }

    if (parsed) {
      if (Array.isArray(parsed)) {
        parsed.forEach((entry, idx) => {
          let targetIdx = idx;
          if (entry && typeof entry === 'object' && entry.index !== undefined) {
            const numIdx = Number(entry.index);
            if (!isNaN(numIdx)) {
              targetIdx = numIdx >= startIndex ? numIdx - startIndex : numIdx;
            }
          }
          if (targetIdx >= 0 && targetIdx < expectedCount) {
            const msg = extractMessageFromItem(entry);
            if (msg && !results[targetIdx]) results[targetIdx] = msg;
          }
        });
        if (results.some(r => r !== null)) return results;
      } else if (typeof parsed === 'object') {
        const list = parsed.mensagens || parsed.messages || parsed.items || parsed.lote || parsed.clientes || parsed.data;
        if (Array.isArray(list)) {
          list.forEach((entry, idx) => {
            let targetIdx = idx;
            if (entry && typeof entry === 'object' && entry.index !== undefined) {
              const numIdx = Number(entry.index);
              if (!isNaN(numIdx)) {
                targetIdx = numIdx >= startIndex ? numIdx - startIndex : numIdx;
              }
            }
            if (targetIdx >= 0 && targetIdx < expectedCount) {
              const msg = extractMessageFromItem(entry);
              if (msg && !results[targetIdx]) results[targetIdx] = msg;
            }
          });
          if (results.some(r => r !== null)) return results;
        } else {
          Object.entries(parsed).forEach(([k, v]) => {
            const numIdx = Number(k);
            if (!isNaN(numIdx)) {
              const targetIdx = numIdx >= startIndex ? numIdx - startIndex : numIdx;
              if (targetIdx >= 0 && targetIdx < expectedCount) {
                const msg = extractMessageFromItem(v);
                if (msg && !results[targetIdx]) results[targetIdx] = msg;
              }
            }
          });
          if (results.some(r => r !== null)) return results;
        }
      }
    }
  }

  // Fallback com regex
  const msgRegex = /"mensagem"\s*:\s*"((?:[^"\\]|\\.)*)"/gi;
  let m;
  let regexIdx = 0;
  while ((m = msgRegex.exec(cleaned)) !== null && regexIdx < expectedCount) {
    if (!results[regexIdx]) {
      results[regexIdx] = cleanVal(m[1]);
    }
    regexIdx++;
  }

  return results;
}

async function generateBatchMessagesAI(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const farmaceutico = options.farmaceutico || DEFAULT_CONFIG.farmaceutico;
  const drogaria = options.drogaria || DEFAULT_CONFIG.drogaria;
  const tom = options.tom || 'equilibrado';
  const customInstruction = (options.customInstruction || options.customPrompt || '').trim();
  const activeCampaign = (options.includeCampaign !== false && typeof isCampaignActive === 'function' && isCampaignActive()) ? (typeof getActiveCampaign === 'function' ? getActiveCampaign() : null) : null;

  let tomGuidance = 'Tom de voz empático, atencioso, acolhedor e humanizado.';
  if (tom === 'empatico') {
    tomGuidance = 'Tom estritamente empático, acolhedor e humanizado. Priorize o bem-estar e o alívio de eventuais desconfortos.';
  } else if (tom === 'atencioso') {
    tomGuidance = 'Tom atencioso, técnico e clínico. Enfatize a adesão aos horários, posologia e recomendações farmacêuticas.';
  } else if (tom === 'descontraido') {
    tomGuidance = 'Tom leve, descontraído e próximo, usando linguagem calorosa e amigável para o dia a dia.';
  } else if (tom === 'pos_tratamento') {
    tomGuidance = 'Tom focado em pós-atendimento e acompanhamento final. Pergunte se o tratamento foi concluído com sucesso e se há dúvidas.';
  }

  const extraInstructionPrompt = customInstruction 
    ? `\n6. DIRETRIZ EXTRA DO FARMACÊUTICO RESPONSÁVEL: "${customInstruction}". Aplique de forma natural nas mensagens onde for pertinente.`
    : '';

  const campaignBatchGuidance = activeCampaign ? `
7. CAMPANHA DE SAÚDE 100% GRATUITA NA FARMÁCIA: "${activeCampaign.name}" (${activeCampaign.period}). Serviços 100% Gratuitos: ${activeCampaign.services.join(', ')}. Chamada: "${activeCampaign.highlightText}".
DIRETRIZ DE CAMPANHA IA: Destaque de forma acolhedora e calorosa nas mensagens um convite para os clientes aproveitarem esta ação de saúde 100% gratuita (sem qualquer custo) na drogaria.` : '';

  const CHUNK_SIZE = 8;
  const results = [];

  for (let chunkStart = 0; chunkStart < items.length; chunkStart += CHUNK_SIZE) {
    const chunkItems = items.slice(chunkStart, chunkStart + CHUNK_SIZE);

    const clientsDescription = chunkItems.map((item, idx) => {
      const globalIdx = chunkStart + idx;
      const nome = capitalizeName(item.nome || 'Cliente');
      const med = item.medicamento || 'Atendimento';
      const classification = classifyItem(med, item.tipoOverride || 'auto');
      const sintoma = item.sintoma ? ` | Sintoma/Obs: ${item.sintoma}` : '';
      const tempo = item.tempo ? ` | Tempo: ${item.tempo}` : '';
      const dica = item.dica ? ` | Dica: ${item.dica}` : '';
      return `[Cliente ${globalIdx}] Nome: ${nome} | Item: ${med} (${classification.label})${sintoma}${tempo}${dica}`;
    }).join('\n');

    const prompt = `
Você é o Farmacêutico ${farmaceutico} da filial ${drogaria}.
Sua missão é gerar mensagens de acompanhamento farmacêutico pós-venda/pós-atendimento via WhatsApp para a lista de clientes abaixo usando inteligência artificial.

DIRETRIZ DE ESTILO / TOM:
${tomGuidance}

REGRAS OBRIGATÓRIAS ANTI-SPAM E CLÍNICAS:
1. Cada mensagem DEVE ser estritamente humanizada, ética, acolhedora e personalizada para o medicamento ou procedimento do cliente.
2. WhatsApp Safe / Anti-Spam: NENHUMA mensagem pode ser idêntica a outra. Alterne saudações, construções de frases, perguntas sobre o bem-estar e despedidas acolhedoras.
3. Formatação WhatsApp: use quebras de linha limpas, negrito (*palavra*) onde necessário e emojis adequados com moderação.
4. Responda ESTRITAMENTE em formato JSON (Array de objetos) sem explicações ou markdown fora do JSON.
5. Cada item do array deve ter exatamente as propriedades: "index" (número do cliente), "nome" (nome do cliente) e "mensagem" (texto completo da mensagem para o WhatsApp).${extraInstructionPrompt}${campaignBatchGuidance}

CLIENTES PARA PROCESSAR:
${clientsDescription}

FORMATO JSON EXATO:
[
  {
    "index": ${chunkStart},
    "nome": "${chunkItems[0]?.nome || 'Cliente'}",
    "mensagem": "Olá, ...! Aqui é o farmacêutico ${farmaceutico}... Como você está se sentindo..."
  }
]
`;

    let chunkMessages = [];
    try {
      const rawText = await callGeminiAPI(prompt, GEMINI_BATCH_RESPONSE_SCHEMA);
      chunkMessages = sanitizeGeminiBatchJsonResponse(rawText, chunkItems.length, chunkStart);
    } catch (err) {
      appendLog(`⚠️ <strong>Gemini IA:</strong> falha no bloco de clientes ${chunkStart + 1} a ${chunkStart + chunkItems.length} (${escapeHTML(err.message)}) → Usando fallback local para este bloco.`, 'log-warning');
      chunkMessages = new Array(chunkItems.length).fill(null);
    }

    chunkItems.forEach((itemData, localIdx) => {
      const globalIdx = chunkStart + localIdx;
      const aiMessageText = chunkMessages[localIdx];
      const nome = capitalizeName(itemData.nome || 'Cliente');
      const item = itemData.medicamento || 'Atendimento';
      const classification = classifyItem(item, itemData.tipoOverride || 'auto');

      if (aiMessageText && typeof aiMessageText === 'string' && aiMessageText.trim().length > 10) {
        const zeroWidthPadding = '\u200B'.repeat((globalIdx + 1) % 5 + 1);
        const finalMessage = `${aiMessageText.trim()}${zeroWidthPadding}`;
        const uniqueHash = simpleStringHash(finalMessage);
        usedMessageHashes.add(uniqueHash);

        results.push({
          id: Date.now() + Math.random(),
          timestamp: new Date().toLocaleString('pt-BR'),
          clientData: {
            nome,
            medicamento: item,
            drogaria: itemData.drogaria || drogaria,
            farmaceutico: itemData.farmaceutico || farmaceutico,
            telefone: itemData.telefone ? itemData.telefone.replace(/\D/g, '') : '',
            sintoma: itemData.sintoma || '',
            tempo: itemData.tempo || '',
            dica: itemData.dica || '',
            classification,
            campaign: activeCampaign
          },
          campaign: activeCampaign,
          messageText: finalMessage,
          hashSignature: uniqueHash,
          isAI: true,
          tom: tom
        });
      } else {
        const fallbackItem = generateUniqueAntiSpamMessage({ ...itemData, includeCampaign: options.includeCampaign }, globalIdx);
        fallbackItem.isAI = false;
        results.push(fallbackItem);
      }
    });
  }

  return results;
}

async function generateBatchMessagesSmart(items, options = {}) {
  const apiKey = getGeminiApiKey();
  const forceLocal = options.useAI === false || options.forceLocal === true;
  const includeCampaign = options.includeCampaign !== false;

  if (!apiKey || forceLocal) {
    if (!apiKey && !forceLocal) {
      appendLog(`ℹ️ <strong>Gemini IA:</strong> Chave não configurada. Usando gerador anti-spam local.`, 'log-info');
    }
    return items.map((item, idx) => {
      const res = generateUniqueAntiSpamMessage({ ...item, includeCampaign }, idx);
      res.isAI = false;
      return res;
    });
  }

  if (isGeminiTemporarilyBlocked()) {
    appendLog(`🛑 <strong>Gemini IA bloqueada temporariamente.</strong> Usando gerador anti-spam local de fallback.`, 'log-warning');
    return items.map((item, idx) => {
      const res = generateUniqueAntiSpamMessage({ ...item, includeCampaign }, idx);
      res.isAI = false;
      return res;
    });
  }

  appendLog(`🤖 <strong>Gemini IA:</strong> Gerando mensagens personalizadas em lote para <strong>${items.length}</strong> cliente(s)...`, 'log-info');

  try {
    const aiResults = await generateBatchMessagesAI(items, { ...options, includeCampaign });
    resetGeminiFailureState();
    appendLog(`✨ Lote processado via <strong>Gemini IA</strong> com sucesso!`, 'log-success');
    return aiResults;
  } catch (err) {
    registerGeminiFailure(err);
    appendLog(`⚠️ <strong>Gemini IA indisponível para o lote:</strong> ${escapeHTML(err.message)} → Usando gerador anti-spam local de fallback.`, 'log-warning');
    return items.map((item, idx) => {
      const res = generateUniqueAntiSpamMessage({ ...item, includeCampaign }, idx);
      res.isAI = false;
      return res;
    });
  }
}

function toggleBatchAiOptions(isChecked) {
  const block = document.getElementById('batchAiOptionsBlock');
  if (block) {
    block.style.display = isChecked ? 'grid' : 'none';
  }
}

function saveInlineBatchGeminiKey() {
  const input = document.getElementById('batchInlineApiKey');
  const key = input ? input.value.trim() : '';
  if (!key) {
    appendLog('⚠️ Por favor, informe uma chave de API válida.', 'log-warning');
    return;
  }
  saveGeminiApiKey(key);
  resetGeminiFailureState();
  updateAIStatus();
  appendLog('✨ Chave do Gemini configurada com sucesso! IA ativada no painel em lote.', 'log-success');
  startBatchWizard();
}

function startBatchWizard(initialText = '') {
  const existingInput = document.getElementById('batchInputText');
  const textValue = initialText || (existingInput ? existingInput.value : '');
  const hasApiKey = Boolean(getGeminiApiKey());
  const isBlocked = isGeminiTemporarilyBlocked();
  const isAiActive = hasApiKey && !isBlocked;
  const isCampActive = isCampaignActive();
  const activeCamp = getActiveCampaign();

  const wizardHTML = `
    <div class="wizard-box" id="wizardBox">
      <div class="wizard-title" style="color: var(--warning-color);">
        <span>📦 Gerador em Lote Inteligente (WhatsApp + Gemini IA)</span>
      </div>
      <p class="log-dim" style="margin-bottom: 10px;">
        🛡️ <strong>Proteção Anti-Bloqueio:</strong> Cada mensagem é gerada com arranjos semânticos e marcas invisíveis exclusivas. <strong>Nenhuma mensagem é idêntica a outra</strong>, evitando gatilhos de spam do WhatsApp.
      </p>

      <div class="batch-ai-status-banner" style="margin-bottom: 12px; padding: 10px 14px; border-radius: 6px; border: 1px solid ${isAiActive ? 'rgba(0, 255, 204, 0.4)' : 'var(--border-color)'}; background: ${isAiActive ? 'rgba(0, 255, 204, 0.06)' : 'var(--bg-card)'}; font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
          <div>
            ${isAiActive 
              ? `✨ <strong style="color: #00ffcc;">Gemini IA Ativo (${escapeHTML(GEMINI_MODEL_LABEL)}):</strong> As mensagens serão redigidas e personalizadas com Inteligência Artificial para cada cliente.` 
              : `🛡️ <strong style="color: var(--text-dim);">Motor Anti-Spam Local:</strong> Usando templates parametrizados. <span style="font-size: 0.75rem;">(Ative a IA abaixo ou em <a href="javascript:void(0)" onclick="openGeminiConfigPanel()" style="color: var(--prompt-color); text-decoration: underline;">Configurações</a>)</span>`}
          </div>
          ${isAiActive ? `
          <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; cursor: pointer; white-space: nowrap; color: #00ffcc; font-weight: 600;">
            <input type="checkbox" id="batchUseAiCheckbox" checked onchange="toggleBatchAiOptions(this.checked)"> Usar IA Gemini
          </label>` : ''}
        </div>
        ${!isAiActive ? `
        <div class="batch-key-quick-form" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; padding-top: 8px; border-top: 1px dashed var(--border-color);">
          <span style="font-size: 0.78rem; color: var(--text-bright);">🔑 Ativar Gemini IA no Lote:</span>
          <input type="password" id="batchInlineApiKey" placeholder="Cole sua chave da API Gemini (AIzaSy...)" style="flex: 1; min-width: 220px; padding: 6px 10px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-bright);">
          <button type="button" class="tool-btn primary" onclick="saveInlineBatchGeminiKey()" style="font-size: 0.78rem; padding: 5px 12px; background: #00ffcc; color: #000; font-weight: 700;">✨ Salvar & Ativar IA</button>
        </div>` : ''}
      </div>

      <form id="batchForm" onsubmit="handleBatchSubmit(event)">
        <div class="form-row" id="batchAiOptionsBlock" style="${isAiActive ? 'display: grid;' : 'display: none;'} margin-bottom: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>✨ Tom de Voz da IA Gemini:</label>
            <select id="batchAiToneSelect">
              <option value="equilibrado" selected>🌟 Equilibrado (Padrão Humanizado)</option>
              <option value="empatico">💖 Empático & Acolhedor (Alívio & Cuidado)</option>
              <option value="atencioso">🩺 Atencioso & Clínico (Horários & Adesão)</option>
              <option value="descontraido">😊 Descontraído & Leve (Linguagem Próxima)</option>
              <option value="pos_tratamento">🔄 Pós-Tratamento & Retorno (Acompanhamento)</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label>💡 Instruções Extras para o Gemini (Opcional):</label>
            <input type="text" id="batchCustomInstruction" placeholder="Ex: Lembrar de tomar com água, reforçar repouso...">
          </div>
        </div>

        <div class="form-group">
          <label>📝 Cole a Lista de Clientes (Um por linha):</label>
          <div class="log-dim" style="font-size: 0.78rem; margin-bottom: 6px;">
            Formato: <code>Nome | Medicamento ou Serviço | Telefone (opcional) | Sintoma/Obs (opcional)</code>
          </div>
          <textarea id="batchInputText" rows="7" placeholder="Exemplos:&#10;Maria Silva | Amoxicilina 500mg | 11988887777 | dor de garganta&#10;Carlos Souza | Aferição de Pressão | 11977776666&#10;Ana Paula | Aplicação de Voltaren | 11966665555 | dor nas costas&#10;Roberto Lima | Losartana 50mg | 11955554444" required>${escapeHTML(textValue)}</textarea>
        </div>

        ${isCampActive ? `
        <div class="form-group" style="margin-bottom: 12px; padding: 10px 12px; background: rgba(0, 255, 102, 0.08); border: 1px solid rgba(0, 255, 102, 0.3); border-radius: 6px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #00ff66; font-weight: 600; margin: 0;">
            <input type="checkbox" id="batchIncludeCampaignCheckbox" checked style="accent-color: #00ff66; width: 16px; height: 16px;">
            <span>📢 Incluir Ação de Saúde 100% Gratuita: <strong>${escapeHTML(activeCamp.name)}</strong></span>
          </label>
          <div style="font-size: 0.76rem; color: var(--text-dim); margin-top: 4px; padding-left: 24px;">
            ✨ Destaca serviços 100% gratuitos (${escapeHTML((activeCamp.services || []).join(', '))}) em cada mensagem personalizada gerada no lote.
          </div>
        </div>` : `
        <div class="form-group" style="margin-bottom: 12px; padding: 8px 12px; background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
          <span class="log-dim" style="font-size: 0.78rem;">🎯 Nenhuma campanha de saúde ativa no momento.</span>
          <button type="button" class="tool-btn" onclick="openCampaignModal()" style="font-size: 0.75rem; padding: 3px 10px; border-color: #00ff66; color: #00ff66;">+ Ativar Campanha Gratuita</button>
        </div>`}

        <div class="form-actions">
          <button type="submit" id="batchSubmitBtn" class="tool-btn primary" style="background: var(--warning-color); color: #000;">🚀 Gerar Mensagens em Lote (WhatsApp Safe)</button>
          <button type="button" class="tool-btn danger" onclick="cancelWizard()">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  const oldWiz = document.getElementById('wizardBox');
  if (oldWiz) oldWiz.remove();

  const container = document.createElement('div');
  container.innerHTML = wizardHTML;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function parseBatchInputLine(line) {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (!trimmed) return null;

  let delimiter = '|';
  if (trimmed.includes('\t')) {
    delimiter = '\t';
  } else if (trimmed.includes('|')) {
    delimiter = '|';
  } else if (trimmed.includes(';')) {
    delimiter = ';';
  } else if (trimmed.includes(',')) {
    delimiter = ',';
  }

  const parts = trimmed.split(delimiter).map(p => p.trim());
  if (!parts[0]) return null;

  return {
    nome: parts[0] || 'Cliente',
    medicamento: parts[1] || 'Atendimento',
    telefone: parts[2] ? parts[2].replace(/[^\d]/g, '') : '',
    sintoma: parts[3] || ''
  };
}

function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  return digits;
}

function buildWhatsAppSendUrl(phone, text, targetMode = 'universal') {
  const cleanPhone = formatWhatsAppPhone(phone);
  const cleanText = (text || '').replace(/\*\*/g, '*');
  const encodedText = encodeURIComponent(cleanText);

  if (targetMode === 'web') {
    return cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://web.whatsapp.com/send?text=${encodedText}`;
  }

  return cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
    : `https://api.whatsapp.com/send?text=${encodedText}`;
}

async function handleBatchSubmit(e) {
  e.preventDefault();
  const text = document.getElementById('batchInputText')?.value.trim();
  if (!text) return;

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const items = [];

  lines.forEach(line => {
    const parsed = parseBatchInputLine(line);
    if (parsed && parsed.nome) {
      items.push(parsed);
    }
  });

  if (items.length === 0) {
    appendLog(`❌ Nenhuma linha válida encontrada no lote.`, 'log-error');
    return;
  }

  const useAiCheckbox = document.getElementById('batchUseAiCheckbox');
  const useAI = useAiCheckbox ? useAiCheckbox.checked : Boolean(getGeminiApiKey());
  const tomSelect = document.getElementById('batchAiToneSelect');
  const tom = tomSelect ? tomSelect.value : 'equilibrado';
  const customInstructionInput = document.getElementById('batchCustomInstruction');
  const customInstruction = customInstructionInput ? customInstructionInput.value.trim() : '';
  const includeCampaignCheckbox = document.getElementById('batchIncludeCampaignCheckbox');
  const includeCampaign = includeCampaignCheckbox ? includeCampaignCheckbox.checked : true;

  const submitBtn = document.getElementById('batchSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `⏳ Gerando mensagens ${useAI ? 'com IA Gemini (' + escapeHTML(tom) + ')' : ''}...`;
  }

  const wiz = document.getElementById('wizardBox');
  if (wiz) wiz.remove();

  const generatedBatch = await generateBatchMessagesSmart(items, { useAI, tom, customInstruction, includeCampaign });

  const aiCount = generatedBatch.filter(b => b.isAI).length;
  const badgeInfo = aiCount > 0 ? `com <strong>IA Gemini</strong> (${aiCount}/${generatedBatch.length})` : `com motor anti-spam local`;
  appendLog(`🚀 Lote de <strong>${generatedBatch.length}</strong> mensagem(ns) única(s) ${badgeInfo} gerado com sucesso!`, 'log-success');
  renderBatchOutput(generatedBatch, { tom, customInstruction, includeCampaign });
}

window.batchMessagesStore = window.batchMessagesStore || {};
window.batchOptionsStore = window.batchOptionsStore || {};
window.batchQueues = window.batchQueues || {};

function getBatchQueue(batchId) {
  if (!window.batchQueues[batchId]) {
    const list = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`] || [];
    window.batchQueues[batchId] = {
      batchId,
      currentIndex: 0,
      isRunning: false,
      isPaused: false,
      timerId: null,
      intervalSec: 5,
      targetMode: 'universal',
      statuses: new Array(list.length).fill('pending')
    };
  }
  return window.batchQueues[batchId];
}

function updateBatchProgressBar(batchId) {
  const queue = getBatchQueue(batchId);
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`] || [];
  const total = batchList.length;
  if (total === 0) return;

  const sentCount = queue.statuses.filter(s => s === 'sent').length;
  const percent = Math.round((sentCount / total) * 100);

  const fillElem = document.getElementById(`batch-progress-fill-${batchId}`);
  const labelElem = document.getElementById(`batch-progress-label-${batchId}`);
  const statsElem = document.getElementById(`batch-progress-stats-${batchId}`);

  if (fillElem) fillElem.style.width = `${percent}%`;
  if (labelElem) labelElem.textContent = `${percent}% concluído`;
  if (statsElem) statsElem.textContent = `${sentCount} de ${total} enviadas`;
}

function setBatchItemVisualStatus(batchId, itemIdx, status) {
  const queue = getBatchQueue(batchId);
  queue.statuses[itemIdx] = status;

  const badgeElem = document.getElementById(`batch-status-badge-${batchId}-${itemIdx}`);
  const cardElem = document.getElementById(`batch-card-${batchId}-${itemIdx}`);

  if (badgeElem) {
    badgeElem.className = `batch-status-badge ${status}`;
    if (status === 'sent') {
      badgeElem.innerHTML = `✅ Enviado`;
    } else if (status === 'sending') {
      badgeElem.innerHTML = `🔄 Enviando...`;
    } else if (status === 'skipped') {
      badgeElem.innerHTML = `⏭️ Pulado`;
    } else {
      badgeElem.innerHTML = `⏳ Pendente`;
    }
  }

  if (cardElem) {
    cardElem.classList.remove('is-sending', 'is-sent');
    if (status === 'sending') {
      cardElem.classList.add('is-sending');
      cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (status === 'sent') {
      cardElem.classList.add('is-sent');
    }
  }

  updateBatchProgressBar(batchId);
}

function recordBatchItemToHistory(item) {
  try {
    const historyItem = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toLocaleString('pt-BR'),
      clientData: {
        nome: item.clientData.nome,
        medicamento: item.clientData.medicamento,
        drogaria: item.clientData.drogaria || DEFAULT_CONFIG.drogaria,
        farmaceutico: item.clientData.farmaceutico || DEFAULT_CONFIG.farmaceutico,
        telefone: item.clientData.telefone || '',
        classification: item.clientData.classification || classifyItem(item.clientData.medicamento)
      },
      versions: {
        empatico: item.messageText,
        atencioso: item.messageText,
        descontraido: item.messageText,
        pos_tratamento: item.messageText
      },
      isAI: item.isAI || false,
      source: 'Lote WhatsApp Gemini'
    };

    generatedMessagesHistory.unshift(historyItem);
    localStorage.setItem('apoio_tratamento_history', JSON.stringify(generatedMessagesHistory.slice(0, 100)));
    updateHistoryCounter();
  } catch (e) {
    console.warn('Erro ao salvar item do lote no histórico:', e);
  }
}

function sendSingleBatchItemWhatsApp(batchId, itemIdx) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const item = batchList[itemIdx];

  const targetSelect = document.getElementById(`batch-target-mode-${batchId}`);
  const targetMode = targetSelect ? targetSelect.value : 'universal';

  const waUrl = buildWhatsAppSendUrl(item.clientData.telefone, item.messageText, targetMode);
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  setBatchItemVisualStatus(batchId, itemIdx, 'sent');
  recordBatchItemToHistory(item);
  appendLog(`💬 WhatsApp aberto para <strong>${escapeHTML(item.clientData.nome)}</strong>! Item marcado como enviado.`, 'log-info');
}

function startBatchWhatsAppQueue(batchId) {
  const queue = getBatchQueue(batchId);
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`] || [];

  if (batchList.length === 0) {
    appendLog('⚠️ Nenhum item no lote para enviar.', 'log-warning');
    return;
  }

  const intervalSelect = document.getElementById(`batch-interval-${batchId}`);
  if (intervalSelect) {
    queue.intervalSec = parseInt(intervalSelect.value, 10) || 5;
  }

  const targetSelect = document.getElementById(`batch-target-mode-${batchId}`);
  if (targetSelect) {
    queue.targetMode = targetSelect.value || 'universal';
  }

  queue.isRunning = true;
  queue.isPaused = false;

  updateQueueControlButtons(batchId);
  appendLog(`🚀 <strong>Iniciando envio do lote no WhatsApp</strong> (Intervalo seguro: ${queue.intervalSec}s)...`, 'log-success');

  processNextQueueItem(batchId);
}

function processNextQueueItem(batchId) {
  const queue = getBatchQueue(batchId);
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`] || [];

  if (!queue.isRunning || queue.isPaused) return;

  // Encontra o próximo pendente a partir do índice atual
  let nextIdx = queue.currentIndex;
  while (nextIdx < batchList.length && queue.statuses[nextIdx] === 'sent') {
    nextIdx++;
  }

  if (nextIdx >= batchList.length) {
    queue.isRunning = false;
    queue.isPaused = false;
    if (queue.timerId) clearTimeout(queue.timerId);
    queue.timerId = null;
    updateQueueControlButtons(batchId);
    appendLog(`🎉 <strong>Disparo do lote finalizado com sucesso!</strong> Todas as mensagens foram processadas.`, 'log-success');
    return;
  }

  queue.currentIndex = nextIdx;
  const item = batchList[nextIdx];

  setBatchItemVisualStatus(batchId, nextIdx, 'sending');

  const waUrl = buildWhatsAppSendUrl(item.clientData.telefone, item.messageText, queue.targetMode);
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  setBatchItemVisualStatus(batchId, nextIdx, 'sent');
  recordBatchItemToHistory(item);

  appendLog(`📨 Enviada mensagem #${nextIdx + 1} (${escapeHTML(item.clientData.nome)}). Aguardando ${queue.intervalSec}s para a próxima...`, 'log-info');

  queue.currentIndex = nextIdx + 1;

  if (queue.currentIndex < batchList.length) {
    queue.timerId = setTimeout(() => {
      processNextQueueItem(batchId);
    }, queue.intervalSec * 1000);
  } else {
    queue.isRunning = false;
    updateQueueControlButtons(batchId);
    appendLog(`🎉 <strong>Lote completo enviado com sucesso!</strong>`, 'log-success');
  }
}

function pauseBatchWhatsAppQueue(batchId) {
  const queue = getBatchQueue(batchId);
  if (queue.timerId) clearTimeout(queue.timerId);
  queue.timerId = null;
  queue.isPaused = true;
  updateQueueControlButtons(batchId);
  appendLog(`⏸️ Envio do lote em pausa. Clique em "Continuar Envio" para retomar.`, 'log-warning');
}

function resumeBatchWhatsAppQueue(batchId) {
  const queue = getBatchQueue(batchId);
  queue.isPaused = false;
  queue.isRunning = true;
  updateQueueControlButtons(batchId);
  appendLog(`▶️ Retomando envio do lote no WhatsApp...`, 'log-info');
  processNextQueueItem(batchId);
}

function cancelBatchWhatsAppQueue(batchId) {
  const queue = getBatchQueue(batchId);
  if (queue.timerId) clearTimeout(queue.timerId);
  queue.timerId = null;
  queue.isRunning = false;
  queue.isPaused = false;
  updateQueueControlButtons(batchId);
  appendLog(`⏹️ Envio do lote cancelado pelo usuário.`, 'log-warning');
}

function skipCurrentBatchItem(batchId) {
  const queue = getBatchQueue(batchId);
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`] || [];

  if (queue.currentIndex < batchList.length) {
    setBatchItemVisualStatus(batchId, queue.currentIndex, 'skipped');
    appendLog(`⏭️ Mensagem #${queue.currentIndex + 1} pulada.`, 'log-dim');
    queue.currentIndex++;
    if (queue.isRunning && !queue.isPaused) {
      if (queue.timerId) clearTimeout(queue.timerId);
      processNextQueueItem(batchId);
    }
  }
}

function updateQueueControlButtons(batchId) {
  const queue = getBatchQueue(batchId);
  const startBtn = document.getElementById(`batch-btn-start-${batchId}`);
  const pauseBtn = document.getElementById(`batch-btn-pause-${batchId}`);
  const resumeBtn = document.getElementById(`batch-btn-resume-${batchId}`);
  const stopBtn = document.getElementById(`batch-btn-stop-${batchId}`);
  const skipBtn = document.getElementById(`batch-btn-skip-${batchId}`);

  if (startBtn) startBtn.style.display = (!queue.isRunning && !queue.isPaused) ? 'inline-flex' : 'none';
  if (pauseBtn) pauseBtn.style.display = (queue.isRunning && !queue.isPaused) ? 'inline-flex' : 'none';
  if (resumeBtn) resumeBtn.style.display = (queue.isPaused) ? 'inline-flex' : 'none';
  if (stopBtn) stopBtn.style.display = (queue.isRunning || queue.isPaused) ? 'inline-flex' : 'none';
  if (skipBtn) skipBtn.style.display = (queue.isRunning || queue.isPaused) ? 'inline-flex' : 'none';
}

function updateBatchItemPhone(batchId, itemIdx, inputElem) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const newPhone = inputElem.value.trim().replace(/[^\d]/g, '');
  batchList[itemIdx].clientData.telefone = newPhone;
}

function copyAllBatchMessages(batchId) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || batchList.length === 0) return;

  let allText = `📦 LOTE DE MENSAGENS FARMACÊUTICAS (${batchList.length} Clientes)\n`;
  allText += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  allText += `====================================================\n\n`;

  batchList.forEach((item, idx) => {
    const cleanMsg = (item.messageText || '').replace(/\*\*/g, '').replace(/\*/g, '');
    allText += `--- [#${idx + 1}] ${item.clientData.nome} (${item.clientData.medicamento}) | Tel: ${item.clientData.telefone || 'N/A'} ---\n`;
    allText += `${cleanMsg}\n\n`;
  });

  copyTextToClipboard(allText, `✅ Todas as ${batchList.length} mensagens do lote foram copiadas com sucesso!`);
}


async function regenerateBatchItemWithAI(batchId, itemIdx) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const item = batchList[itemIdx];

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    appendLog('⚠️ Configure uma chave de API do Gemini para regenerar com inteligência artificial.', 'log-warning');
    openGeminiConfigPanel();
    return;
  }

  const msgDiv = document.getElementById(`batch-msg-text-${batchId}-${itemIdx}`);
  const regenBtn = document.getElementById(`batch-regen-btn-${batchId}-${itemIdx}`);

  if (regenBtn) {
    regenBtn.disabled = true;
    regenBtn.innerHTML = '⏳ Gerando IA...';
  }
  if (msgDiv) {
    msgDiv.style.opacity = '0.5';
  }

  appendLog(`🤖 <strong>Gemini IA:</strong> Regenerando mensagem personalizada para <strong>${escapeHTML(item.clientData.nome)}</strong>...`, 'log-info');

  try {
    const savedOpts = (window.batchOptionsStore && window.batchOptionsStore[batchId]) || {};
    const rawResults = await generateBatchMessagesAI([item.clientData], {
      drogaria: item.clientData.drogaria,
      farmaceutico: item.clientData.farmaceutico,
      tom: item.tom || savedOpts.tom || 'equilibrado',
      customInstruction: savedOpts.customInstruction || ''
    });

    if (rawResults && rawResults[0] && rawResults[0].messageText) {
      item.messageText = rawResults[0].messageText;
      item.hashSignature = rawResults[0].hashSignature;
      item.isAI = true;

      if (msgDiv) {
        msgDiv.textContent = item.messageText;
        msgDiv.style.opacity = '1';
      }
      const hashSpan = document.getElementById(`batch-hash-${batchId}-${itemIdx}`);
      if (hashSpan) {
        hashSpan.textContent = item.hashSignature;
      }
      const badgeDiv = document.getElementById(`batch-badge-${batchId}-${itemIdx}`);
      if (badgeDiv) {
        badgeDiv.innerHTML = `<span class="badge-tag" style="background: rgba(0, 255, 204, 0.15); color: #00ffcc; border-color: rgba(0, 255, 204, 0.4); font-size: 0.72rem; padding: 2px 6px; border-radius: 3px;">✨ Gemini IA</span>`;
      }
      appendLog(`✨ Mensagem de <strong>${escapeHTML(item.clientData.nome)}</strong> regenerada com sucesso via Gemini IA!`, 'log-success');
    }
  } catch (err) {
    appendLog(`❌ Erro ao regenerar com Gemini: ${escapeHTML(err.message)}`, 'log-error');
  } finally {
    if (regenBtn) {
      regenBtn.disabled = false;
      regenBtn.innerHTML = '✨ Regenerar IA';
    }
    if (msgDiv) {
      msgDiv.style.opacity = '1';
    }
  }
}

function toggleEditBatchItem(batchId, itemIdx) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const item = batchList[itemIdx];

  const viewDiv = document.getElementById(`batch-msg-text-${batchId}-${itemIdx}`);
  const editDiv = document.getElementById(`batch-msg-edit-${batchId}-${itemIdx}`);
  const editArea = document.getElementById(`batch-msg-textarea-${batchId}-${itemIdx}`);

  if (!viewDiv || !editDiv) return;

  if (editDiv.style.display === 'none') {
    editDiv.style.display = 'block';
    viewDiv.style.display = 'none';
    if (editArea) {
      editArea.value = item.messageText;
      editArea.focus();
    }
  } else {
    editDiv.style.display = 'none';
    viewDiv.style.display = 'block';
  }
}

function saveEditBatchItem(batchId, itemIdx) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const item = batchList[itemIdx];

  const editArea = document.getElementById(`batch-msg-textarea-${batchId}-${itemIdx}`);
  if (!editArea) return;

  const newText = editArea.value.trim();
  if (!newText) {
    appendLog('⚠️ O texto da mensagem não pode ficar vazio.', 'log-warning');
    return;
  }

  item.messageText = newText;
  item.hashSignature = simpleStringHash(newText);

  const viewDiv = document.getElementById(`batch-msg-text-${batchId}-${itemIdx}`);
  const editDiv = document.getElementById(`batch-msg-edit-${batchId}-${itemIdx}`);
  const hashSpan = document.getElementById(`batch-hash-${batchId}-${itemIdx}`);

  if (viewDiv) {
    viewDiv.textContent = item.messageText;
    viewDiv.style.display = 'block';
  }
  if (editDiv) {
    editDiv.style.display = 'none';
  }
  if (hashSpan) {
    hashSpan.textContent = item.hashSignature;
  }

  appendLog(`✅ Mensagem de <strong>${escapeHTML(item.clientData.nome)}</strong> atualizada com sucesso!`, 'log-success');
}

async function regenerateEntireBatchWithAI(batchId) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || batchList.length === 0) return;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    appendLog('⚠️ Configure uma chave de API do Gemini para processar com inteligência artificial.', 'log-warning');
    openGeminiConfigPanel();
    return;
  }

  const rawItems = batchList.map(b => ({
    nome: b.clientData.nome,
    medicamento: b.clientData.medicamento,
    telefone: b.clientData.telefone,
    sintoma: b.clientData.sintoma || '',
    tempo: b.clientData.tempo || '',
    dica: b.clientData.dica || ''
  }));

  const savedOptions = (window.batchOptionsStore && window.batchOptionsStore[batchId]) || {};
  const options = {
    ...savedOptions,
    useAI: true,
    forceLocal: false
  };

  appendLog(`🤖 <strong>Gemini IA:</strong> Regenerando lote completo de <strong>${rawItems.length}</strong> mensagens...`, 'log-info');

  const generatedBatch = await generateBatchMessagesSmart(rawItems, options);
  appendLog(`✨ Lote completo de <strong>${generatedBatch.length}</strong> mensagens reprocessado com IA Gemini!`, 'log-success');
  renderBatchOutput(generatedBatch, options);
}

function renderBatchOutput(batchList, options = {}) {
  const batchId = Date.now();
  window.batchMessagesStore[batchId] = batchList;
  window[`batch_data_${batchId}`] = batchList;
  window.batchOptionsStore = window.batchOptionsStore || {};
  window.batchOptionsStore[batchId] = options;

  const queue = getBatchQueue(batchId);
  const aiCount = batchList.filter(b => b.isAI).length;
  const isFullAI = aiCount === batchList.length;
  const withPhoneCount = batchList.filter(b => Boolean(b.clientData && b.clientData.telefone)).length;

  let listHTML = `
    <div class="wizard-box" id="batch-container-${batchId}">
      <div class="wizard-title" style="color: var(--text-bright); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span>📦 Lote Processado (${batchList.length} Mensagens WhatsApp Safe)</span>
        <span style="font-size: 0.8rem; font-weight: normal; color: ${isFullAI ? '#00ffcc' : 'var(--warning-color)'};">
          ${isFullAI ? '✨ 100% Gerado com Gemini IA' : `🤖 ${aiCount}/${batchList.length} gerados com Gemini IA`}
        </span>
      </div>

      <!-- PAINEL DE CONTROLE DE ENVIO DO LOTE -->
      <div class="batch-send-panel">
        <div class="batch-send-header">
          <div class="batch-send-title">
            <span>📋 Acompanhamento de Envios (WhatsApp 1 a 1)</span>
          </div>
          <div style="font-size: 0.78rem; color: var(--text-dim);">
            📱 <strong>${withPhoneCount}</strong> de ${batchList.length} com telefone
          </div>
        </div>

        <div class="batch-progress-box">
          <div class="batch-progress-info">
            <span id="batch-progress-label-${batchId}">0% enviado</span>
            <span id="batch-progress-stats-${batchId}">0 de ${batchList.length} enviadas</span>
          </div>
          <div class="batch-progress-bar-bg">
            <div id="batch-progress-fill-${batchId}" class="batch-progress-bar-fill" style="width: 0%;"></div>
          </div>
        </div>

        <div class="batch-controls-row" style="margin-bottom: 10px; justify-content: space-between; align-items: center;">
          <div class="batch-param-group">
            <label for="batch-target-mode-${batchId}">🎯 Destino do WhatsApp:</label>
            <select id="batch-target-mode-${batchId}">
              <option value="universal" selected>WhatsApp App / Universal (api)</option>
              <option value="web">WhatsApp Web (web.whatsapp.com)</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="tool-btn" onclick="copyAllBatchMessages(${batchId})">
              📋 Copiar Todas as Mensagens
            </button>
          </div>
        </div>

        <div class="log-dim" style="font-size: 0.78rem; margin-top: 4px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
          💡 <strong>Envio Individual:</strong> Clique em <strong>💬 Enviar WhatsApp</strong> em cada cliente abaixo para abrir a conversa com a mensagem personalizada gerada pela IA.
        </div>
      </div>
  `;

  batchList.forEach((item, idx) => {
    const aiBadge = item.isAI 
      ? `<span class="badge-tag" style="background: rgba(0, 255, 204, 0.15); color: #00ffcc; border-color: rgba(0, 255, 204, 0.4); font-size: 0.72rem; padding: 2px 6px; border-radius: 3px;">✨ Gemini IA</span>`
      : `<span class="badge-tag" style="font-size: 0.72rem; color: var(--text-dim); padding: 2px 6px; border-radius: 3px;">🛡️ Anti-Spam Local</span>`;

    const rawPhone = item.clientData.telefone || '';

    listHTML += `
      <div id="batch-card-${batchId}-${idx}" class="batch-card-item">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong class="log-success">#${idx + 1} - ${escapeHTML(item.clientData.nome)}</strong>
            <span id="batch-badge-${batchId}-${idx}">${aiBadge}</span>
            <span id="batch-status-badge-${batchId}-${idx}" class="batch-status-badge pending">⏳ Pendente</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="meta-pill">${item.clientData.classification.icon} ${escapeHTML(item.clientData.classification.label)}: <strong>${escapeHTML(item.clientData.medicamento)}</strong></span>
            <span id="batch-hash-${batchId}-${idx}" class="badge-tag" style="font-size: 0.7rem; color: var(--prompt-color);">${item.hashSignature}</span>
          </div>
        </div>

        <!-- Telefone editável inline -->
        <div style="margin-bottom: 8px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span style="color: var(--text-dim);">📱 Telefone:</span>
          <div class="batch-inline-phone-edit">
            <input type="tel" value="${escapeHTML(rawPhone)}" placeholder="DDD + Número" onchange="updateBatchItemPhone(${batchId}, ${idx}, this)" title="Edite o telefone se necessário">
          </div>
        </div>

        <!-- Visualização da Mensagem -->
        <div id="batch-msg-text-${batchId}-${idx}" style="white-space: pre-wrap; font-size: 0.88rem; background: var(--bg-card); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-bright); margin-bottom: 8px; line-height: 1.45;">${escapeHTML(item.messageText)}</div>

        <!-- Editor Inline Oculto -->
        <div id="batch-msg-edit-${batchId}-${idx}" style="display: none; margin-bottom: 8px;">
          <textarea id="batch-msg-textarea-${batchId}-${idx}" rows="4" style="width: 100%; background: var(--bg-card); border: 1px solid var(--accent-color); color: var(--text-bright); font-family: var(--font-mono); font-size: 0.88rem; padding: 8px; border-radius: 4px; outline: none; resize: vertical;"></textarea>
          <div style="display: flex; gap: 6px; margin-top: 6px;">
            <button class="tool-btn primary" onclick="saveEditBatchItem(${batchId}, ${idx})" style="font-size: 0.76rem; padding: 4px 10px;">💾 Salvar Alterações</button>
            <button class="tool-btn danger" onclick="toggleEditBatchItem(${batchId}, ${idx})" style="font-size: 0.76rem; padding: 4px 10px;">Cancelar</button>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <button class="card-btn btn-whatsapp" onclick="sendSingleBatchItemWhatsApp(${batchId}, ${idx})">💬 Enviar WhatsApp</button>
          <button class="card-btn btn-copy" onclick="copyBatchItemText(${batchId}, ${idx})">📋 Copiar Texto</button>
          <button class="card-btn" id="batch-regen-btn-${batchId}-${idx}" onclick="regenerateBatchItemWithAI(${batchId}, ${idx})" style="border-color: rgba(0, 255, 204, 0.4); color: #00ffcc;">✨ Regenerar IA</button>
          <button class="card-btn" onclick="toggleEditBatchItem(${batchId}, ${idx})" style="font-size: 0.8rem;">✏️ Editar</button>
        </div>
      </div>
    `;
  });

  listHTML += `
    <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
      <button class="tool-btn primary" onclick="exportBatchCSV(${batchId})">📥 Exportar Lote para CSV</button>
      <button class="tool-btn" onclick="regenerateEntireBatchWithAI(${batchId})" style="border-color: rgba(0, 255, 204, 0.5); color: #00ffcc;">✨ Regenerar Todo o Lote com IA</button>
      <button class="tool-btn" onclick="startBatchWizard()">➕ Novo Lote</button>
    </div>
  </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = listHTML;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function exportBatchCSV(batchId) {
  const batchList = window[`batch_data_${batchId}`];
  if (!batchList || batchList.length === 0) return;

  let csvContent = "data:text/csv;charset=utf-8,Cliente;Item;Telefone;AssinaturaHash;OrigemIA;Mensagem\n";
  batchList.forEach(item => {
    const cleanMsg = (item.messageText || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const isAiStr = item.isAI ? "Gemini IA" : "Anti-Spam Local";
    csvContent += `"${item.clientData.nome}";"${item.clientData.medicamento}";"${item.clientData.telefone}";"${item.hashSignature}";"${isAiStr}";"${cleanMsg}"\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `lote_mensagens_antispam_${batchId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  appendLog(`📥 Lote exportado com sucesso como arquivo CSV!`, 'log-success');
}



/* ==========================================================================
   PARSER DE COMANDOS CLI E EVENTOS DE TECLADO
   ========================================================================== */

function parseCommandArgs(cmdStr) {
  const tokens = [];
  const flags = {};
  let currentToken = '';
  let inQuotes = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const char = cmdStr[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) tokens.push(currentToken);

  const cleanTokens = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].startsWith('--')) {
      const flagName = tokens[i].substring(2).toLowerCase();
      const flagVal = (tokens[i + 1] && !tokens[i + 1].startsWith('--')) ? tokens[i + 1] : true;
      flags[flagName] = flagVal;
      if (flagVal !== true) i++;
    } else {
      cleanTokens.push(tokens[i]);
    }
  }
  cleanTokens.flags = flags;
  return cleanTokens;
}

function handleInputKeydown(e) {
  if (e.key === 'Enter') {
    const rawInput = cliInput.value.trim();
    if (!rawInput) return;

    commandHistory.push(rawInput);
    commandIndex = commandHistory.length;

    appendLog(`<div class="log-cmd"><span>${escapeHTML(getPromptPrefixText())}</span> <span>${escapeHTML(rawInput)}</span></div>`);

    cliInput.value = '';
    executeCommand(rawInput);
  } else if (e.key === 'ArrowUp') {
    if (commandHistory.length > 0 && commandIndex > 0) {
      commandIndex--;
      cliInput.value = commandHistory[commandIndex];
    }
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (commandIndex < commandHistory.length - 1) {
      commandIndex++;
      cliInput.value = commandHistory[commandIndex];
    } else {
      commandIndex = commandHistory.length;
      cliInput.value = '';
    }
    e.preventDefault();
  }
}

async function executeCommand(inputCmd) {
  const parts = parseCommandArgs(inputCmd);
  const mainCmd = parts[0] ? parts[0].toLowerCase() : '';

  switch (mainCmd) {
    case 'novo':
    case 'gerar':
    case 'criar':
    case 'iniciar':
    case 'guiado':
    case 'lote':
    case 'massa':
    case 'batch':
    case '1':
      startBatchWizard();
      break;

    case 'campanha':
    case 'campanhas':
    case 'campaign':
    case 'promocao':
    case 'promo':
      openCampaignModal();
      break;

    case 'servicos':
    case 'servico':
    case 'serviços':
    case 'serviço':
      showServicesHelp();
      break;

    case 'historico':
    case 'history':
    case 'histórico':
      if (parts[1] === 'limpar' || parts[1] === 'clear') {
        generatedMessagesHistory = [];
        localStorage.removeItem('apoio_tratamento_history');
        updateHistoryCounter();
        appendLog(`🧹 Histórico de mensagens limpo com sucesso.`, 'log-success');
      } else {
        showHistory();
      }
      break;

    case 'limpar':
    case 'clear':
    case 'cls':
      if (parts[1] === 'historico' || parts[1] === 'history') {
        generatedMessagesHistory = [];
        localStorage.removeItem('apoio_tratamento_history');
        updateHistoryCounter();
        appendLog(`🧹 Histórico limpo!`, 'log-success');
      } else {
        terminalOutput.innerHTML = '';
        renderWelcomeBanner();
      }
      break;

    case 'zerar':
      generatedMessagesHistory = [];
      localStorage.removeItem('apoio_tratamento_history');
      updateHistoryCounter();
      appendLog(`🧹 Histórico de mensagens zerado! Contador reiniciado para 0.`, 'log-success');
      break;

    case 'sobre':
    case 'info':
    case 'autor':
    case 'creditos':
    case 'créditos':
      showAbout();
      break;

    case 'ajuda':
    case 'help':
    case '?':
      showHelp();
      break;

    case 'tema':
    case 'theme':
      if (parts[1]) {
        setTheme(parts[1].toLowerCase());
      } else {
        toggleTheme();
      }
      break;

    case 'crt':
    case 'scanlines':
      toggleCRT();
      break;

    case 'exemplos':
    case 'exemplo':
    case 'teste':
      runExamples();
      break;

    case 'apikey':
    case 'key':
    case 'chave':
      if (parts[1]) {
        saveGeminiApiKey(parts[1].trim());
        resetGeminiFailureState();
        updateAIStatus();
        appendLog(`✨ Chave da API do Google Gemini configurada com sucesso nas configurações!`, 'log-success');
      } else {
        openGeminiConfigPanel();
      }
      break;

    case 'gemini':
    case 'config':
    case 'ia':
      openGeminiConfigPanel();
      break;

    case 'perfil':
    case 'conta':
    case 'profile':
      openUserProfileModal();
      break;

    case 'usuario':
    case 'whoami':
      const currentSession = getAuthSession();
      if (currentSession && currentSession.user) {
        appendLog(`👤 Usuário conectado: <strong>${escapeHTML(currentSession.name || currentSession.user)}</strong> (${escapeHTML(currentSession.user)}) | Cargo: <strong>${escapeHTML(currentSession.role || 'user')}</strong> | Filial: <strong>${escapeHTML(currentSession.drogaria || DEFAULT_CONFIG.drogaria)}</strong>`, 'log-info');
      } else {
        appendLog(`👤 Sessão local: <strong>${escapeHTML(DEFAULT_CONFIG.farmaceutico)}</strong> (${escapeHTML(DEFAULT_CONFIG.drogaria)})`, 'log-info');
      }
      break;

    case 'senha':
    case 'password':
    case 'redefinir':
      openUserProfileModal();
      switchProfileTab('pass');
      break;

    case 'sair':
    case 'logout':
      logoutUser();
      break;

    case 'usuarios':
    case 'admin':
    case 'users':
      showAdminUsersPanel();
      break;

    case 'aprovar':
      const admSess = getAuthSession();
      if (!admSess || !isSuperUser(admSess.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem aprovar usuários.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">aprovar &lt;email_ou_nome&gt;</code> ou acesse o painel pelo comando <code class="log-info">usuarios</code>.`, 'log-warning');
      } else {
        approveUserAction(parts[1]);
      }
      break;

    case 'bloquear':
      const admSessBlock = getAuthSession();
      if (!admSessBlock || !isSuperUser(admSessBlock.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem bloquear usuários.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">bloquear &lt;email_ou_nome&gt;</code> ou acesse o painel pelo comando <code class="log-info">usuarios</code>.`, 'log-warning');
      } else {
        blockUserAction(parts[1]);
      }
      break;

    case 'rejeitar':
    case 'recusar':
      const admSessReject = getAuthSession();
      if (!admSessReject || !isSuperUser(admSessReject.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem rejeitar cadastros.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">rejeitar &lt;email_ou_nome&gt; [motivo...]</code>`, 'log-warning');
      } else {
        const reason = parts.slice(2).join(' ') || 'Recusado via terminal.';
        rejectUserAction(parts[1], reason);
      }
      break;

    case 'desbloquear':
    case 'reativar':
      const admSessUnblock = getAuthSession();
      if (!admSessUnblock || !isSuperUser(admSessUnblock.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem desbloquear usuários.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">desbloquear &lt;email_ou_nome&gt;</code>`, 'log-warning');
      } else {
        unblockUserAction(parts[1]);
      }
      break;

    case 'deletar':
    case 'excluir':
    case 'remover':
      const admSessDel = getAuthSession();
      if (!admSessDel || !isSuperUser(admSessDel.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem excluir usuários.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">deletar &lt;email_ou_nome&gt;</code>`, 'log-warning');
      } else {
        deleteUserAction(parts[1]);
      }
      break;

    case 'role':
    case 'cargo':
      const admSessRole = getAuthSession();
      if (!admSessRole || !isSuperUser(admSessRole.user)) {
        appendLog(`⚠️ Apenas <strong>Administradores</strong> podem alterar funções.`, 'log-error');
      } else if (!parts[1]) {
        appendLog(`ℹ️ Uso: <code class="log-info">role &lt;email&gt; &lt;admin|farmaceutico&gt;</code>`, 'log-warning');
      } else if (parts[2]) {
        const newRole = parts[2].toLowerCase() === 'admin' ? 'admin' : 'farmaceutico';
        const users = getRegisteredUsers();
        const target = users.find(u => u.email?.toLowerCase() === parts[1].toLowerCase() || u.name?.toLowerCase() === parts[1].toLowerCase());
        if (target) {
          target.role = newRole;
          saveRegisteredUsers(getRegisteredUsers());
          if (typeof firestoreChangeUserRole === 'function') {
            firestoreChangeUserRole(target.uid || target.email, newRole);
          }
          renderAdminUsersTable();
          appendLog(`⭐ Função alterada para ${newRole.toUpperCase()} com sucesso.`, 'log-success');
        } else {
          appendLog(`⚠️ Usuário não encontrado.`, 'log-warning');
        }
      } else {
        toggleRoleUserAction(parts[1]);
      }
      break;

    default:
      appendLog(`❌ Comando não reconhecido: "<strong>${escapeHTML(inputCmd)}</strong>". Digite <code class="log-info">ajuda</code> ou <code class="log-info">novo</code>.`, 'log-error');
      break;
  }
}

function copyBatchItemText(batchId, itemIdx) {
  const batchList = window.batchMessagesStore[batchId] || window[`batch_data_${batchId}`];
  if (!batchList || !batchList[itemIdx]) return;
  const item = batchList[itemIdx];
  const cleanMsg = (item.messageText || '').replace(/\*\*/g, '').replace(/\*/g, '');
  copyTextToClipboard(cleanMsg, `✅ Mensagem de ${escapeHTML(item.clientData?.nome || 'cliente')} copiada!`);
}

function openBatchItemWhatsApp(batchId, itemIdx) {
  sendSingleBatchItemWhatsApp(batchId, itemIdx);
}


function runExamples() {
  appendLog(`🧪 Gerando exemplo 1 [💊 Medicamento]: Maria Oliveira - Amoxicilina 500mg...`, 'log-info');
  const ex1 = generateMessages({
    nome: 'Maria Oliveira',
    medicamento: 'Amoxicilina 500mg',
    telefone: '11988887777',
    sintoma: 'infecção na garganta',
    tempo: 'há 2 dias',
    dica: 'Lembrar de tomar no horário exato de 8 em 8 horas.'
  });
  renderGeneratedOutput(ex1);

  appendLog(`🧪 Gerando exemplo 2 [🩺 Serviço: Injetável]: Roberto Santos - Aplicação de Voltaren Injetável...`, 'log-info');
  const ex2 = generateMessages({
    nome: 'Roberto Santos',
    medicamento: 'Aplicação de Voltaren Injetável',
    telefone: '11977776666',
    sintoma: 'dor lombar forte',
    tempo: 'hoje pela manhã',
    dica: 'Aplicar compressa morna no local caso sinta algum incômodo leve.'
  });
  renderGeneratedOutput(ex2);

  appendLog(`🧪 Gerando exemplo 3 [🩺 Serviço: Pressão Arterial]: Ana Paula - Aferição de Pressão Arterial...`, 'log-info');
  const ex3 = generateMessages({
    nome: 'Ana Paula',
    medicamento: 'Aferição de Pressão Arterial',
    telefone: '11966665555',
    sintoma: 'tontura e mal-estar',
    tempo: 'ontem à tarde',
    dica: 'Repetir a medição na farmácia no mesmo horário amanhã.'
  });
  renderGeneratedOutput(ex3);
}

function showHistory() {
  if (generatedMessagesHistory.length === 0) {
    appendLog(`📋 O histórico de mensagens está vazio no momento.`, 'log-warning');
    return;
  }

  let html = `<div class="wizard-box"><div class="wizard-title">📜 Histórico de Mensagens Geradas (${generatedMessagesHistory.length})</div><ul style="list-style: none; padding: 0;">`;
  
  generatedMessagesHistory.forEach((item, index) => {
    html += `
      <li style="padding: 8px 0; border-bottom: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong class="log-success">#${index + 1} - ${escapeHTML(item.clientData.nome)}</strong> 
          <span class="log-dim">(${escapeHTML(item.clientData.medicamento)})</span>
          <br><small class="log-dim">📅 ${item.timestamp} | Drogaria: ${escapeHTML(item.clientData.drogaria)} | Farmacêutico: ${escapeHTML(item.clientData.farmaceutico)}</small>
        </div>
        <div>
          <button class="tool-btn" onclick="reRenderHistoryItem(${item.id})">🔍 Visualizar Mensagens</button>
        </div>
      </li>
    `;
  });

  html += `</ul><div style="margin-top: 10px;"><button class="tool-btn danger" onclick="executeCommand('historico limpar')">🗑️ Limpar Todo Histórico</button></div></div>`;
  
  const container = document.createElement('div');
  container.innerHTML = html;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function reRenderHistoryItem(id) {
  const item = generatedMessagesHistory.find(h => h.id === id);
  if (item) {
    appendLog(`🔍 Reexibindo mensagem de <strong>${escapeHTML(item.clientData.nome)}</strong>...`, 'log-info');
    renderGeneratedOutput(item);
  }
}

function showAbout() {
  const aboutHTML = `
    <div class="wizard-box">
      <div class="wizard-title" style="color: var(--prompt-color);">
        <span>ℹ️ Sobre o Terminal de Apoio ao Tratamento</span>
      </div>
      <p style="margin-bottom: 12px; line-height: 1.6;">
        O <strong>Terminal de Apoio ao Tratamento & Serviços Farmacêuticos</strong> é uma plataforma web para geração humanizada e personalizada de mensagens de acompanhamento clínico, pós-atendimento e adesão terapêutica.
      </p>

      <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 14px; border-radius: 6px; margin-bottom: 12px; line-height: 1.7;">
        <div>👨‍⚕️ <strong>Idealizador & Desenvolvedor:</strong> <span style="color: var(--text-bright);">Maxwell Rodrigues Ferreira</span></div>
        <div>📋 <strong>Registro Profissional:</strong> Farmacêutico inscrito no <strong>CRF-SP sob o nº 86426</strong></div>
        <div>💻 <strong>Especialidade:</strong> Desenvolvimento Web & Atenção Farmacêutica / Farmácia Clínica</div>
        <div>🛡️ <strong>Segurança & Moderação:</strong> Controle RBAC, Proteção Anti-Spam e Google Gemini 3.6 Flash</div>
      </div>

      <div class="welcome-creator" style="margin-top: 10px; font-size: 0.8rem;">
        <span>💊 Aplicação web independente focada no cuidado farmacêutico, farmacovigilância e promoção da saúde do paciente.</span>
      </div>
    </div>
  `;
  const container = document.createElement('div');
  container.innerHTML = aboutHTML;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function showHelp() {
  const drogaria = escapeHTML(DEFAULT_CONFIG.drogaria || 'Drogaria');
  const farmaceutico = escapeHTML(DEFAULT_CONFIG.farmaceutico || 'Farmacêutico');
  const helpHTML = `
    <div class="wizard-box">
      <div class="wizard-title" style="color: var(--prompt-color);">
        <span>❓ Menu de Ajuda & Guia de Comandos — ${drogaria}</span>
      </div>
      <p class="log-dim" style="margin-bottom: 12px;">
        👨‍⚕️ Bem-vindo ao sistema de acompanhamento do farmacêutico <strong>${farmaceutico}</strong> (${drogaria}). Utilize os botões interativos abaixo ou digite os comandos diretamente no terminal.
      </p>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
        <button class="tool-btn primary" style="background: var(--warning-color); color: #000;" onclick="startBatchWizard()">📦 Gerar Mensagens em Lote (WhatsApp)</button>
        <button class="tool-btn" style="background: rgba(0, 255, 102, 0.15); border-color: #00ff66; color: #00ff66;" onclick="openCampaignModal()">🎯 Campanhas de Saúde (Gratuitas)</button>
        <button class="tool-btn" onclick="openUserProfileModal()">👤 Meu Perfil</button>
        <button class="tool-btn" onclick="openGeminiConfigPanel()">⚙️ Configurações IA</button>
        <button class="tool-btn" onclick="showServicesHelp()">🩺 Serviços Farmacêuticos</button>
        <button class="tool-btn" onclick="showAbout()">ℹ️ Sobre o Sistema</button>
        <button class="tool-btn" onclick="showHistory()">📜 Ver Histórico</button>
        <button class="tool-btn" onclick="toggleTheme()">🎨 Trocar Tema Visual</button>
      </div>

      <div class="wizard-title" style="font-size: 0.95rem; margin-top: 10px; margin-bottom: 6px;">⌨️ Tabela de Comandos CLI</div>
      <table class="help-table">
        <thead>
          <tr>
            <th>Comando</th>
            <th>Descrição / Ação</th>
            <th>Exemplo Prático</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>lote</code> / <code>novo</code> / <code>batch</code></td>
            <td>Gera e dispara mensagens em lote no WhatsApp com Gemini IA e proteção anti-bloqueio.</td>
            <td><code>lote</code></td>
          </tr>
          <tr>
            <td><code>campanha</code> / <code>campanhas</code></td>
            <td>Gerencia e ativa campanhas de saúde 100% gratuitas (Glicemia, Pressão, Bioimpedância).</td>
            <td><code>campanha</code></td>
          </tr>
          <tr>
            <td><code>servicos</code> / <code>serviço</code></td>
            <td>Lista os 8 serviços farmacêuticos e teste rápido.</td>
            <td><code>servicos</code></td>
          </tr>
          <tr>
            <td><code>gerar [nome] [item]</code></td>
            <td>Gera mensagem instantânea diretamente pelo CLI.</td>
            <td><code>gerar "Maria" "Dipirona 1g"</code></td>
          </tr>
          <tr>
            <td><code>sobre</code> / <code>info</code> / <code>autor</code></td>
            <td>Exibe informações do sistema, desenvolvedor e farmacêutico responsável.</td>
            <td><code>sobre</code></td>
          </tr>
          <tr>
            <td><code>historico</code></td>
            <td>Exibe o histórico de mensagens geradas hoje.</td>
            <td><code>historico</code> (ou <code>historico limpar</code>)</td>
          </tr>
          <tr>
            <td><code>usuarios</code> / <code>admin</code></td>
            <td>Painel do Super Usuário para aprovar e gerenciar farmacêuticos.</td>
            <td><code>usuarios</code></td>
          </tr>
          <tr>
            <td><code>aprovar [email]</code></td>
            <td>Aprova diretamente o cadastro de um farmacêutico pelo CLI.</td>
            <td><code>aprovar ana@drogasil.com</code></td>
          </tr>
          <tr>
            <td><code>apikey [chave]</code></td>
            <td>Configura a API do Google Gemini para mensagens IA.</td>
            <td><code>apikey AIzaSy...</code></td>
          </tr>
          <tr>
            <td><code>tema [matrix|amber|cyberpunk|dark]</code></td>
            <td>Altera o esquema de cores e estilo do CRT.</td>
            <td><code>tema amber</code></td>
          </tr>
          <tr>
            <td><code>limpar</code> / <code>clear</code></td>
            <td>Limpa a tela do terminal (use <code>limpar historico</code> para zerar tudo).</td>
            <td><code>limpar</code></td>
          </tr>
          <tr>
            <td><code>zerar</code> / <code>historico limpar</code></td>
            <td>Apaga as mensagens salvas e zera o contador para 0.</td>
            <td><code>zerar</code></td>
          </tr>
          <tr>
            <td><code>usuario</code> / <code>whoami</code></td>
            <td>Exibe o usuário atualmente autenticado na sessão.</td>
            <td><code>usuario</code></td>
          </tr>
          <tr>
            <td><code>senha [nova_senha]</code></td>
            <td>Altera a senha de acesso do usuário local.</td>
            <td><code>senha 123456</code></td>
          </tr>
          <tr>
            <td><code>sair</code> / <code>logout</code></td>
            <td>Encerra a sessão e bloqueia o terminal.</td>
            <td><code>sair</code></td>
          </tr>
        </tbody>
      </table>

      <div class="welcome-creator" style="margin-top: 14px;">
        <span>👨‍⚕️💻 Criado pelo desenvolvedor e farmacêutico <strong>Maxwell Rodrigues Ferreira</strong> · Inscrito no <strong>CRF-SP nº 86426</strong></span>
      </div>
    </div>
  `;
  const container = document.createElement('div');
  container.innerHTML = helpHTML;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function showServicesHelp() {
  const servicesHTML = `
    <div class="wizard-box">
      <div class="wizard-title" style="color: var(--text-bright);">
        <span>🩺 Guia de Serviços Farmacêuticos (Diferenciação Automática)</span>
      </div>
      <p class="log-dim" style="margin-bottom: 10px;">
        O sistema identifica automaticamente qualquer um dos serviços abaixo e adapta as perguntas de acompanhamento pós-atendimento:
      </p>

      <ul style="list-style: none; padding: 0; line-height: 1.6;">
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>💉 1. Aplicação de Injetáveis</strong> — Acompanha dor no local da aplicação, vermelhidão ou desconforto.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>📲 2. Aplicação Sensor Libre</strong> — Acompanha fixação no braço e sincronização com o leitor/app de glicemia.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>🩺 3. Aferição de Pressão Arterial</strong> — Acompanha melhora de sintomas de tontura, dores de cabeça e mal-estar.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>👂 4. Perfuração do Lóbulo Auricular</strong> — Acompanha cicatrização do furo, higienização e antissepsia.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>🤧 5. Teste de Influenza (Gripe)</strong> — Acompanha evolução da febre, hidratação e repouso.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>🦠 6. Teste de COVID-19</strong> — Acompanha protocolos de isolamento, febre e sinais de alerta.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>🫁 7. Teste de Painel Respiratório</strong> — Acompanha alívio da tosse, indisposição e vírus respiratórios.
        </li>
        <li style="margin-bottom: 8px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">
          <strong>⚖️ 8. Avaliação de Bioimpedância</strong> — Acompanha leitura do relatório de massa magra/gordura e metas.
        </li>
      </ul>

      <div style="margin-top: 10px;">
        <button class="tool-btn primary" onclick="startWizard()">✨ Criar Atendimento de Serviço</button>
      </div>
    </div>
  `;
  const container = document.createElement('div');
  container.innerHTML = servicesHTML;
  terminalOutput.appendChild(container);
  scrollToBottom();
}

function openWhatsApp(phone, id) {
  const cardElem = document.getElementById(`card-${id}`);
  if (!cardElem) return;
  const activeTone = cardElem.dataset.activeTone || 'empatico';
  const versions = JSON.parse(cardElem.dataset.versions);
  const rawVal = versions[activeTone];
  const text = (typeof rawVal === 'object' ? rawVal.text : rawVal).replace(/\*\*/g, '*');
  const encodedText = encodeURIComponent(text);
  const sanitizedPhone = formatWhatsAppPhone(phone);

  let url = '';
  if (sanitizedPhone) {
    url = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodedText}`;
  } else {
    url = `https://api.whatsapp.com/send?text=${encodedText}`;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  appendLog(`🚀 Abrindo WhatsApp para envio...`, 'log-info');
}

/* ==========================================================================
   EXPORTAÇÃO GLOBAL DE FUNÇÕES E INICIALIZAÇÃO
   ========================================================================== */
if (typeof window !== 'undefined') {
  window.startWizard = startWizard;
  window.startBatchWizard = startBatchWizard;
  window.openCampaignModal = openCampaignModal;
  window.closeCampaignModal = closeCampaignModal;
  window.handleSaveCampaign = handleSaveCampaign;
  window.deactivateCampaign = deactivateCampaign;
  window.applyCampaignPreset = applyCampaignPreset;
  window.toggleServiceTag = toggleServiceTag;
  window.updateCampaignPreview = updateCampaignPreview;
  window.toggleCampaignActive = toggleCampaignActive;
  window.executeCommand = executeCommand;
  window.logoutUser = logoutUser;
  window.showHistory = showHistory;
  window.openGeminiConfigPanel = openGeminiConfigPanel;
  window.closeGeminiConfigPanel = closeGeminiConfigPanel;
  window.handleGeminiSave = handleGeminiSave;
  window.handleGeminiRemove = handleGeminiRemove;
  window.handleGeminiTest = handleGeminiTest;
  window.openUserProfileModal = openUserProfileModal;
  window.closeUserProfileModal = closeUserProfileModal;
  window.switchProfileTab = switchProfileTab;
  window.handleProfilePasswordChangeSubmit = handleProfilePasswordChangeSubmit;
  window.handleProfileUpdateSubmit = handleProfileUpdateSubmit;
  window.toggleTheme = toggleTheme;
  window.toggleCRT = toggleCRT;
  window.switchAuthTab = switchAuthTab;
  window.toggleLoginPassVisibility = toggleLoginPassVisibility;
  window.toggleRegisterPassVisibility = toggleRegisterPassVisibility;
  window.togglePasswordInputVisibility = togglePasswordInputVisibility;
  window.openLoginAboutModal = openLoginAboutModal;
  window.closeLoginAboutModal = closeLoginAboutModal;
  window.openAdminUsersPanel = openAdminUsersPanel;
  window.closeAdminUsersPanel = closeAdminUsersPanel;
  window.setAdminFilter = setAdminFilter;
  window.closeAdminDetailsModal = closeAdminDetailsModal;
  window.openWhatsApp = openWhatsApp;
  window.copyMessageText = copyMessageText;
  window.copyBatchItemText = copyBatchItemText;
  window.copyAllBatchMessages = copyAllBatchMessages;
  window.copyTextToClipboard = copyTextToClipboard;
  window.switchToneTab = switchToneTab;
  window.startMainApp = startMainApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMainApp);
  } else {
    startMainApp();
  }
}

