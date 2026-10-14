# AMA FISIO — Cadastro e anamnese (versão 3)

## O que mudou

A aba **Clientes** foi ampliada e passou a se chamar **Anamnese**. Cada paciente pode ter uma ficha com identificação e responsável legal, queixa e história atual, antecedentes e medicamentos, seção pediátrica e desenvolvimento, avaliação respiratória, exame físico, plano fisioterapêutico e **evoluções datadas**. A agenda e os lembretes no sino foram mantidos.

O formulário contém sete seções expansíveis. Apenas o nome completo é obrigatório para criar uma ficha. A profissional preenche o restante conforme o atendimento e pode editar a ficha sem perder o histórico das evoluções.

## Como atualizar no GitHub

1. **Antes de tudo, faça uma cópia de segurança** pela opção Configurações → Baixar backup criptografado na versão que já está funcionando.
2. Extraia o ZIP.
3. No repositório do GitHub que já publica o site, abra **Code → Add file → Upload files**.
4. Envie **o conteúdo da pasta `AMA-FISIO-ANAMNESE-V3`** para a **raiz do repositório**, não a pasta externa. Devem aparecer `index.html`, `app.js`, `styles.css`, `firebase-config.js`, `firestore.rules`, `assets/` na mesma altura.
5. Confirme a atualização dos arquivos de mesmo nome e clique em **Commit changes**. Não apague as pastas antigas sem necessidade.
6. Aguarde o GitHub Pages concluir a publicação e recarregue seu endereço atual com Ctrl + Shift + R.
7. Entre como fazia antes. Abra **Anamnese → Nova ficha**. Preencha dados fictícios para testar; depois use **Ficha** para editar e **Evoluções** para registrar uma anotação.

Não é necessário recriar o Firebase, nem alterar Authentication ou Rules para testar essa ampliação. O `firebase-config.js` está preservado e identifica o projeto `ama-fisio-novo-sistema`.

## Atenção: áudio e conteúdo solicitado

O áudio original foi identificado, mas **não foi possível obter uma transcrição verificável neste ambiente**. As seções clínicas são um **modelo-base**, não uma reprodução fiel das palavras da cliente. Para ajustar a ficha exatamente ao áudio, forneça a transcrição que o WhatsApp exibe ou envie as informações pedidas por ela em texto.

## Segurança e armazenamento (importante)

- A versão atual armazena os dados **apenas no navegador**, num cofre criptografado. O Firestore está bloqueado: **não há sincronização entre dispositivos**.
- Usuários cadastrados são locais e não são contas do Firebase. O nome e a senha no JavaScript não dão permissão ao Firestore.
- Um site publicado no GitHub Pages é acessível a terceiros mesmo que seu link não seja divulgado. Senhas padrão fixadas em um repositório público **não bastam para proteger prontuários de pacientes**.
- **Não use esta versão para guardar dados reais sensíveis de saúde em ambiente de produção.** É necessário implementar autenticação e controle de acesso confiáveis, governança de dados, backups e procedimentos compatíveis com a LGPD e com as obrigações profissionais aplicáveis.
- Não ative regras abertas no Firebase (`allow read, write: if true`).

## Estrutura

- `index.html`: página do sistema.
- `styles.css`: visual do computador e celular.
- `app.js`: cadastro, anamnese, evoluções, agenda, notificações e backup local.
- `firebase-config.js`: identificação pública do novo projeto (sem uso de Firestore para dados nesta versão).
- `firestore.rules`: regras de bloqueio do banco.
- `assets/logo.webp`: logo fornecida.
