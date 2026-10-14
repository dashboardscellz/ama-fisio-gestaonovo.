# AMA FISIO — configuração do projeto Firebase `ama-fisio-novo-sistema`

## O que já fizemos
- Registramos no pacote os identificadores Web informados por você, no arquivo `firebase-config.js`.
- O `index.html` carrega esse arquivo antes de `app.js`. A tela **Configurações** já exibe os identificadores do novo projeto.
- **Não é necessário** digitar a chave API ou configurar npm ou e-mail para usar o protótipo local.

## O que fazer agora no Firebase
1. Acesse https://console.firebase.google.com/ e selecione **ama-fisio-novo-sistema**.
2. No menu, abra **Bancos de dados e armazenamento → Firestore Database**. Se ainda não existe banco, escolha **Criar banco de dados**.
3. Se perguntado, use a edição **Standard**, ID **(default)**, região de sua preferência (São Paulo, `southamerica-east1`, se disponível), e **modo de produção**.
4. Abra **Cloud Firestore → Regras**.
5. Cole o conteúdo do arquivo `firestore.rules` deste ZIP e clique em **Publicar**. O arquivo contém `allow read, write: if false;`.
6. Não ative o Realtime Database nem Firebase Authentication apenas para executar esta versão local.

## O que fazer no GitHub
1. Abra seu repositório novo (evite o repositório antigo com diversas versões do AMA FISIO).
2. Na aba **Code**, use **Add file → Upload files** e envie todo o conteúdo desta pasta **para a raiz**, incluindo `index.html`, `app.js`, `styles.css`, `firebase-config.js` e `assets/logo.webp`. Não envie só o ZIP fechado.
3. Vá para **Settings → Pages** e escolha **Deploy from a branch**, branch `main`, pasta `/(root)`, **Save**.
4. Aguarde a mensagem **Your site is live at ...** e clique em **Visit site**.
5. O site abrirá com a tela do AMA FISIO. O login mestre é o já definido anteriormente na conversa.

## Limite importante da versão
Os cadastros, funcionários e agendamentos permanecem em um **cofre local criptografado no navegador**, sem sincronização entre aparelhos. O Firebase está **identificado**, mas **não recebe pacientes** nesta versão. Isso não é uma falha na API key: a autenticação validada apenas no JavaScript público não autoriza regras seguras de Firestore. Para sincronização de dados clínicos reais, é indispensável um controle de acesso verificável pelo serviço, como autenticação Firebase ou backend protegido.

Não publique regras `allow read, write: if true;` para cadastros de pacientes. Não coloque senha mestre, chaves privadas ou credenciais de conta de serviço no GitHub.

Fontes oficiais: https://firebase.google.com/docs/web/setup ; https://firebase.google.com/docs/firestore/security/get-started ; https://docs.github.com/pages/getting-started-with-github-pages/creating-a-github-pages-site
