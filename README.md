# 💊🩺 Terminal de Apoio ao Tratamento & Serviços Farmacêuticos

**Projeto Pessoal e Independente · Criado e Desenvolvido por Maxwell Rodrigues Ferreira (Farmacêutico CRF-SP nº 86426 & Desenvolvedor Web)**

Aplicação web estática com interface retrô de terminal CRT para redação humanizada, acolhedora e personalizada de mensagens de acompanhamento farmacêutico, adesão terapêutica e pós-atendimento clínico em português do Brasil. Conta com processamento de mensagens individuais e em lote, fila interativa de envios para WhatsApp com proteção anti-spam, autenticação e controle de acesso baseado em funções (RBAC), painel administrativo com trilha de auditoria, cabeçalhos de segurança na AWS Amplify e integração com inteligência artificial via Google Gemini Flash.

- **Repositório GitHub:** [`maxwellrodriguesferreira/apoio-tratamento-aws`](https://github.com/maxwellrodriguesferreira/apoio-tratamento-aws)
- **Hospedagem & CI/CD:** **AWS Amplify Hosting**
- **Modelo de IA Generativa:** Google **Gemini Flash** (`gemini-3.8-flash` / `gemini-2.0-flash` / `gemini-1.5-flash`)
- **Autenticação:** **AWS Cognito User Pools** com fallback criptográfico PBKDF2 / SHA-256
- **Autor & Responsável Técnico:** Maxwell Rodrigues Ferreira · Farmacêutico CRF-SP nº 86426 & Desenvolvedor Web

> [!IMPORTANT]
> **Aviso Legal / Isenção de Responsabilidade:**
> Esta é uma ferramenta **pessoal, independente e de estudo/apoio profissional criada pelo farmacêutico e desenvolvedor Maxwell Rodrigues Ferreira (CRF-SP nº 86426)**. **NÃO foi desenvolvida por, para ou a pedido da empresa RaiaDrogasil (Drogasil)**, não constituindo produto, canal ou sistema oficial da referida empresa. A revisão, validação técnica e orientação farmacêutica final permanecem sob exclusiva responsabilidade do profissional habilitado.
> 
> **Zero Persistência de Dados de Clientes:** Em estrito cumprimento à LGPD (Lei Geral de Proteção de Dados) e às boas práticas de segurança em saúde, **nenhum dado sensível de clientes/pacientes (nomes, contatos, medicamentos ou sintomas) é salvo em banco de dados externo ou compartilhado**.

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
- **Ações Imediatas**: Cópia de texto com formatação para WhatsApp com 1 clique e botão para abertura direta via link `wa.me/api`.

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

### 👥 3. Autenticação, Gestão de Credenciais & Moderação
- **Módulo de Autenticação Híbrido (`CognitoAuth` / `UserDB`)**:
  - Integração com **AWS Cognito User Pools** (SDK `amazon-cognito-identity-js`) com fallback seguro para banco local criptografado com **PBKDF2 / SHA-256** (100.000 iterações e salt aleatório).
- **Recuperação Segura de Senha ("Esqueci a Senha")**:
  - Fluxo em duas etapas com código de verificação de 6 dígitos enviado por e-mail com validade de 15 minutos.
  - Sem exibição do código na interface gráfica para proteção absoluta.
- **Modal "👤 Meu Perfil / Redefinir Credenciais"**:
  - Permite aos farmacêuticos e administradores alterar a senha atual e atualizar dados cadastrais (nome e filial) a qualquer momento.
- **Painel Administrativo (`👥 Painel Admin` / `/admin/users`)**:
  - **Métricas em Tempo Real**: Contadores de usuários *Pendentes*, *Aprovados*, *Rejeitados*, *Bloqueados* e *Total*.
  - **Moderação Completa com 1 Clique**:
    - `✅ Aprovar`: Libera o acesso imediato ao sistema.
    - `❌ Rejeitar`: Recusa o cadastro com registro de justificativa.
    - `⛔ Bloquear / 🔓 Desbloquear`: Suspende ou restabelece acessos previamente autorizados.
    - `⭐ Alternar Role`: Altera permissões entre Usuário Comum (`user`) e Administrador (`admin`).
    - `✏️ Editar` / `🗑️ Excluir`: Gerenciamento seguro de cadastros.
  - **Trilha de Auditoria**: Carimbos ISO e histórico de todas as ações de moderação.

---

## 🌐 Como Configurar Domínio Personalizado da Hostinger no AWS Amplify

Para utilizar seu domínio próprio registrado na **Hostinger** (ex: `meudominio.com.br` ou `apoio.meudominio.com.br`) na sua aplicação hospedada no **AWS Amplify**, siga os passos abaixo:

### Passo 1: Iniciar a configuração no AWS Amplify
1. Acesse o **[Console AWS Amplify](https://console.aws.amazon.com/amplify/)**.
2. Selecione seu aplicativo (`apoio-tratamento-aws`).
3. No menu lateral esquerdo, clique em **Hosting** > **Custom domains** (Domínios personalizados).
4. Clique no botão **Add domain** (Adicionar domínio).
5. Digite o seu domínio adquirido na Hostinger (ex: `meudominio.com.br`) e clique em **Configure domain**.
6. Configure os apontamentos de branch:
   - Apontar `meudominio.com.br` para o branch `main`.
   - Apontar `www.meudominio.com.br` (ou subdomínio) para o branch `main`.
7. Clique em **Save** (Salvar).

### Passo 2: Copiar os registros DNS fornecidos pela AWS
O AWS Amplify gerará automaticamente:
1. **Registro CNAME de Verificação SSL (Certificado Gratuito ACM):**
   - **Nome / Host:** `_xxxxxxxx.meudominio.com.br`
   - **Tipo:** `CNAME`
   - **Valor / Aponta para:** `_yyyyyyyy.acm-validations.aws.`
2. **Registros de Apontamento do Site:**
   - **Para subdomínio (ex: `www` ou `app`):** Registro `CNAME` apontando para o endereço CloudFront do Amplify (ex: `dxxxxxxxx.cloudfront.net`).
   - **Para o domínio raiz (`@`):** Registros `ANAME` / `ALIAS` ou `CNAME` conforme a Hostinger disponibilizar.

### Passo 3: Inserir os registros no Painel DNS da Hostinger
1. Acesse o **[Painel da Hostinger (hPanel)](https://hpanel.hostinger.com/)**.
2. Vá em **Domínios** > Selecione o seu domínio > Clique em **DNS / Servidores de Nomes**.
3. Na seção **Gerenciar registros DNS**, adicione:
   - **Validação SSL:**
     - **Tipo:** `CNAME`
     - **Nome:** O prefixo gerado pela AWS (sem o nome do domínio no final)
     - **Alvo / Aponta para:** O valor do ACM fornecido pela AWS
     - **TTL:** `300` ou `Padrão`
   - **Apontamento do Aplicativo (Subdomínio www ou app):**
     - **Tipo:** `CNAME`
     - **Nome:** `www` (ou o subdomínio desejado)
     - **Alvo:** `dxxxxxxxx.cloudfront.net` (URL do CloudFront fornecida pelo Amplify)
     - **TTL:** `300` ou `Padrão`
4. Clique em **Adicionar Registro**.

> [!NOTE]
> A propagação de DNS costuma levar de 15 minutos a poucas horas. Assim que os registros forem validados, o AWS Amplify emitirá o certificado SSL HTTPS gratuitamente e o seu domínio ficará 100% ativo e seguro!

---

## ⌨️ Comandos do Terminal CLI

| Comando | Descrição | Exemplo de Uso |
| :--- | :--- | :--- |
| `novo` / `gerar` | Inicia o assistente interativo para redação de mensagem. | `novo` |
| `lote` / `batch` | Abre o painel de processamento em lote para WhatsApp. | `lote` |
| `perfil` / `conta` | Abre o modal Meu Perfil para alteração cadastral e de senha. | `perfil` |
| `senha` / `redefinir`| Abre diretamente a aba de alteração de senha. | `senha` |
| `ia` / `config` | Abre o painel de configurações da chave Gemini. | `ia` |
| `apikey [chave]` | Salva a chave de API do Gemini diretamente pelo terminal. | `apikey AIzaSy...` |
| `historico` | Exibe o histórico de mensagens geradas na sessão. | `historico` |
| `limpar` | Limpa o buffer de saída do terminal. | `limpar` |
| `tema [matrix\|amber\|cyberpunk\|dark]` | Alterna o esquema de cores retrô do terminal. | `tema amber` |
| `crt` | Liga ou desliga o efeito visual de tubo CRT (scanlines). | `crt` |
| `usuarios` / `admin` | Abre o Painel Administrativo de Gestão de Usuários (Requer Admin). | `usuarios` |
| `aprovar [email]` | Aprova diretamente o cadastro de um farmacêutico pelo CLI. | `aprovar camila@drogaria.com.br` |
| `rejeitar [email] [motivo]` | Rejeita o cadastro de um usuário informando justificativa. | `rejeitar joao@drogaria.com.br Incompleto` |
| `bloquear [email]` | Suspende o acesso de um usuário. | `bloquear joao@drogaria.com.br` |
| `desbloquear [email]` | Reativa o acesso de uma conta suspensa. | `desbloquear joao@drogaria.com.br` |
| `role [email] [user\|admin]` | Altera a permissão entre usuário e administrador. | `role camila@drogaria.com.br admin` |
| `deletar [email]` | Exclui permanentemente um registro de usuário do sistema. | `deletar teste@drogaria.com.br` |
| `sair` / `logout` | Encerra a sessão ativa com segurança. | `sair` |

---

## 🛠️ Variáveis de Ambiente no AWS Amplify

No console do AWS Amplify (**App Settings** > **Environment variables**):

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Chave da API do Google Gemini obtida no Google AI Studio | `AIzaSy...` |
| `COGNITO_REGION` | Região do seu AWS Cognito User Pool | `us-east-1` ou `sa-east-1` |
| `COGNITO_USER_POOL_ID` | ID do seu User Pool no AWS Cognito | `us-east-1_xxxxxxxxx` |
| `COGNITO_CLIENT_ID` | ID do App Client (sem client secret) do Cognito | `7abcdef1234567890abcdef` |
| `ADMIN_USER` | E-mail do Administrador Master configurável no build | `admin@suadrogaria.com.br` |
| `ADMIN_PASSWORD` | Senha inicial de build do Administrador Master | `SuaSenhaSegura123!` |

---

## 🧪 Validação e Testes Automatizados

Para rodar os testes e verificar a integridade da aplicação:

```bash
# Validação de sintaxe
node --check app-config.js
node --check cognito-auth.js
node --check user-db.js
node --check app.js

# Execução da suíte de testes de integração, segurança e IA
node test.js
```

---

## 📄 Licença & Propriedade Intelectual

Desenvolvido por **Maxwell Rodrigues Ferreira** · Farmacêutico inscrito no **CRF-SP sob o nº 86426**. Todos os direitos reservados.
