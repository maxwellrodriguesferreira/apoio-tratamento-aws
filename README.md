# 💊🩺 Terminal de Apoio ao Tratamento & Serviços Farmacêuticos

**Projeto Pessoal e Independente · Criado e Desenvolvido por Maxwell Rodrigues Ferreira (Farmacêutico CRF-SP nº 86426 & Desenvolvedor Web)**

Aplicação web estática com interface retrô de terminal CRT para redação humanizada, acolhedora e personalizada de mensagens de acompanhamento farmacêutico, adesão terapêutica e pós-atendimento clínico em português do Brasil. Conta com processamento de mensagens individuais e em lote, fila interativa de envios para WhatsApp com proteção anti-spam, autenticação e controle de acesso baseado em funções (RBAC), painel administrativo com trilha de auditoria, cabeçalhos de segurança na AWS Amplify e integração com inteligência artificial via Google Gemini Flash.

- **Repositório GitHub:** [`maxwellrodriguesferreira/apoio-tratamento-aws`](https://github.com/maxwellrodriguesferreira/apoio-tratamento-aws)
- **Hospedagem & CI/CD:** **AWS Amplify Hosting**
- **Modelo de IA Generativa:** Google **Gemini Flash**
- **Autor & Responsável Técnico:** Maxwell Rodrigues Ferreira · Farmacêutico CRF-SP nº 86426 & Desenvolvedor Web

> [!IMPORTANT]
> **Aviso Legal / Isenção de Responsabilidade:**
> Esta é uma ferramenta **pessoal, independente e de estudo/apoio profissional criada pelo farmacêutico e desenvolvedor Maxwell Rodrigues Ferreira (CRF-SP nº 86426)**. **NÃO foi desenvolvida por, para ou a pedido da empresa RaiaDrogasil (Drogasil)**, não constituindo produto, canal ou sistema oficial da referida empresa. A revisão, validação técnica e orientação farmacêutica final permanecem sob exclusiva responsabilidade do profissional habilitado.

---

## 🌟 Funcionalidades Principais

### 💬 1. Geração de Mensagens Humanizadas & Classificação Clínica
- **4 Tons de Mensagem Personalizados**:
  1. **Empática**: Foco no acolhimento, cuidado, bem-estar e escuta ativa.
  2. **Atenciosa**: Abordagem clínica, preventiva e com foco na adesão correta aos horários e posologia.
  3. **Descontraída**: Linguagem leve, amigável e direta para contato rápido.
  4. **Pós-Tratamento**: Acompanhamento após a conclusão do ciclo medicamentoso ou procedimento clínico.
- **Reconhecimento Automático de Serviços Farmacêuticos**:
  - 💉 Aplicação de injetáveis (dor local, calor, vermelhidão, alívio de sintomas).
  - 📲 Aplicação de sensor contínuo de glicose (ex: FreeStyle Libre - fixação e sincronização).
  - 🩺 Aferição de pressão arterial e monitoramento de hipertensão/sintomas.
  - 👂 Perfuração do lóbulo auricular e colocação de brincos (cicatrização e antissepsia).
  - 🤧 Teste rápido de Influenza (gripe e evolução do quadro).
  - 🦠 Teste rápido de COVID-19 (isolamento e evolução respiratória).
  - 🫁 Teste de Painel Respiratório (vírus respiratórios e alívio de tosse/febre).
  - ⚖️ Avaliação de Bioimpedância (leitura do relatório de massa magra/gordura e metas).
- **Ações Imediatas**: Cópia de texto com formatação para WhatsApp com 1 clique e botão para abertura direta via link wa.me/api.

---

### 📦 2. Processamento em Lote & Fila de Envio WhatsApp com Proteção Anti-Spam
- **Entrada Inteligente Multi-Formato**: Aceita linhas coladas diretamente do Excel, Google Sheets ou arquivos de texto delimitadas por `|` (pipe), `Tab`, vírgula `,` ou ponto e vírgula `;` (`Nome | Medicamento/Serviço | Telefone | Sintoma/Contexto`).
- **Geração Inteligente com Google Gemini**: Redação personalizada de cada mensagem do lote considerando o histórico do cliente e contexto clínico.
- **Painel Interativo de Fila de Disparos (`batch-send-panel`)**:
  - **Barra de Progresso Visual**: Indicador percentual em tempo real do processamento do lote.
  - **Controle de Intervalo**: Temporizador configurável (3s, 5s, 8s, 10s) entre aberturas de janelas para prevenir bloqueios.
  - **Seletor de Modo de Destino**: Opção de disparo via **WhatsApp Universal** (`api.whatsapp.com`) ou **WhatsApp Web Direto** (`web.whatsapp.com`).
  - **Status Individual em Tempo Real**: Badges dinâmicas (*Pendente*, *Enviando*, *Enviado*, *Ignorado*).
  - **Edição Inline de Telefone & Mensagem**: Correção imediata de dados sem necessidade de reiniciar o lote.
  - **Regeneração com IA**: Opção de regenerar uma mensagem específica com Gemini ou reprocessar o lote inteiro.
- **Algoritmo Anti-Bloqueio no WhatsApp**:
  - Variações semânticas e estruturais únicas em cada texto.
  - Inserção de caracteres invisíveis (*Zero-Width Spaces*).
  - Hash identificador exclusivo (`SIG_...`) para conferência e rastreabilidade.
- **Exportação para Planilha CSV**: Baixe relatórios completos contendo dados dos clientes, contatos, hashes de integridade, textos gerados e status de envio.

---

### 👥 3. Controle de Acesso Baseado em Funções (RBAC) & Moderação
- **Aba de Cadastro de Novos Usuários**: Formulário guiado com nome completo, filial/drogaria de atuação, e-mail e senha.
- **Fluxo de Aprovação Obrigatória**:
  - Todo novo cadastro recebe status inicial **`Pendente`** (`pending`) e função **`user`**.
  - O acesso é bloqueado até a aprovação formal por um **Administrador**.
- **Painel Administrativo (`👥 Painel Admin` / `/admin/users`)**:
  - **Métricas em Tempo Real**: Contadores de usuários *Pendentes*, *Aprovados*, *Rejeitados*, *Bloqueados* e *Total*.
  - **Busca Instantânea & Filtros por Aba**: Filtragem ágil por nome, e-mail ou filial.
  - **Moderação Completa com 1 Clique**:
    - `✅ Aprovar`: Libera o acesso imediato ao sistema.
    - `❌ Rejeitar`: Recusa o cadastro com modal interativo para registro de justificativa.
    - `⛔ Bloquear / 🔓 Desbloquear`: Suspende ou restabelece acessos previamente autorizados.
    - `⭐ Alternar Role`: Altera permissões entre Usuário Comum (`user`) e Administrador (`admin`).
    - `✏️ Editar`: Ajusta dados cadastrais (nome e drogaria).
    - `🗑️ Excluir`: Remove registros do sistema com segurança.
  - **Trilha de Auditoria Detalhada**: Modal com carimbos de data/hora, administradores responsáveis (`approvedBy`, `rejectedBy`, `blockedBy`) e histórico de decisões.

---

### 🔄 4. Sincronização Dinâmica da Sessão
- **Barra de Status Inferior**: Exibe a drogaria ativa (`🏬 Drogaria`) e o profissional conectado (`👨‍⚕️ Usuário`).
- **Prompt CLI & Título do Terminal**: Formatação no estilo `<usuario>@<drogaria-slug>:~$` na janela e no console.
- **Assinaturas Automáticas**: Injeção dinâmica do nome do profissional e filial nas mensagens geradas e nos prompts enviados ao Gemini.

---

### 🛡️ 5. Segurança & Cabeçalhos HTTP (`customHttp.yml`)
- **Headers HTTP Seguros no AWS Amplify**: Configuração de `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block` e `Referrer-Policy: strict-origin-when-cross-origin`.
- **Permissions-Policy Restritiva**: Bloqueio de acesso a microfone, câmera e geolocalização.
- **Imutabilidade e Integridade Local**: Validação de integridade de sessões locais e controle de super-usuário.

---

## 🧠 Integração com Google Gemini Flash

O sistema integra a inteligência artificial generativa **Google Gemini Flash** para criar mensagens personalizadas e clinicamente adaptadas:

- **Módulo de Configuração Central ([`app-config.js`](file:///home/maxwell/terminal/app-config.js)):**
  - Gerencia a chave da API do Gemini (`AppConfig.getGeminiApiKey()` e `AppConfig.setGeminiApiKey()`).
  - Suporta injeção de chave via variável de ambiente `GEMINI_API_KEY` durante o build no AWS Amplify.
- **Fallback Automático:** Quando a chave não está configurada ou a IA está temporariamente indisponível, o motor local anti-spam assume a geração de forma instantânea e sem interrupção.
- **Configuração da Chave:**
  - Abra o modal clicando em **⚙️ Configurações** ou digite `ia` / `apikey [chave]` no terminal.
  - As chaves podem ser obtidas gratuitamente no [Google AI Studio](https://aistudio.google.com/apikey).

---

## 💻 Tabela Completa de Comandos da CLI

| Comando | Descrição / Ação | Exemplo Prático |
| :--- | :--- | :--- |
| `novo`, `guiado`, `criar` | Abre o formulário guiado de criação individual. | `novo` |
| `gerar [nome] [item]` | Gera mensagens diretamente a partir dos parâmetros informados. | `gerar "Carlos" "Amoxicilina 500mg"` |
| `gerar --nome ... --medicamento ...` | Gera mensagens utilizando flags nomeadas. | `gerar --nome Ana --medicamento "Pressão Arterial"` |
| `lote`, `batch`, `massa` | Abre o assistente de processamento e disparo de mensagens em lote. | `lote` |
| `servicos`, `servico` | Lista os 8 serviços farmacêuticos clínicos suportados pelo motor. | `servicos` |
| `sobre`, `info`, `autor`, `creditos` | Exibe dados do projeto, idealizador e farmacêutico responsável. | `sobre` |
| `historico` | Exibe o histórico de mensagens geradas na sessão. | `historico` |
| `historico limpar`, `zerar` | Limpa o histórico de mensagens e reinicia o contador diário. | `zerar` |
| `exemplos`, `exemplo` | Gera 3 casos clínicos demonstrativos (medicamentos e serviços). | `exemplos` |
| `ia`, `gemini`, `config` | Abre o painel de configurações do Google Gemini. | `ia` |
| `ia status` / `ia remover` | Consulta o status de conexão da IA ou remove a chave salva. | `ia status` |
| `apikey [chave]` | Salva a chave de API do Gemini diretamente pelo terminal. | `apikey AIzaSy...` |
| `tema [matrix\|amber\|cyberpunk\|dark]` | Alterna ou define o esquema de cores e estilo visual do CRT. | `tema amber` |
| `crt`, `scanlines` | Ativa ou desativa o efeito de scanlines do monitor CRT. | `crt` |
| `limpar`, `clear`, `cls` | Limpa a tela do terminal CRT. | `limpar` |
| `usuario`, `whoami`, `perfil` | Exibe os dados do usuário autenticado e permissões ativas. | `whoami` |
| `senha [nova_senha]` | Altera a senha do usuário local. | `senha 123456` |
| `sair`, `logout` | Encerra a sessão atual e bloqueia o terminal. | `sair` |
| `ajuda`, `help`, `?` | Exibe a lista completa de comandos e atalhos disponíveis. | `ajuda` |
| **Comandos Administrativos (Super Usuário)** | | |
| `usuarios`, `admin`, `users` | Abre o painel administrativo de aprovação e gestão de farmacêuticos. | `usuarios` |
| `aprovar [email\|nome]` | Aprova diretamente o cadastro de um farmacêutico pelo CLI. | `aprovar camila@drogasil.com.br` |
| `rejeitar [email] [motivo]` | Rejeita o cadastro de um usuário informando a justificativa. | `rejeitar joao@email.com Cadastro incompleto` |
| `bloquear [email\|nome]` | Suspende temporariamente o acesso de um usuário. | `bloquear joao@email.com` |
| `desbloquear [email\|nome]` | Reativa o acesso de uma conta previamente suspensa. | `desbloquear joao@email.com` |
| `role [email] [user\|admin]` | Altera a permissão entre usuário comum e administrador. | `role camila@drogasil.com.br admin` |
| `deletar [email\|nome]` | Exclui permanentemente um registro de usuário do sistema. | `deletar teste@email.com` |

---

## 🔒 Privacidade & Proteção de Dados (LGPD)

- **Configuração Exclusiva da API:** Apenas a chave de API do Gemini da aplicação é gerenciada.
- **Zero Dados de Clientes no Banco:** Nomes, telefones, medicamentos, posologias ou mensagens geradas **NUNCA** são gravados em bancos de dados na nuvem ou externos.
- **Processamento Volátil em Tempo Real:** O processamento com IA utiliza apenas os parâmetros em tempo de execução para redação da mensagem.

---

## 📂 Arquitetura do Projeto

A aplicação é 100% estática, construída com JavaScript modular moderno (ES6+), CSS com variáveis e hospedada na AWS Amplify:

| Arquivo | Descrição e Responsabilidade |
| :--- | :--- |
| [`index.html`](file:///home/maxwell/terminal/index.html) | Estrutura semântica da aplicação, tela CRT, modais, formulários de autenticação/cadastro e painel administrativo. |
| [`style.css`](file:///home/maxwell/terminal/style.css) | Design system CRT, scanlines, 4 temas visuais, badges de status, fila de envio em lote e responsividade mobile. |
| [`app.js`](file:///home/maxwell/terminal/app.js) | Núcleo da CLI, motor de geração de mensagens, fila de disparos para WhatsApp, moderação RBAC e integração Gemini. |
| [`cognito-auth.js`](file:///home/maxwell/terminal/cognito-auth.js) | Integração de autenticação com AWS Cognito User Pool (SDK Amazon Cognito Identity). |
| [`user-db.js`](file:///home/maxwell/terminal/user-db.js) | Banco de dados seguro de usuários locais com criptografia PBKDF2/SHA-256 e auditoria. |
| [`app-config.js`](file:///home/maxwell/terminal/app-config.js) | Configuração central da aplicação, gestão da chave Gemini e parâmetros do AWS Cognito. |
| [`amplify.yml`](file:///home/maxwell/terminal/amplify.yml) | Especificação de build e deploy contínuo do AWS Amplify Hosting com injeção de variáveis de ambiente. |
| [`customHttp.yml`](file:///home/maxwell/terminal/customHttp.yml) | Cabeçalhos de segurança HTTP (Cache-Control, X-Frame-Options, X-Content-Type-Options, etc.). |
| [`test.js`](file:///home/maxwell/terminal/test.js) | Suíte completa de testes automatizados (parsers de IA, validações RBAC, URLs de WhatsApp e integridade). |

---

## 🧪 Execução e Validação Local

Para executar a aplicação localmente:

```bash
# Iniciar servidor estático local na porta 8080
cd /home/maxwell/terminal
python3 -m http.server 8080
```

Acesse [http://localhost:8080](http://localhost:8080) no navegador.

Para executar a suíte automatizada de validação:

```bash
node --check app-config.js
node --check user-db.js
node --check cognito-auth.js
node --check app.js
node test.js
```

---

## 🚀 Publicação e Deploy (AWS Amplify & AWS Cognito)

Cada alteração enviada para a branch `main` é automaticamente construída e publicada pelo AWS Amplify Hosting:

```bash
git add .
git commit -m "feat: sua alteracao em portugues"
git push
```

### Configuração de Variáveis de Ambiente no AWS Amplify Console
No console do **AWS Amplify**, acesse **App settings > Environment variables** e configure:

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Chave da API do Google Gemini Flash obtida no Google AI Studio | `AIzaSy...` |
| `COGNITO_REGION` | Região do seu AWS Cognito User Pool | `us-east-1` ou `sa-east-1` |
| `COGNITO_USER_POOL_ID` | ID do seu User Pool no AWS Cognito | `us-east-1_xxxxxxxxx` |
| `COGNITO_CLIENT_ID` | ID do App Client (sem client secret) do Cognito | `7abcdef1234567890abcdef` |
| `ADMIN_USER` | E-mail do Administrador mestre da aplicação | `maxwellferreira@proton.me` |
| `ADMIN_PASSWORD` | Senha inicial do Administrador mestre | `SuaSenhaSegura123` |

---

## 📌 Versão

**4.0.0-AWS** — Migração para AWS Amplify Hosting e AWS Cognito, centralização da configuração do Google Gemini via `app-config.js` com suporte a variáveis de ambiente da AWS, eliminação de dependências do Firebase e garantia de 0 persistência de dados de clientes em banco de dados.
