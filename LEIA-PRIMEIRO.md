# AMA FISIO — INSTRUÇÕES DE ABERTURA

**Comece pelo arquivo `GUIA-COMPLETO-COM-TELAS.pdf`** (ou pela versão `.md`). O manual foi atualizado em 14/10/2026, com os caminhos de telas reais do GitHub e Firebase e todas as instruções passo a passo.

## Enviar para o GitHub
Envie **somente os arquivos necessários do site**, na **raiz** de um **repositório novo**: `index.html`, `app.js`, `styles.css` e **a pasta** `assets`, que contém `logo.webp`. Pode enviar `.nojekyll`. Não envie o ZIP fechado. Consulte o manual antes de publicar.

## Firebase
Crie novo projeto, registre app web, crie Firestore Standard `(default)` e copie as regras do arquivo `firestore.rules` para **Firestore → Regras → Publicar**. O banco continuará negando acesso: o login local não autoriza o Firestore, nem envia dados para a nuvem.

## Conta mestre
Login: **Amanda Marinho**. A senha escolhida anteriormente **já está pré-configurada**; não há cadastro inicial. Não envie a senha a repositórios, arquivos ou terceiros.

## Sobre os dados
**Somente testes fictícios**. A versão armazena dados num cofre **local do navegador**, oferece backup, mas **não sincroniza com Firebase** ou outros aparelhos. Não use para dados clínicos reais antes de uma avaliação e implementação de segurança adequada.
