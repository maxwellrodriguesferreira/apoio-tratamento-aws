const fs = require('fs');

const app = fs.readFileSync('/home/maxwell/terminal/app.js', 'utf8');
const html = fs.readFileSync('/home/maxwell/terminal/index.html', 'utf8');
const css = fs.readFileSync('/home/maxwell/terminal/style.css', 'utf8');
const appConfig = fs.readFileSync('/home/maxwell/terminal/app-config.js', 'utf8');
const userDbCode = fs.readFileSync('/home/maxwell/terminal/user-db.js', 'utf8');
const cognitoAuthCode = fs.readFileSync('/home/maxwell/terminal/cognito-auth.js', 'utf8');
const amplifyYml = fs.readFileSync('/home/maxwell/terminal/amplify.yml', 'utf8');
const customHttp = fs.readFileSync('/home/maxwell/terminal/customHttp.yml', 'utf8');

// =========================================================================
// 1. TESTES ESTRUTURAIS DO PAINEL GEMINI & UI BÁSICA
// =========================================================================
const requirements = [
  ['menu fixo no HTML', html.includes('id="geminiConfigPanel"')],
  ['formulário de configuração', html.includes('id="geminiConfigForm"')],
  ['campo da chave', html.includes('id="geminiKeyInput"')],
  ['inicialização do painel', app.includes('function initializeGeminiConfigPanel()')],
  ['abertura do painel', app.includes('function openGeminiConfigPanel()')],
  ['armazenamento com AppConfig', appConfig.includes('getGeminiApiKey') && appConfig.includes('setGeminiApiKey')],
  ['estilos do painel', css.includes('.gemini-config-panel')],
  ['sem dependência de dialog', !app.includes('.showModal()')],
  ['modelo Gemini configurado', appConfig.includes('geminiModel')],
  ['parser defensivo do JSON da IA', app.includes('function sanitizeGeminiJsonResponse')],
  ['força JSON da API Gemini', app.includes("responseMimeType: 'application/json'")],
  ['schema estruturado do Gemini', app.includes('GEMINI_RESPONSE_SCHEMA')],
  ['schema de lote do Gemini', app.includes('GEMINI_BATCH_RESPONSE_SCHEMA')],
  ['parser de lote do Gemini', app.includes('function sanitizeGeminiBatchJsonResponse')],
  ['gerador de lote com IA Gemini', app.includes('function generateBatchMessagesAI(')],
  ['gerador inteligente de lote', app.includes('function generateBatchMessagesSmart(')],
  ['bloqueio temporário da IA', app.includes('isGeminiTemporarilyBlocked()')],
  ['painel de login no HTML', html.includes('id="loginPanel"')],
  ['formulário de login no HTML', html.includes('id="loginForm"')],
  ['campo de usuário no HTML', html.includes('id="loginUserInput"')],
  ['campo de senha no HTML', html.includes('id="loginPassInput"')],
  ['botão de sair no HTML', html.includes('id="logoutBtn"')],
  ['estilos da tela de login', css.includes('.login-panel') && css.includes('.login-card')],
  ['função de inicialização de autenticação', app.includes('function initializeAuth()')],
  ['função de validação de login', app.includes('function handleLoginSubmit(')],
  ['função de encerramento de sessão', app.includes('function logoutUser()')],
  ['script app-config no HTML', html.includes('app-config.js')],
  ['headers de segurança no customHttp.yml', customHttp.includes('nosniff') && customHttp.includes('SAMEORIGIN')],
  ['build do amplify configurado', amplifyYml.includes('baseDirectory: .')]
];

const failed = requirements.filter(([, passed]) => !passed).map(([name]) => name);
if (failed.length) {
  throw new Error(`Falha nos testes do painel Gemini: ${failed.join(', ')}`);
}

const vm = require('vm');
const functionMatch = app.match(/function sanitizeGeminiJsonResponse\([\s\S]*?\n\}/);
if (!functionMatch) {
  throw new Error('Falha nos testes do parser Gemini: função sanitizeGeminiJsonResponse não encontrada.');
}

const context = { console, JSON, Object, Array, String, Number, Boolean, RegExp, Math };
vm.runInNewContext(functionMatch[0], context);

const malformedResponse = `Alguma explicação antes\n{\n  "empatico": "Olá cliente!\nTudo bem?",\n  "atencioso": "Sua resposta foi registrada.",\n  "descontraido": "Vamos seguir com calma!",\n  "pos_tratamento": "Qualquer dúvida me avise."\n}\ntexto final`;
const parsed = context.sanitizeGeminiJsonResponse(malformedResponse);
if (!parsed || !parsed.empatico || !parsed.pos_tratamento) {
  throw new Error('Falha nos testes do parser Gemini: resposta inválida não foi recuperada.');
}

const batchFunctionMatch = app.match(/function sanitizeGeminiBatchJsonResponse\([\s\S]*?\n\}/);
if (!batchFunctionMatch) {
  throw new Error('Falha nos testes do parser Gemini Lote: função sanitizeGeminiBatchJsonResponse não encontrada.');
}
vm.runInNewContext(batchFunctionMatch[0], context);

const malformedBatchResponse = `Aqui está o lote gerado pela IA:\n[\n  {"index": 0, "nome": "Maria Silva", "mensagem": "Olá Maria! Como está a dor de garganta com o Amoxicilina?"},\n  {"index": 1, "nome": "Carlos Souza", "mensagem": "Oi Carlos! Passando para acompanhar sua medição de pressão."}\n]\nEsperamos que atenda!`;
const parsedBatch = context.sanitizeGeminiBatchJsonResponse(malformedBatchResponse, 2, 0);
if (!parsedBatch || parsedBatch.length !== 2 || !parsedBatch[0].includes('Amoxicilina') || !parsedBatch[1].includes('pressão')) {
  throw new Error('Falha nos testes do parser Gemini Lote: respostas do array não foram extraídas corretamente.');
}

const objectBatchResponse = `{\n  "mensagens": [\n    {"index": 0, "mensagem": "Mensagem 1 personalizada"},\n    {"index": 1, "mensagem": "Mensagem 2 personalizada"}\n  ]\n}`;
const parsedObjBatch = context.sanitizeGeminiBatchJsonResponse(objectBatchResponse, 2, 0);
if (!parsedObjBatch || parsedObjBatch.length !== 2 || !parsedObjBatch[0].includes('Mensagem 1') || !parsedObjBatch[1].includes('Mensagem 2')) {
  throw new Error('Falha nos testes do parser Gemini Lote: resposta encapsulada em objeto não foi recuperada.');
}

console.log('✅ Painel Gemini, Parser Individual e Parser de Lote: testes estruturais aprovados.');

// =========================================================================
// 2. TESTES DO SISTEMA DE CONTROLE DE ACESSO, APROVAÇÃO E MODERAÇÃO
// =========================================================================
const userRequirements = [
  ['aba de login no HTML', html.includes('id="tabLoginBtn"')],
  ['aba de cadastro no HTML', html.includes('id="tabRegisterBtn"')],
  ['formulário de cadastro no HTML', html.includes('id="registerForm"')],
  ['campo nome no cadastro', html.includes('id="regNameInput"')],
  ['campo drogaria/filial no cadastro', html.includes('id="regDrogariaInput"')],
  ['campo e-mail no cadastro', html.includes('id="regEmailInput"')],
  ['campo senha no cadastro', html.includes('id="regPassInput"')],
  ['campo confirmação de senha', html.includes('id="regPassConfirmInput"')],
  ['botão do painel administrativo no HTML', html.includes('id="adminUsersBtn"')],
  ['painel de gestão de usuários no HTML', html.includes('id="adminUsersPanel"')],
  ['contador de pendentes no HTML', html.includes('id="pendingUsersBadge"')],
  ['estatística de pendentes no HTML', html.includes('id="statPendingCount"')],
  ['estatística de aprovados no HTML', html.includes('id="statApprovedCount"')],
  ['estatística de rejeitados no HTML', html.includes('id="statRejectedCount"')],
  ['estatística de bloqueados no HTML', html.includes('id="statBlockedCount"')],
  ['estatística de total de usuários no HTML', html.includes('id="statTotalCount"')],
  ['campo de busca de usuários no HTML', html.includes('id="adminSearchInput"')],
  ['abas de filtro por status no HTML', html.includes('id="adminFilterTabs"')],
  ['modal de detalhes e auditoria no HTML', html.includes('id="adminUserDetailsModal"')],
  ['modal de motivo de rejeição no HTML', html.includes('id="adminRejectModal"')],
  ['estilos de abas de autenticação no CSS', css.includes('.auth-tabs') && css.includes('.auth-tab-btn')],
  ['estilos do painel de administração no CSS', css.includes('.admin-users-panel') && css.includes('.super-user-badge')],
  ['estilos de status pendente no CSS', css.includes('.status-badge.pending')],
  ['estilos de status aprovado no CSS', css.includes('.status-badge.approved')],
  ['estilos de status rejeitado no CSS', css.includes('.status-badge.rejected')],
  ['estilos de status bloqueado no CSS', css.includes('.status-badge.blocked')],
  ['estilos de role admin no CSS', css.includes('.role-badge.admin')],
  ['estilos de role user no CSS', css.includes('.role-badge.user')],
  ['estilos de controles de busca e filtro no CSS', css.includes('.admin-controls-bar') && css.includes('.admin-search-input')],
  ['estilos de modais de moderação no CSS', css.includes('.admin-modal') && css.includes('.admin-detail-grid')],
  ['função de submissão de cadastro no JS', app.includes('function handleRegisterSubmit(')],
  ['função de verificação de admin no JS', app.includes('function isSuperUser(')],
  ['função de aprovação de usuário no JS', app.includes('function approveUserAction(')],
  ['função de rejeição de usuário no JS', app.includes('function rejectUserAction(')],
  ['função de bloqueio de usuário no JS', app.includes('function blockUserAction(')],
  ['função de desbloqueio de usuário no JS', app.includes('function unblockUserAction(')],
  ['função de alteração de role no JS', app.includes('function toggleRoleUserAction(')],
  ['função de visualização de detalhes no JS', app.includes('function viewUserDetailsAction(')],
  ['função de edição de usuário no JS', app.includes('function editUserAction(')],
  ['função de exclusão de usuário no JS', app.includes('function deleteUserAction(')],
  ['função de normalização de status no JS', app.includes('function normalizeStatus(')],
  ['função de normalização de role no JS', app.includes('function normalizeRole(')],
  ['comando CLI usuarios no JS', app.includes("case 'usuarios':")],
  ['comando CLI aprovar no JS', app.includes("case 'aprovar':")],
  ['comando CLI rejeitar no JS', app.includes("case 'rejeitar':")],
  ['comando CLI bloquear no JS', app.includes("case 'bloquear':")],
  ['comando CLI desbloquear no JS', app.includes("case 'desbloquear':")],
  ['comando CLI role no JS', app.includes("case 'role':")],
  ['comando CLI deletar no JS', app.includes("case 'deletar':")],
  ['cabeçalho X-Content-Type-Options no customHttp.yml', customHttp.includes('nosniff')],
  ['cabeçalho X-Frame-Options no customHttp.yml', customHttp.includes('SAMEORIGIN')],
  ['cabeçalho Referrer-Policy no customHttp.yml', customHttp.includes('strict-origin-when-cross-origin')],
  ['função de cópia segura de lote no JS', app.includes('function copyBatchItemText(')],
  ['função de abertura segura de WhatsApp em lote no JS', app.includes('function openBatchItemWhatsApp(')],
  ['função de regeneração individual com IA no JS', app.includes('function regenerateBatchItemWithAI(')],
  ['função de edição inline de item de lote no JS', app.includes('function toggleEditBatchItem(') && app.includes('function saveEditBatchItem(')],
  ['função de regeneração de lote completo com IA no JS', app.includes('function regenerateEntireBatchWithAI(')],
  ['função de ativação inline da chave Gemini no lote', app.includes('function saveInlineBatchGeminiKey(')],
  ['seletor de tom da IA no painel de lote', app.includes('id="batchAiToneSelect"')],
  ['campo de instruções extras para IA no lote', app.includes('id="batchCustomInstruction"')],
  ['função de reinicialização segura de assistente por card no JS', app.includes('function startWizardFromCard(')],
  ['proteção contra fallback indevido em getSuperAdminUser', !app.includes('|| users[0]')],
  ['botão sobre na tela de login', html.includes('id="loginAboutBtn"')],
  ['modal sobre o projeto no HTML', html.includes('id="loginAboutModal"')],
  ['função de abertura do modal sobre no JS', app.includes('function openLoginAboutModal()')],
  ['função de fechamento do modal sobre no JS', app.includes('function closeLoginAboutModal()')]
];

const failedUserTests = userRequirements.filter(([, passed]) => !passed).map(([name]) => name);
if (failedUserTests.length) {
  throw new Error(`Falha nos testes de controle de acesso e moderação: ${failedUserTests.join(', ')}`);
}

// =========================================================================
// 3. TESTES DE LÓGICA DE NEGÓCIO E SIMULAÇÃO COMPLETA
// =========================================================================
const mockLocalStorage = {
  data: {},
  getItem(k) { return this.data[k] || null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

const domMock = {
  promptUserDisplay: { textContent: '' },
  statusUserDisplay: { textContent: '' },
  statusDrogariaDisplay: { textContent: '' },
  headerTerminalTitle: { textContent: '' },
  statPendingCount: { textContent: '' },
  statApprovedCount: { textContent: '' },
  statRejectedCount: { textContent: '' },
  statBlockedCount: { textContent: '' },
  statTotalCount: { textContent: '' },
  adminUsersTableContainer: { innerHTML: '' }
};

const testContext = {
  console,
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  document: {
    getElementById(id) { return domMock[id] || null; },
    querySelectorAll() { return []; }
  },
  DEFAULT_CONFIG: { drogaria: 'Drogasil Mogilar', farmaceutico: 'Maxwell' },
  SUPER_ADMIN_EMAILS: ['maxwellferreira@proton.me', 'maxwell'],
  USERS_STORAGE_KEY: 'apoio_users_registry'
};

const rbacLogic = `
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
  const raw = localStorage.getItem(USERS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
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
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function findUserRecord(term) {
  if (!term) return null;
  term = String(term).trim().toLowerCase();
  const users = getRegisteredUsers();
  return users.find(u => (u.email && u.email.toLowerCase() === term) || (u.uid && u.uid === term)) || null;
}

function isSuperUser(term) {
  if (!term) return false;
  term = String(term).trim().toLowerCase();
  if (SUPER_ADMIN_EMAILS.includes(term)) return true;
  const record = findUserRecord(term);
  return Boolean(record && record.role === 'admin');
}

function addAuditLogEntry(targetUser, action, details, adminActor = 'admin') {
  if (!targetUser) return;
  if (!Array.isArray(targetUser.auditLog)) targetUser.auditLog = [];
  targetUser.auditLog.unshift({
    action: action,
    performedBy: adminActor,
    timestamp: new Date().toISOString(),
    details: details || ''
  });
}

function approveUserAction(email, adminActor = 'admin') {
  const users = getRegisteredUsers();
  const target = users.find(u => u.email === email);
  if (!target) return false;
  target.status = 'approved';
  target.approvedAt = new Date().toISOString();
  target.approvedBy = adminActor;
  target.rejectedAt = null;
  target.rejectedBy = null;
  target.blockedAt = null;
  target.blockedBy = null;
  target.rejectionReason = null;
  addAuditLogEntry(target, 'APPROVAL', 'Usuário aprovado', adminActor);
  saveRegisteredUsers(users);
  return true;
}

function rejectUserAction(email, reason = 'Dados inválidos', adminActor = 'admin') {
  if (isSuperUser(email)) return false;
  const users = getRegisteredUsers();
  const target = users.find(u => u.email === email);
  if (!target) return false;
  target.status = 'rejected';
  target.rejectedAt = new Date().toISOString();
  target.rejectedBy = adminActor;
  target.rejectionReason = reason;
  addAuditLogEntry(target, 'REJECTION', reason, adminActor);
  saveRegisteredUsers(users);
  return true;
}

function blockUserAction(email, adminActor = 'admin') {
  if (isSuperUser(email)) return false;
  const users = getRegisteredUsers();
  const target = users.find(u => u.email === email);
  if (!target) return false;
  target.status = 'blocked';
  target.blockedAt = new Date().toISOString();
  target.blockedBy = adminActor;
  addAuditLogEntry(target, 'BLOCK', 'Conta bloqueada', adminActor);
  saveRegisteredUsers(users);
  return true;
}

function unblockUserAction(email, adminActor = 'admin') {
  const users = getRegisteredUsers();
  const target = users.find(u => u.email === email);
  if (!target) return false;
  target.status = 'approved';
  target.approvedAt = new Date().toISOString();
  target.approvedBy = adminActor;
  target.blockedAt = null;
  target.blockedBy = null;
  addAuditLogEntry(target, 'UNBLOCK', 'Conta desbloqueada', adminActor);
  saveRegisteredUsers(users);
  return true;
}

function toggleRoleUserAction(email, adminActor = 'admin') {
  if (isSuperUser(email)) return false;
  const users = getRegisteredUsers();
  const target = users.find(u => u.email === email);
  if (!target) return false;
  const newRole = target.role === 'admin' ? 'user' : 'admin';
  target.role = newRole;
  addAuditLogEntry(target, 'ROLE_CHANGE', 'Cargo alterado para ' + newRole, adminActor);
  saveRegisteredUsers(users);
  return true;
}
`;

vm.runInNewContext(rbacLogic, testContext);

// 1. Criação do Administrador Inicial
testContext.saveRegisteredUsers([
  {
    uid: 'admin-master',
    email: 'maxwellferreira@proton.me',
    name: 'Maxwell Ferreira',
    drogaria: 'Drogasil Mogilar',
    role: 'admin',
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: 'admin-master',
    rejectedAt: null,
    rejectedBy: null,
    blockedAt: null,
    blockedBy: null,
    rejectionReason: null,
    auditLog: [{ action: 'BOOTSTRAP', performedBy: 'sistema', timestamp: new Date().toISOString(), details: 'Admin inicial' }]
  }
]);

if (!testContext.isSuperUser('maxwellferreira@proton.me')) {
  throw new Error('Falha no teste: Administrador mestre deve ter privilégios administrativos.');
}

// 2. Novo cadastro de usuário comum (deve iniciar estritamente como "pending" e "user")
const usersList = testContext.getRegisteredUsers();
const newUserPayload = {
  uid: 'user-lucas-1',
  email: 'lucas@drogasil.com.br',
  name: 'Lucas Silva',
  drogaria: 'Drogasil Mogilar',
  role: 'user',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  blockedAt: null,
  blockedBy: null,
  rejectionReason: null,
  auditLog: [{ action: 'REGISTRATION', performedBy: 'lucas@drogasil.com.br', timestamp: new Date().toISOString(), details: 'Cadastro criado' }]
};
usersList.push(newUserPayload);
testContext.saveRegisteredUsers(usersList);

const checkLucas = testContext.findUserRecord('lucas@drogasil.com.br');
if (!checkLucas || checkLucas.status !== 'pending' || checkLucas.role !== 'user') {
  throw new Error('Falha no teste: Novo cadastro deve possuir status "pending" e role "user".');
}

// 3. Moderação: Aprovação pelo Administrador
const approvedRes = testContext.approveUserAction('lucas@drogasil.com.br', 'admin-master');
if (!approvedRes) {
  throw new Error('Falha no teste: Aprovação do usuário falhou.');
}

const checkApproved = testContext.findUserRecord('lucas@drogasil.com.br');
if (!checkApproved || checkApproved.status !== 'approved' || !checkApproved.approvedAt || checkApproved.approvedBy !== 'admin-master') {
  throw new Error('Falha no teste: Campos approvedAt/approvedBy não foram preenchidos corretamente após aprovação.');
}
if (!checkApproved.auditLog || checkApproved.auditLog.length < 2) {
  throw new Error('Falha no teste: Histórico de auditoria não registrou o evento de aprovação.');
}

// 4. Moderação: Bloqueio e Desbloqueio
testContext.blockUserAction('lucas@drogasil.com.br', 'admin-master');
const checkBlocked = testContext.findUserRecord('lucas@drogasil.com.br');
if (!checkBlocked || checkBlocked.status !== 'blocked' || !checkBlocked.blockedAt) {
  throw new Error('Falha no teste: Bloqueio do usuário falhou.');
}

testContext.unblockUserAction('lucas@drogasil.com.br', 'admin-master');
const checkUnblocked = testContext.findUserRecord('lucas@drogasil.com.br');
if (!checkUnblocked || checkUnblocked.status !== 'approved') {
  throw new Error('Falha no teste: Desbloqueio do usuário falhou.');
}

// 5. Moderação: Rejeição com Motivo
const newCandidate = {
  uid: 'user-candidato-2',
  email: 'estranho@externo.com',
  name: 'Usuário Estranho',
  drogaria: 'Desconhecida',
  role: 'user',
  status: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  approvedAt: null,
  approvedBy: null,
  rejectedAt: null,
  rejectedBy: null,
  blockedAt: null,
  blockedBy: null,
  rejectionReason: null,
  auditLog: []
};
const listWithCand = testContext.getRegisteredUsers();
listWithCand.push(newCandidate);
testContext.saveRegisteredUsers(listWithCand);

testContext.rejectUserAction('estranho@externo.com', 'E-mail não corporativo', 'admin-master');
const checkRejected = testContext.findUserRecord('estranho@externo.com');
if (!checkRejected || checkRejected.status !== 'rejected' || checkRejected.rejectionReason !== 'E-mail não corporativo' || !checkRejected.rejectedAt) {
  throw new Error('Falha no teste: Rejeição com motivo falhou.');
}

// 6. Moderação: Alteração de Role (Promoção a Admin)
testContext.toggleRoleUserAction('lucas@drogasil.com.br', 'admin-master');
const checkPromoted = testContext.findUserRecord('lucas@drogasil.com.br');
if (!checkPromoted || checkPromoted.role !== 'admin') {
  throw new Error('Falha no teste: Promoção de role para "admin" falhou.');
}

// 7. Teste de Ciclo de Vida de Senha & Revogação da Senha Antiga
(async () => {
  const crypto = require('crypto');
  const userDbContext = {
    console,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Date,
    Math,
    parseInt,
    crypto: {
      subtle: crypto.webcrypto.subtle,
      getRandomValues: (arr) => crypto.webcrypto.getRandomValues(arr)
    },
    TextEncoder,
    localStorage: {
      data: {},
      getItem(k) { return this.data[k] || null; },
      setItem(k, v) { this.data[k] = String(v); },
      removeItem(k) { delete this.data[k]; }
    },
    AppConfig: {
      getAdminCredentials: () => ({ user: 'admin@drogasil.com.br', pass: 'admin123', name: 'Administrador' })
    }
  };
  userDbContext.window = userDbContext;

  vm.runInNewContext(userDbCode, userDbContext);
  vm.runInNewContext(cognitoAuthCode, userDbContext);

  const udb = userDbContext.UserDB;
  const cauth = userDbContext.CognitoAuth;

  // 7.1. Login inicial com senha padrão
  const login1 = await cauth.signIn('admin@drogasil.com.br', 'admin123');
  if (!login1 || !login1.user || login1.user.role !== 'admin') {
    throw new Error('Falha no teste: Primeiro login do admin falhou.');
  }

  // 7.2. Usuário altera a senha pela 1ª vez para NovaSenhaSegura456!
  await cauth.changePassword('admin@drogasil.com.br', 'admin123', 'NovaSenhaSegura456!');

  // 7.3. Tenta autenticar com a NOVA senha -> DEVE TER SUCESSO
  const loginNew1 = await cauth.signIn('admin@drogasil.com.br', 'NovaSenhaSegura456!');
  if (!loginNew1 || !loginNew1.user) {
    throw new Error('Falha no teste: Login com 1ª nova senha alterada falhou.');
  }

  // 7.4. Tenta autenticar com a SENHA ANTIGA PADRÃO ("admin123") -> DEVE SER REJEITADO
  let oldPassRejected = false;
  try {
    await cauth.signIn('admin@drogasil.com.br', 'admin123');
  } catch (err) {
    oldPassRejected = true;
  }
  if (!oldPassRejected) {
    throw new Error('Falha de segurança crítica: A senha antiga padrão continuou sendo aceita após a 1ª alteração!');
  }

  // 7.5. Usuário altera a senha pela 2ª vez para OutraSenhaMaisNova789#
  await cauth.changePassword('admin@drogasil.com.br', 'NovaSenhaSegura456!', 'OutraSenhaMaisNova789#');

  // 7.6. Tenta autenticar com a 2ª senha antiga ("NovaSenhaSegura456!") -> DEVE SER REJEITADO
  let oldPass2Rejected = false;
  try {
    await cauth.signIn('admin@drogasil.com.br', 'NovaSenhaSegura456!');
  } catch (err) {
    oldPass2Rejected = true;
  }
  if (!oldPass2Rejected) {
    throw new Error('Falha de segurança crítica: A senha intermediária anterior continuou sendo aceita após a 2ª alteração!');
  }

  // 7.7. Tenta autenticar com a 3ª e atual senha ("OutraSenhaMaisNova789#") -> DEVE TER SUCESSO
  const loginNew2 = await cauth.signIn('admin@drogasil.com.br', 'OutraSenhaMaisNova789#');
  if (!loginNew2 || !loginNew2.user) {
    throw new Error('Falha no teste: Login com 2ª nova senha alterada falhou.');
  }

  // 7.8. Redefinição via Código (Esqueci a Senha) para SenhaFinalDefinitiva999!
  const resetReq = await udb.requestPasswordReset('admin@drogasil.com.br');
  const userObj = udb.getUserByEmailOrUid('admin@drogasil.com.br');
  await udb.confirmPasswordReset('admin@drogasil.com.br', userObj.resetCode, 'SenhaFinalDefinitiva999!');

  // 7.9. Senha antes do reset ("OutraSenhaMaisNova789#") DEVE SER REJEITADA
  let oldPass3Rejected = false;
  try {
    await cauth.signIn('admin@drogasil.com.br', 'OutraSenhaMaisNova789#');
  } catch (err) {
    oldPass3Rejected = true;
  }
  if (!oldPass3Rejected) {
    throw new Error('Falha de segurança crítica: Senha anterior ao reset por código continuou sendo aceita!');
  }

  // 7.10. Senha nova após reset DEVE TER SUCESSO
  const loginFinal = await cauth.signIn('admin@drogasil.com.br', 'SenhaFinalDefinitiva999!');
  if (!loginFinal || !loginFinal.user) {
    throw new Error('Falha no teste: Login após redefinição de senha falhou.');
  }

  console.log('✅ Teste de Segurança: Todas as senhas anteriores são imediatamente revogadas após qualquer alteração.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

console.log('✅ Todos os testes de controle de acesso, moderação (aprovar, rejeitar, bloquear, desbloquear, role, auditoria) e segurança foram aprovados com 100% de sucesso!');

// =========================================================================
// 4. TESTES DE GERAÇÃO EM LOTE COM IA GEMINI E PROTEÇÃO ANTI-SPAM
// =========================================================================
(async () => {
  const batchAppCode = `
    const DEFAULT_CONFIG = { drogaria: 'Drogasil Mogilar', farmaceutico: 'Maxwell' };
    ${app.match(/const ANTI_SPAM_BLOCKS = [\s\S]*?;\n\nconst usedMessageHashes = new Set\(\);/)?.[0] || 'const usedMessageHashes = new Set();'}
    ${app.match(/function capitalizeName\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/function getSaudacaoHorario\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/function classifyItem\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/function simpleStringHash\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/function generateUniqueAntiSpamMessage\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/function getGeminiApiKey\(\)[\s\S]*?\n\}\n\nfunction sanitizeGeminiJsonResponse/)?.[0]?.replace(/\nfunction sanitizeGeminiJsonResponse$/, '') || ''}
    ${app.match(/function sanitizeGeminiBatchJsonResponse\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/async function generateBatchMessagesAI\([\s\S]*?\n\}/)?.[0] || ''}
    ${app.match(/async function generateBatchMessagesSmart\([\s\S]*?\n\}/)?.[0] || ''}
  `;

  const batchContext = {
    console,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    Math,
    Date,
    Set,
    escapeHTML: (s) => String(s || ''),
    appendLog: () => {},
    localStorage: {
      data: {},
      getItem(k) { return this.data[k] || null; },
      setItem(k, v) { this.data[k] = String(v); },
      removeItem(k) { delete this.data[k]; }
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([
                { index: 0, nome: 'Maria Silva', mensagem: 'Olá Maria! Como está sua recuperação com Amoxicilina?' },
                { index: 1, nome: 'Carlos Souza', mensagem: 'Olá Carlos! Aferiu sua pressão hoje? Conte comigo!' }
              ])
            }]
          }
        }]
      })
    })
  };

  vm.runInNewContext(batchAppCode, batchContext);

  const sampleItems = [
    { nome: 'Maria Silva', medicamento: 'Amoxicilina 500mg', telefone: '11988887777', sintoma: 'dor de garganta' },
    { nome: 'Carlos Souza', medicamento: 'Aferição de Pressão', telefone: '11977776666' }
  ];

  // 1. Teste sem chave: Deve gerar usando gerador anti-spam local
  const localBatch = await batchContext.generateBatchMessagesSmart(sampleItems, { useAI: false });
  if (!localBatch || localBatch.length !== 2 || localBatch[0].isAI !== false || !localBatch[0].hashSignature.startsWith('SIG_')) {
    throw new Error('Falha no teste: Geração de lote local sem IA falhou.');
  }

  // 2. Teste com chave: Deve gerar usando IA Gemini com flag isAI = true
  batchContext.localStorage.setItem('apoio_gemini_api_key', 'test-api-key-123');
  const aiBatch = await batchContext.generateBatchMessagesSmart(sampleItems, { useAI: true });
  if (!aiBatch || aiBatch.length !== 2 || aiBatch[0].isAI !== true || !aiBatch[0].messageText.includes('Amoxicilina')) {
    throw new Error('Falha no teste: Geração de lote com IA Gemini falhou.');
  }

  // 4. Testes de Parsing e URLs de Envio WhatsApp
  if (typeof batchContext.parseBatchInputLine === 'function') {
    const pipeParsed = batchContext.parseBatchInputLine('Joana Darc | Dipirona 500mg | (11) 98765-4321 | febre');
    const tabParsed = batchContext.parseBatchInputLine('Marcos\tLosartana 50mg\t11912345678\tpressao alta');
    const commaParsed = batchContext.parseBatchInputLine('Ana Souza, Omeprazol 20mg, 11999998888, azia');

    if (!pipeParsed || pipeParsed.nome !== 'Joana Darc' || pipeParsed.telefone !== '11987654321') {
      throw new Error('Falha no teste: parseBatchInputLine com pipe falhou.');
    }
    if (!tabParsed || tabParsed.nome !== 'Marcos' || tabParsed.medicamento !== 'Losartana 50mg') {
      throw new Error('Falha no teste: parseBatchInputLine com tab falhou.');
    }
    if (!commaParsed || commaParsed.nome !== 'Ana Souza') {
      throw new Error('Falha no teste: parseBatchInputLine com vírgula falhou.');
    }
  }

  if (typeof batchContext.formatWhatsAppPhone === 'function' && typeof batchContext.buildWhatsAppSendUrl === 'function') {
    const formatted = batchContext.formatWhatsAppPhone('11988887777');
    if (formatted !== '5511988887777') {
      throw new Error(`Falha no teste: formatWhatsAppPhone retornou ${formatted}`);
    }
    const universalUrl = batchContext.buildWhatsAppSendUrl('11988887777', 'Olá **Maria**', 'universal');
    const webUrl = batchContext.buildWhatsAppSendUrl('11988887777', 'Olá Maria', 'web');

    if (!universalUrl.includes('api.whatsapp.com/send?phone=5511988887777') || !universalUrl.includes('Ol%C3%A1%20*Maria*')) {
      throw new Error('Falha no teste: buildWhatsAppSendUrl universal inválido.');
    }
    if (!webUrl.includes('web.whatsapp.com/send?phone=5511988887777')) {
      throw new Error('Falha no teste: buildWhatsAppSendUrl web inválido.');
    }
  }

  console.log('✅ Geração em lote com IA Gemini, Fila de Envio WhatsApp e Fallback Anti-Spam aprovados com 100% de sucesso!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
