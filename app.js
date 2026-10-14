'use strict';
/* AMA FISIO — ficha de anamnese e impressão. Login por usuário e senha dentro do site; dados salvos
   automaticamente no Firebase (Firestore). Tudo é criptografado NO NAVEGADOR (AES-GCM) antes de sair do aparelho. */
const STORE_KEY='ama_fisio_novo_2026_cofre_v4', PENDING_KEY='ama_fisio_restore_pending_v1', USER_KEY='ama_fisio_last_user_v1';
const MASTER_NAME='Amanda Marinho', ITERATIONS=220000;
const FACTORY_REGISTRY={"version":3,"users":[{"id":"ama-fisio-master-local","name":"Amanda Marinho","role":"master","active":true,"salt":"ZFHDaZTY6plgbdKF4nKmoQ==","wrapped":{"iv":"U012zPtXE6YLYR3m","payload":"mlByoevOg50MwflN46/40NS90xSfEJXscrwoTgtMwvE5Gj5kUZfgqc5BhkiPkuim"},"createdAt":"2026-10-14T20:04:58.823187+00:00"}],"vault":{"iv":"FAEkHUGsIoMGtNbd","payload":"ReOSGvhR1TAUH740Lt7KnEfG8pvpdp4lhN8j7VY1kiB8gsCEI9/GYYZT7FvNBCPWhnuMlcjXQ99iCnJ7VBPrObHmN2ushlgL+35vSo8PzMVT7x+026geAKsKwXK4VX4gRUSdWweydEzRuUdOA/ST"},"factorySeed":true};
let registry=readRegistry(), data=null, secret=null, account=null, view='dashboard', search='', notifierOpen=false, notificationTab='alerts';
const $=sel=>document.querySelector(sel), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=b=>String(b||''); const now=()=>new Date();
function uid(){return crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random().toString(36).slice(2)}

/* ===== Firebase (somente Firestore, sem login do Firebase) ===== */
const FB=window.firebase, CFG=window.AMA_FIREBASE_CONFIG;
let db=null, fbError='';
try{ if(!FB||!CFG)throw Error('SDK do Firebase não carregou (verifique a internet).'); FB.initializeApp({...CFG}); db=FB.firestore() }catch(e){fbError=e.message}
const COFRE=()=>db.collection('clinica').doc('cofre');
const plain=o=>JSON.parse(JSON.stringify(o));
function cacheLocal(){try{localStorage.setItem(STORE_KEY,JSON.stringify(registry))}catch{}}
function fbMsg(err){const c=err&&err.code||'';
  if(c==='unavailable'||c==='deadline-exceeded')return 'Sem conexão com o Firebase. Verifique a internet.';
  if(c==='permission-denied')return 'O Firebase recusou o acesso. Confira se as regras (firestore.rules) foram publicadas.';
  return (err&&err.message)||'Erro desconhecido.'}
async function fetchCloud(){const s=await COFRE().get();if(!s.exists)return null;const d=s.data();
  if(d.version!==3||!Array.isArray(d.users)||!d.vault?.iv||!d.vault?.payload)throw Error('Os dados na nuvem estão em formato inesperado.');
  return {version:3,users:d.users,vault:d.vault,rev:d.rev||0}}
async function pushCloud(){
  const ref=COFRE();let newRev;
  await db.runTransaction(async tx=>{const s=await tx.get(ref);const cur=s.exists?(s.data().rev||0):0;
    if(!registry.force&&cur!==(registry.rev||0)){const e=Error('conflict');e.conflict=true;throw e}
    newRev=cur+1;
    const doc={version:3,users:plain(registry.users),vault:plain(registry.vault),rev:newRev,updatedAt:FB.firestore.FieldValue.serverTimestamp()};
    tx.set(ref,doc);
    // histórico circular das últimas 20 versões (permite recuperar se algo der errado)
    tx.set(db.collection('clinica_hist').doc('v'+(newRev%20)),doc)});
  registry.rev=newRev;delete registry.force;cacheLocal()}
async function pullCloud(){const c=await fetchCloud();if(!c)return false;const id=account?.id;registry=c;cacheLocal();
  if(secret){data=await readVault(secret);account=registry.users.find(x=>x.id===id)||account}return true}
function readRegistry(){
  try {
    const saved=localStorage.getItem(STORE_KEY);
    if(!saved){const clean=JSON.parse(JSON.stringify(FACTORY_REGISTRY));localStorage.setItem(STORE_KEY,JSON.stringify(clean));return clean}
    const r=JSON.parse(saved);
    return r?.version===3&&Array.isArray(r.users)&&r.vault?.iv&&r.vault?.payload?r:null;
  } catch{return null}
}
function today(){const d=now();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function dayString(date){return new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}
function dateShift(date,days){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function b64(bytes){return btoa(String.fromCharCode(...bytes))}
function bytes(b64string){return Uint8Array.from(atob(b64string),c=>c.charCodeAt(0))}
function random(length){const a=new Uint8Array(length);crypto.getRandomValues(a);return a}
async function aesKey(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt'])}
async function cipher(key,plaintext){const iv=random(12);const payload=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);return {iv:b64(iv),payload:b64(new Uint8Array(payload))}}
async function decipher(key,pack){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(pack.iv)},key,bytes(pack.payload)))}
async function passwordKey(pass,salt){const raw=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},raw,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function wrapped(userName,password,rawSecret,role='user',id=uid()){const salt=random(16), key=await passwordKey(password,salt);const pack=await cipher(key,rawSecret);return {id,name:userName.trim(),role,active:true,salt:b64(salt),wrapped:pack,createdAt:new Date().toISOString()}}
async function unlock(user,password){const key=await passwordKey(password,bytes(user.salt));return decipher(key,user.wrapped)}
async function readVault(rawSecret){const key=await aesKey(rawSecret), pack=registry.vault;return JSON.parse(new TextDecoder().decode(await decipher(key,pack)))}
async function saveVault(){
  if(!secret||!account)throw Error('Sessão encerrada');
  if(!db)throw Error('Firebase indisponível: '+fbError);
  const key=await aesKey(secret);const prev=registry.vault;
  registry.vault=await cipher(key,new TextEncoder().encode(JSON.stringify(data)));
  try{await pushCloud()}
  catch(err){registry.vault=prev;
    if(err.conflict){try{await pullCloud()}catch{}throw Error('Outro aparelho salvou alterações antes de você. Os dados foram atualizados — confira e salve de novo.')}
    try{await pullCloud()}catch{}
    throw Error('Não foi possível salvar na nuvem: '+fbMsg(err))}
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('open');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('open'),4400)}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function render(){if(!registry || registry.users.length===0 || !account){renderAuth();return}renderShell()}
function authBrand(){return `<div class="authart"><div><div class="brand"><img src="./assets/logo.webp" alt="Logo AMA FISIO"><div><b>AMA FISIO</b><small>CUIDAR É ACOLHER</small></div></div><img class="logohero" src="./assets/logo.webp" alt="Logo da clínica"/></div><div><p class="eyebrow">GESTÃO SIMPLES E ACOLHEDORA</p><h1>Cuidado em cada detalhe.</h1><p>Clientes e compromissos organizados, com acesso local protegido por senha.</p><p style="font-size:11px">Protótipo local • Dados protegidos no navegador • Sem sincronização na nuvem</p></div></div>`}
function renderAuth(){
  const localBad=!registry||!registry.users.length;
  const lastUser=(()=>{try{return localStorage.getItem(USER_KEY)||MASTER_NAME}catch{return MASTER_NAME}})();
  $('#app').innerHTML=`<div class="authpage">${authBrand()}<main class="authform"><section class="authbox"><p class="eyebrow">ÁREA DA EQUIPE</p><h2>Bem-vinda de volta!</h2><p class="sub">Entre com seu usuário e senha. Os dados ficam salvos na nuvem e aparecem em qualquer aparelho.</p>${fbError?`<div class="notice error"><strong>Firebase indisponível.</strong> ${esc(fbError)}</div>`:''}${localBad?'<div class="notice"><strong>Cofre local vazio.</strong> Ao entrar, os dados serão carregados da nuvem.</div>':''}<form id="authForm"><div class="field"><label>Usuário</label><input class="input" autocomplete="username" name="username" required value="${esc(lastUser)}"></div><div class="field"><label>Senha</label><input class="input" type="password" autocomplete="current-password" name="password" minlength="8" required placeholder="Digite sua senha"></div><button class="btn full" type="submit">Entrar no AMA FISIO →</button></form><div class="protect">🔒 Dados criptografados · salvos automaticamente no Firebase</div><button class="footerlink" type="button" id="restoreFromLogin">Restaurar cópia de segurança</button><p class="caption">Os dados são criptografados no seu aparelho antes de irem para a nuvem. Em uso com dados reais de pacientes, observe a LGPD.</p></section></main></div>`;
  $('#authForm').onsubmit=async e=>{
    e.preventDefault();const btn=e.submitter;btn.disabled=true;const f=formData(e.target);
    try{
      let cloud=null,offline=false;
      if(db){try{cloud=await fetchCloud()}catch(err){offline=true}}
      const local=readRegistry();const pending=(()=>{try{return localStorage.getItem(PENDING_KEY)==='1'}catch{return false}})();
      let needPush=false;
      if(pending&&local&&!offline){registry=local;registry.force=true;needPush=true}
      else if(cloud){registry=cloud}
      else if(local){registry=local;if(!offline){needPush=true;registry.rev=0}}
      else throw Error('Sem conexão com a nuvem e sem dados neste aparelho.');
      const u=registry.users.find(x=>x.name.toLowerCase()===f.username.trim().toLowerCase()&&x.active);
      if(!u)throw Error('Usuário não encontrado ou inativo.');
      const raw=await unlock(u,f.password);
      const opened=await readVault(raw);
      account=u;secret=raw;data=opened;
      if(registry.factorySeed){
        // Troca o segredo comum de fábrica por um segredo aleatório exclusivo deste cofre.
        secret=random(32);
        const idx=registry.users.indexOf(u);
        const fresh=await wrapped(MASTER_NAME,f.password,secret,'master',u.id);
        registry.users[idx]=fresh;account=fresh;delete registry.factorySeed;needPush=true;
      }
      if(needPush)await saveVault();
      try{localStorage.removeItem(PENDING_KEY);localStorage.setItem(USER_KEY,u.name)}catch{}
      cacheLocal();
      view='dashboard';toast(offline?`Bem-vinda, ${u.name}! Sem conexão: alterações não serão salvas até a internet voltar.`:`Bem-vinda, ${u.name}!`);render();
    }catch(err){account=null;secret=null;data=null;toast(err.name==='OperationError'||/^Usuário/.test(err.message)?'Não foi possível entrar: confira o usuário e a senha.':'Não foi possível entrar: '+err.message);}
    finally{btn.disabled=false}
  };
  $('#restoreFromLogin').onclick=restoreBackup;
}
function renderShell(){const routes=[['dashboard','▦','Visão geral'],['clients','♧','Anamnese'],['appointments','▣','Agendamentos'],['users','♙','Usuários'],['settings','⚙','Configurações']];const accessible=routes.filter(([route])=>route!=='users'||account.role==='master');const count=reminders().length;
$('#app').innerHTML=`<div class="layout"><aside class="side"><div class="brand"><img src="./assets/logo.webp" alt="AMA FISIO"><div><b>AMA FISIO</b><small>CUIDAR É ACOLHER</small></div></div><nav class="nav">${accessible.map(([id,ic,label])=>`<button data-view="${id}" aria-label="${esc(label)}" title="${esc(label)}" class="${id===view?'active':''}"><span class="ico">${ic}</span><span class="txt">${label}</span></button>`).join('')}</nav><div class="sidebottom"><div class="pillnote"><strong>Proteção dos cadastros</strong><p>Dados criptografados e salvos automaticamente na nuvem (Firebase).</p></div><button class="logout" id="logout">Sair do sistema</button></div></aside><main class="main"><div class="topbar"><div><p class="eyebrow">AMA FISIO • PAINEL INTERNO</p><div class="muted mini">${esc(new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'}))}</div></div><div class="topright"><span class="mini-badge">☁ Sincronizado</span><button id="bell" class="iconbtn" aria-label="Notificações">🔔 ${count?`<span class="counter">${count}</span>`:''}</button><div class="avatar" title="${esc(account.name)}">${esc(account.name.slice(0,1).toUpperCase())}</div></div></div><div id="viewArea"></div></main></div>`;
document.querySelectorAll('[data-view]').forEach(el=>el.onclick=()=>{view=el.dataset.view;search='';notifierOpen=false;renderShell()});$('#logout').onclick=()=>{account=null;secret=null;data=null;notifierOpen=false;render();toast('Sessão encerrada.')};$('#bell').onclick=()=>{notifierOpen=!notifierOpen;renderShell()};
const body=$('#viewArea'); if(view==='clients')renderClients(body);else if(view==='appointments')renderAppointments(body);else if(view==='users')renderUsers(body);else if(view==='settings')renderSettings(body);else renderDashboard(body);
if(notifierOpen)renderNotifications()}
const clientName=id=>data.clients.find(x=>x.id===id)?.name||'Cliente não encontrado';
function reminders(){const due=[];for(const appt of data.appointments){if(appt.status!=='scheduled'||appt.reminder==='none')continue;const cutoff=dateShift(appt.date,-Number(appt.reminder));if(today()<cutoff||appt.date<today())continue;const key=`${appt.id}:${appt.date}:${appt.reminder}`;if((data.readByUser[account.id]||[]).includes(key))continue;due.push({...appt,key})}return due.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))}
function todayAppointments(){return data.appointments.filter(a=>a.date===today()&&a.status!=='canceled').sort((a,b)=>a.time.localeCompare(b.time))}
function statusTag(s){return s==='canceled'?'<span class="tag cancel">Cancelado</span>':s==='completed'?'<span class="tag done">Concluído</span>':'<span class="tag">Agendado</span>'}
function renderDashboard(container){const upcoming=[...data.appointments].filter(x=>x.date>=today()&&x.status==='scheduled').sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)).slice(0,6);container.innerHTML=`<div class="headrow"><div><p class="eyebrow">VISÃO GERAL</p><h1 class="heading">Bem-vinda, ${esc(account.name.split(' ')[0])}!</h1><p class="sub">Tudo o que precisa para organizar sua rotina.</p></div><button class="btn" id="newClient">＋ Novo cliente</button></div><section class="stats"><div class="stat"><label>Clientes cadastrados</label><strong>${data.clients.length}</strong></div><div class="stat"><label>Consultas de hoje</label><strong>${todayAppointments().length}</strong></div><div class="stat"><label>Agendamentos futuros</label><strong>${data.appointments.filter(a=>a.date>=today()&&a.status==='scheduled').length}</strong></div><div class="stat"><label>Lembretes pendentes</label><strong>${reminders().length}</strong></div></section><section class="gridtwo"><div class="panel"><div class="headrow" style="margin-bottom:10px"><h3>Próximos agendamentos</h3><button class="btn ghost sm" id="openAgenda">Ver agenda</button></div>${upcoming.length?upcoming.map(a=>`<div class="item"><div><b>${esc(clientName(a.clientId))}</b><small>${dayString(a.date)} às ${esc(a.time)} · ${esc(a.kind||'Atendimento')}</small></div><div>${statusTag(a.status)} <button class="btn ghost sm" data-wa-appt="${a.id}" title="Lembrar pelo WhatsApp">💬</button></div></div>`).join(''):'<div class="empty">Nenhum agendamento futuro. Clique em “Ver agenda” para cadastrar.</div>'}</div><div class="panel"><h3>Atendimentos de hoje</h3>${todayAppointments().length?todayAppointments().map(a=>`<div class="item"><div><b>${esc(a.time)} · ${esc(clientName(a.clientId))}</b><small>${esc(a.kind||'Atendimento')}</small></div><div>${statusTag(a.status)} <button class="btn ghost sm" data-wa-appt="${a.id}" title="Lembrar pelo WhatsApp">💬</button></div></div>`).join(''):'<div class="empty">Nenhum atendimento para hoje.</div>'}<div class="notice">🔔 Os lembretes aparecem no sino apenas quando o site estiver aberto.</div></div></section><section class="panel" style="margin-top:18px"><h3>🎂 Aniversariantes do mês</h3>${birthdaysThisMonth().length?birthdaysThisMonth().map(c=>`<div class="item"><div><b>${esc(c.name)}</b><small>Dia ${esc(c.birthDate.slice(8,10))}/${esc(c.birthDate.slice(5,7))} · ${esc(ageFromBirth(c.birthDate)||'')}</small></div><button class="btn ghost sm" data-wa-bday="${c.id}">💬 Parabéns</button></div>`).join(''):'<div class="empty">Nenhum aniversariante neste mês.</div>'}</section>`;
  container.insertAdjacentHTML('afterbegin',backupAgeDays()===null||backupAgeDays()>30?`<div class="notice" id="backupNotice"><strong>💾 Lembrete de backup:</strong> ${backupAgeDays()===null?'nenhum backup foi baixado neste aparelho.':`o último backup foi há ${backupAgeDays()} dias.`} <button class="btn ghost sm" id="backupNow" style="margin-left:8px">Baixar backup agora</button></div>`:'');
  $('#backupNow')&&($('#backupNow').onclick=()=>{downloadBackup();renderShell()});
  container.querySelectorAll('[data-wa-appt]').forEach(el=>el.onclick=()=>whatsAppt(el.dataset.waAppt));
  container.querySelectorAll('[data-wa-bday]').forEach(el=>el.onclick=()=>whatsBirthday(el.dataset.waBday));
  $('#newClient').onclick=()=>clientModal();$('#openAgenda').onclick=()=>{view='appointments';renderShell()}}
function renderClients(container){
 const list=data.clients.filter(c=>([c.name,c.phone,c.cpf,c.clinical?.chiefComplaint,c.guardian].join(' ')).toLowerCase().includes(search.toLowerCase()));
 const progressTotal=data.clients.reduce((sum,c)=>sum+(c.evolutions||[]).length,0);
 container.innerHTML=`<div class="headrow"><div><p class="eyebrow">CADASTRO E ANAMNESE</p><h1 class="heading">Pacientes</h1><p class="sub">Identificação, histórico de saúde, avaliação fisioterapêutica e evolução clínica.</p></div><button class="btn" id="createClient">＋ Nova ficha</button></div><div class="notice"><strong>Privacidade:</strong> os dados são criptografados antes de irem para o Firebase e só abrem com a senha de um usuário cadastrado. Mesmo assim, o uso com prontuários reais exige atenção à LGPD, a backups e à responsabilidade profissional.</div><div class="toolbar"><input id="clientSearch" class="input search" placeholder="Buscar por nome, telefone, queixa ou CPF" value="${esc(search)}" /></div><div class="panel tablewrap">${list.length?`<table class="datatable"><thead><tr><th>Paciente</th><th>Contato</th><th>Queixa / especialidade</th><th>Avaliação</th><th>Ações</th></tr></thead><tbody>${list.map(c=>`<tr><td data-label="Paciente"><b>${esc(c.name)}</b>${c.birthDate?`<small class="muted">${dayString(c.birthDate)}${ageFromBirth(c.birthDate)?' · '+ageFromBirth(c.birthDate):''}</small>`:''}</td><td data-label="Contato">${esc(c.phone||'—')}</td><td data-label="Queixa">${esc(c.clinical?.chiefComplaint||'Não informada')}<small class="muted">${esc(c.clinical?.attendanceArea||'')}</small></td><td data-label="Avaliação">${c.clinical?.assessmentDate?dayString(c.clinical.assessmentDate):'Pendente'}<small class="muted">${(c.evolutions||[]).length} evolução(ões)</small></td><td><div class="table-actions"><button class="btn ghost sm" data-edit-client="${c.id}">Ficha</button><button class="btn ghost sm" data-evol-client="${c.id}">Evoluções</button><button class="btn ghost sm" data-agenda-client="${c.id}">Agendar</button><button class="btn print-btn sm" data-print-ficha="${c.id}" title="Imprimir ficha clínica salva">🖨 Imprimir ficha</button><button class="btn print-btn sm" data-print-evolucoes="${c.id}" title="Imprimir histórico de evoluções salvo">🖨 Imprimir evoluções</button><button class="btn danger sm" data-del-client="${c.id}" title="Excluir esta ficha">🗑 Excluir</button><button class="btn ghost sm" data-wa-client="${c.id}" title="Abrir conversa no WhatsApp">💬 WhatsApp</button></div></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Nenhuma ficha encontrada. Clique em “Nova ficha” para começar.</div>'}</div><p class="help">${list.length} ficha(s) encontradas • ${progressTotal} evolução(ões) registradas. Os campos clínicos são opcionais e devem ser preenchidos por profissional habilitado.</p>`;
 $('#createClient').onclick=()=>clientModal();$('#clientSearch').oninput=e=>{search=e.target.value;renderClients(container);$('#clientSearch').focus();$('#clientSearch').setSelectionRange(search.length,search.length)};
 document.querySelectorAll('[data-edit-client]').forEach(el=>el.onclick=()=>clientModal(el.dataset.editClient));
 document.querySelectorAll('[data-wa-client]').forEach(el=>el.onclick=()=>whatsClient(el.dataset.waClient));
 document.querySelectorAll('[data-del-client]').forEach(el=>el.onclick=()=>deleteClient(el.dataset.delClient));
 document.querySelectorAll('[data-evol-client]').forEach(el=>el.onclick=()=>evolutionModal(el.dataset.evolClient));
 document.querySelectorAll('[data-agenda-client]').forEach(el=>el.onclick=()=>appointmentModal(null,el.dataset.agendaClient));
 document.querySelectorAll('[data-print-ficha]').forEach(el=>el.onclick=()=>printPatientDocument(el.dataset.printFicha,'ficha'));
 document.querySelectorAll('[data-print-evolucoes]').forEach(el=>el.onclick=()=>printPatientDocument(el.dataset.printEvolucoes,'evolucoes'));
}
function renderAppointments(container){const sorted=[...data.appointments].sort((a,b)=>b.date.localeCompare(a.date)||a.time.localeCompare(b.time));container.innerHTML=`<div class="headrow"><div><p class="eyebrow">ORGANIZAÇÃO INTERNA</p><h1 class="heading">Agendamentos</h1><p class="sub">Agenda da clínica. O botão 💬 Lembrar abre o WhatsApp com a mensagem pronta; o envio é feito por você.</p></div><button class="btn" id="createAppointment">＋ Novo agendamento</button></div><div class="panel tablewrap">${sorted.length?`<table class="datatable"><thead><tr><th>Data e horário</th><th>Cliente</th><th>Atendimento</th><th>Lembrete</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${sorted.map(a=>`<tr><td data-label="Data">${dayString(a.date)} · ${esc(a.time)}</td><td data-label="Cliente">${esc(clientName(a.clientId))}</td><td data-label="Tipo">${esc(a.kind||'Atendimento')}</td><td data-label="Lembrete">${a.reminder==='none'?'Sem lembrete':a.reminder==='0'?'No dia':a.reminder==='1'?'1 dia antes':'2 dias antes'}</td><td data-label="Status">${statusTag(a.status)}</td><td><button class="btn ghost sm" data-edit-appt="${a.id}">Editar</button> <button class="btn ghost sm" data-wa-appt="${a.id}" title="Lembrar pelo WhatsApp">💬 Lembrar</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">A agenda está vazia. Cadastre um cliente e depois crie uma consulta.</div>'}</div>`;$('#createAppointment').onclick=()=>appointmentModal();document.querySelectorAll('[data-edit-appt]').forEach(el=>el.onclick=()=>appointmentModal(el.dataset.editAppt));document.querySelectorAll('[data-wa-appt]').forEach(el=>el.onclick=()=>whatsAppt(el.dataset.waAppt))}
function renderUsers(container){if(account.role!=='master'){view='dashboard';renderShell();return}container.innerHTML=`<div class="headrow"><div><p class="eyebrow">ACESSOS DA EQUIPE</p><h1 class="heading">Usuários</h1><p class="sub">Quem pode entrar no sistema, em qualquer aparelho.</p></div><button class="btn" id="createUser">＋ Novo usuário</button></div><div class="notice"><strong>Importante:</strong> cada pessoa entra com o próprio usuário e senha. Funcionários salvam tudo sozinhos, sem precisar de aprovação. Você cria o usuário e a senha aqui, e pode trocar a senha ou bloquear o acesso quando quiser.</div><div class="panel"><div class="tablewrap"><table class="datatable"><thead><tr><th>Nome de usuário</th><th>Permissão</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${registry.users.map(u=>`<tr><td data-label="Nome">${esc(u.name)}</td><td data-label="Permissão">${u.role==='master'?'Administradora':'Funcionário'}</td><td data-label="Situação">${u.active?'<span class="tag done">Ativo</span>':'<span class="tag cancel">Bloqueado</span>'}</td><td>${u.role==='master'?`<button class="btn ghost sm" data-pass-user="${u.id}">Trocar senha</button>`:`<button class="btn ghost sm" data-pass-user="${u.id}">Trocar senha</button> <button class="btn ${u.active?'danger':'ghost'} sm" data-toggle-user="${u.id}">${u.active?'Bloquear':'Reativar'}</button>`}</td></tr>`).join('')}</tbody></table></div></div>`;$('#createUser').onclick=()=>userModal();document.querySelectorAll('[data-pass-user]').forEach(el=>el.onclick=()=>userModal(el.dataset.passUser));document.querySelectorAll('[data-toggle-user]').forEach(el=>el.onclick=async()=>{const u=registry.users.find(x=>x.id===el.dataset.toggleUser);if(!u||u.role==='master')return;const prev=u.active;u.active=!u.active;try{await saveVault();renderShell();toast(u.active?'Acesso reativado.':'Acesso bloqueado.')}catch(err){u.active=prev;toast(err.message)}})}
function renderSettings(container){
  container.innerHTML=`<div class="headrow"><div><p class="eyebrow">PREFERÊNCIAS</p><h1 class="heading">Configurações</h1><p class="sub">Sincronização com o Firebase e cópia de segurança.</p></div></div><div class="gridtwo"><section class="panel"><h3>Proteção e cópia de segurança</h3><p class="help">Os dados ficam na nuvem (criptografados). Mesmo assim, baixe uma cópia de segurança de vez em quando e guarde em local seguro.</p><div class="stack"><button class="btn" id="downloadBackup">↓ Baixar backup criptografado</button><button class="btn ghost" id="restoreBackup">↑ Restaurar backup</button><button class="btn ghost" id="lockSession">Sair e bloquear o cofre</button></div></section><section class="panel"><h3>Firebase — sincronização</h3><div class="notice"><strong>Salvamento automático.</strong> Projeto <code>${esc(CFG?.projectId||'?')}</code> · versão ${registry.rev||0}. Cada alteração é salva na nuvem na hora, sem aprovação, e os outros aparelhos recebem a atualização em cerca de 45 segundos.</div><div class="stack"><button class="btn ghost" id="syncNow">↻ Sincronizar agora</button></div><p class="help">Se dois aparelhos salvarem exatamente ao mesmo tempo, o segundo recebe um aviso e basta salvar de novo.</p></section></div>`;
  $('#downloadBackup').onclick=downloadBackup;$('#restoreBackup').onclick=restoreBackup;
  $('#lockSession').onclick=()=>{account=null;secret=null;data=null;render()};
  $('#syncNow').onclick=async()=>{try{await syncFromCloud(true)}catch(err){toast('Falha ao sincronizar: '+fbMsg(err))}};
}
function renderNotifications(){const alerts=reminders(), todays=todayAppointments();const holder=document.createElement('section');holder.className='nots';holder.id='notifBox';holder.innerHTML=`<div class="headrow" style="margin:0"><h3>🔔 Notificações</h3><button class="btn ghost sm" id="closeNotifications">Fechar</button></div><div class="tabs"><button data-tab="alerts" class="${notificationTab==='alerts'?'active':''}">Lembretes (${alerts.length})</button><button data-tab="today" class="${notificationTab==='today'?'active':''}">Hoje (${todays.length})</button></div>${notificationTab==='alerts'?(alerts.length?alerts.map(a=>`<div class="item"><div><b>${esc(clientName(a.clientId))}</b><small>${dayString(a.date)} • ${esc(a.time)} · lembrete ${a.reminder==='0'?'no dia':a.reminder+' dia(s) antes'}</small></div><button class="btn ghost sm" data-read="${esc(a.key)}">Lido</button></div>`).join(''):'<div class="empty">Nenhum lembrete pendente.</div>'):(todays.length?todays.map(a=>`<div class="item"><div><b>${esc(a.time)} · ${esc(clientName(a.clientId))}</b><small>${esc(a.kind||'Atendimento')}</small></div>${statusTag(a.status)}</div>`).join(''):'<div class="empty">Sem consultas para hoje.</div>')}<p class="help">Os avisos só aparecem quando o site estiver aberto.</p>`;$('.main').append(holder);$('#closeNotifications').onclick=()=>{notifierOpen=false;renderShell()};document.querySelectorAll('[data-tab]').forEach(el=>el.onclick=()=>{notificationTab=el.dataset.tab;renderShell()});document.querySelectorAll('[data-read]').forEach(el=>el.onclick=async()=>{data.readByUser[account.id] ||= [];data.readByUser[account.id].push(el.dataset.read);await saveVault();renderShell()})}
function openModal(title,body,onSubmit){const modal=$('#modal');modal.innerHTML=`<button class="close" title="Fechar" aria-label="Fechar">×</button><h2>${esc(title)}</h2><form id="modalForm">${body}<div class="actions"><button type="button" class="btn ghost" id="cancelModal">Cancelar</button><button type="submit" class="btn">Salvar</button></div></form>`;modal.showModal();modal.querySelector('.close').onclick=()=>modal.close();$('#cancelModal').onclick=()=>modal.close();$('#modalForm').onsubmit=async e=>{e.preventDefault();const button=modal.querySelector('[type=submit]');button.disabled=true;try{await onSubmit(formData(e.target),e.target);await saveVault();modal.close();renderShell()}catch(err){toast(err.message)}finally{button.disabled=false}}}
/* Campos de anamnese: modelo-base fisioterapêutico, a ser validado conforme especialidade.
 * O áudio fornecido ainda não tem transcrição verificada; nenhuma exigência específica foi atribuída a ele. */
const ANAMNESE_SECTIONS=[
 {title:'Queixa e história atual',subtitle:'Motivo da consulta e relato principal',open:true,fields:[
  ['attendanceArea','Especialidade / área de atendimento','select',['','Fisioterapia respiratória','Fisioterapia pediátrica','Fisioterapia musculoesquelética','Fisioterapia neurofuncional','Fisioterapia pélvica','Fisioterapia geriátrica','Outra']],
  ['assessmentDate','Data da avaliação inicial','date'],['chiefComplaint','Queixa principal','textarea'],
  ['presentIllness','História da queixa atual / início e evolução','textarea'],
  ['onsetDate','Início dos sintomas','date'],['painScore','Intensidade da dor (0 a 10)','number','0','10'],
  ['painSite','Localização e características da dor','text'],['aggravating','O que piora os sintomas?','textarea'],
  ['relieving','O que melhora os sintomas?','textarea'],['functionalLimitations','Limitações nas atividades diárias','textarea'],
  ['patientGoals','Objetivos e expectativas do paciente/família','textarea'],
 ]},
 {title:'Histórico de saúde',subtitle:'Antecedentes, tratamentos e sinais de alerta',fields:[
  ['medicalDiagnosis','Diagnóstico médico informado / hipótese de encaminhamento','text'],
  ['referringProfessional','Profissional que encaminhou','text'],
  ['previousConditions','Doenças e comorbidades','checks',['Hipertensão','Diabetes','Asma','Bronquite','DPOC','Cardiopatias','Condição neurológica','Outra']],
  ['otherConditions','Outras condições relevantes','textarea'],
  ['surgeryHistory','Cirurgias e internações anteriores','textarea'],
  ['traumaHistory','Traumas, quedas, fraturas ou lesões','textarea'],
  ['medications','Medicamentos em uso','textarea'],
  ['allergies','Alergias / reações adversas','textarea'],
  ['previousTherapies','Tratamentos fisioterapêuticos anteriores','textarea'],
  ['exams','Exames e laudos apresentados (descrição)','textarea'],
  ['familyHistory','Histórico familiar relevante','textarea'],
  ['habits','Sono, atividade física e hábitos relevantes','textarea'],
  ['redFlags','Sinais de alerta e necessidade de encaminhamento','textarea'],
 ]},
 {title:'Crianças e desenvolvimento (se aplicável)',subtitle:'Preencher apenas quando pertinente ao paciente',fields:[
  ['gestationalAge','Idade gestacional ao nascimento','text'],
  ['delivery','Tipo de parto / intercorrências gestacionais','textarea'],
  ['neonatal','UTI neonatal / intercorrências neonatais','textarea'],
  ['development','Marcos do desenvolvimento motor','textarea'],
  ['feeding','Alimentação / sucção / deglutição','textarea'],
  ['childRespHistory','Histórico respiratório infantil / infecções de repetição','textarea'],
  ['childRoutine','Rotina, escola, sono e atividades','textarea'],
  ['vaccines','Vacinação (informação relatada, quando relevante)','textarea'],
 ]},
 {title:'Avaliação respiratória (se aplicável)',subtitle:'Para atendimentos respiratórios e situações pertinentes',fields:[
  ['respSymptoms','Sintomas respiratórios (tosse, dispneia, chiado...)','textarea'],
  ['respRate','Frequência respiratória (irpm)','number','0','120'],
  ['oxygenSaturation','SpO₂ (%)','number','0','100'],
  ['respPattern','Padrão respiratório / uso de musculatura acessória','textarea'],
  ['respAuscultation','Ausculta pulmonar','textarea'],
  ['coughSecretions','Tosse, secreções e características','textarea'],
  ['oxygenSupport','Oxigenoterapia / suporte ventilatório, se houver','textarea'],
  ['respNotes','Outras observações respiratórias','textarea'],
 ]},
 {title:'Exame físico e funcional',subtitle:'Medidas e achados observados pelo profissional',fields:[
  ['bloodPressure','Pressão arterial','text'],['heartRate','Frequência cardíaca (bpm)','number','0','250'],
  ['weight','Peso (kg)','number','0','500'],['height','Altura (cm)','number','0','250'],
  ['posture','Postura / inspeção / palpação','textarea'],
  ['rangeOfMotion','Amplitude de movimento (ADM)','textarea'],
  ['strength','Força muscular','textarea'],
  ['gaitBalance','Marcha, equilíbrio e transferências','textarea'],
  ['neurological','Sensibilidade / reflexos / avaliação neurológica','textarea'],
  ['functionalTests','Testes funcionais e escalas utilizadas','textarea'],
  ['otherPhysical','Outros achados do exame físico','textarea'],
 ]},
 {title:'Impressão fisioterapêutica e plano',subtitle:'Registro do raciocínio e da conduta profissional',fields:[
  ['physioAssessment','Impressão / diagnóstico fisioterapêutico','textarea'],
  ['treatmentGoals','Objetivos terapêuticos','textarea'],
  ['treatmentPlan','Plano terapêutico / condutas propostas','textarea'],
  ['frequency','Frequência e previsão de sessões','text'],
  ['referrals','Encaminhamentos e orientações','textarea'],
  ['professional','Nome do profissional responsável','text'],
  ['registration','Registro profissional (CREFITO), se aplicável','text'],
  ['clinicalNotes','Observações clínicas adicionais','textarea'],
 ]}
];
function patientField(spec, clinical){
 const [key,label,type,arg,arg2]=spec;const value=clinical?.[key]??'';const id='cl_'+key;
 if(type==='textarea')return `<div class="field wide"><label for="${id}">${esc(label)}</label><textarea class="input" id="${id}" name="cl_${key}" rows="3" maxlength="4500">${esc(value)}</textarea></div>`;
 if(type==='checks')return `<div class="field wide"><label>${esc(label)}</label><div class="check-grid">${arg.map(item=>`<label class="check-pill"><input type="checkbox" name="cl_${key}" value="${esc(item)}" ${(Array.isArray(value)&&value.includes(item))?'checked':''}> ${esc(item)}</label>`).join('')}</div></div>`;
 if(type==='select')return `<div class="field"><label for="${id}">${esc(label)}</label><select class="input" name="cl_${key}" id="${id}">${arg.map(opt=>`<option value="${esc(opt)}" ${value===opt?'selected':''}>${esc(opt||'Selecione (opcional)')}</option>`).join('')}</select></div>`;
 let attrs='';if(type==='number')attrs=`min="${esc(arg)}" max="${esc(arg2)}" step="any"`;
 return `<div class="field"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" name="cl_${key}" type="${type}" ${attrs} value="${esc(value)}" maxlength="220"></div>`;
}
function clientModal(id){
 const c=data.clients.find(x=>x.id===id)||{};
 const sections=ANAMNESE_SECTIONS.map((section,idx)=>`<details class="clinical-section" ${section.open?'open':''}><summary><div><strong><span class="section-number">${String(idx+2).padStart(2,'0')}</span> ${esc(section.title)}</strong><small>${esc(section.subtitle)}</small></div><span class="section-caret">⌄</span></summary><div class="clinical-fields formgrid">${section.fields.map(f=>patientField(f,c.clinical||{})).join('')}</div></details>`).join('');
 const html=`${id?`<div class="modal-print-bar"><button class="btn print-btn sm" type="button" id="printClinicalFromModal">🖨 Imprimir ficha salva</button><span class="help">Para imprimir mudanças, salve primeiro.</span></div>`:''}<div class="notice">Ficha fisioterapêutica estruturada. <strong>Os campos clínicos são opcionais</strong>; preencha apenas o que se aplicar ao atendimento. O registro deve ser revisto por profissional habilitado.</div><details class="clinical-section" open><summary><div><strong><span class="section-number">01</span> Identificação e responsáveis</strong><small>Dados cadastrais e contato</small></div><span class="section-caret">⌄</span></summary><div class="clinical-fields formgrid">
 <div class="field wide"><label>Nome completo *</label><input class="input" name="name" maxlength="130" required value="${esc(c.name||'')}"></div>
 <div class="field"><label>Data de nascimento <small id="ageLive" class="muted">${esc(ageFromBirth(c.birthDate)?'· '+ageFromBirth(c.birthDate):'')}</small></label><input class="input" name="birthDate" type="date" value="${esc(c.birthDate||'')}"></div>
 <div class="field"><label>Sexo / gênero (opcional)</label><select class="input" name="gender">${['','Feminino','Masculino','Outro','Prefere não informar'].map(opt=>`<option value="${esc(opt)}" ${c.gender===opt?'selected':''}>${esc(opt||'Não informado')}</option>`).join('')}</select></div>
 <div class="field"><label>Telefone</label><input class="input" name="phone" type="tel" maxlength="30" value="${esc(c.phone||'')}"></div>
 <div class="field"><label>CPF (opcional)</label><input class="input" name="cpf" inputmode="numeric" maxlength="14" value="${esc(c.cpf||'')}"></div>
 <div class="field"><label>Profissão / ocupação</label><input class="input" name="occupation" maxlength="120" value="${esc(c.occupation||'')}"></div>
 <div class="field"><label>E-mail (opcional)</label><input class="input" name="email" type="email" maxlength="160" value="${esc(c.email||'')}"></div>
 <div class="field wide"><label>Endereço</label><input class="input" name="address" maxlength="220" value="${esc(c.address||'')}"></div>
 <div class="field"><label>Responsável legal (para menor/dependente)</label><input class="input" name="guardian" maxlength="130" value="${esc(c.guardian||'')}"></div>
 <div class="field"><label>Parentesco / vínculo do responsável</label><input class="input" name="guardianRelation" maxlength="90" value="${esc(c.guardianRelation||'')}"></div>
 <div class="field"><label>Telefone do responsável</label><input class="input" name="guardianPhone" type="tel" maxlength="30" value="${esc(c.guardianPhone||'')}"></div>
 <div class="field"><label>Contato de emergência</label><input class="input" name="emergencyContact" maxlength="140" value="${esc(c.emergencyContact||'')}"></div>
 <div class="field"><label>Telefone de emergência</label><input class="input" name="emergencyPhone" maxlength="30" value="${esc(c.emergencyPhone||'')}"></div>
 <div class="field"><label>Origem do contato</label><input class="input" name="source" maxlength="120" value="${esc(c.source||'')}"></div>
 <div class="field wide"><label>Observações administrativas (não clínicas)</label><textarea class="input" name="notes" maxlength="800" rows="2">${esc(c.notes||'')}</textarea></div>
 </div></details>${sections}`;
 let draft=null;
 openModal(id?'Editar ficha de anamnese':'Nova ficha de anamnese',html,(form,formElement)=>{
   const name=form.name.trim();if(!name)throw Error('Informe o nome completo do paciente.');
   const clinical={...(c.clinical||{})};
   for(const section of ANAMNESE_SECTIONS)for(const [key,,type] of section.fields){
      clinical[key]=type==='checks'?new FormData(formElement).getAll('cl_'+key):String(form['cl_'+key]||'').trim();
   }
   const allowed=['name','birthDate','gender','phone','cpf','occupation','email','address','guardian','guardianRelation','guardianPhone','emergencyContact','emergencyPhone','source','notes'];
   const updates=Object.fromEntries(allowed.map(key=>[key,String(form[key]||'').trim()]));
   if(id){Object.assign(c,updates,{clinical,updatedAt:new Date().toISOString()});}else data.clients.push({id:uid(),createdAt:new Date().toISOString(),evolutions:[],...updates,clinical});
   draft&&draft.clear();toast('Ficha de anamnese salva.');
 });
 setupDraft('ficha_'+(id||'nova')).then(d=>draft=d);
 const bd=document.querySelector('#modalForm [name=birthDate]');if(bd)bd.addEventListener('input',()=>{const a=ageFromBirth(bd.value);$('#ageLive').textContent=a?'· '+a:''});
 if(id){const btn=$('#printClinicalFromModal'); if(btn)btn.onclick=()=>printPatientDocument(id,'ficha');}
}
function evolutionModal(id){
 const c=data.clients.find(x=>x.id===id);if(!c)return;
 const entries=[...(c.evolutions||[])].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
 const cards=entries.length?entries.map(e=>`<article class="evolution-card"><div class="evolution-heading"><b>${dayString(e.date)} · ${esc(e.professional||'Profissional não informado')}</b><small>${esc(e.createdAt?new Date(e.createdAt).toLocaleString('pt-BR'):'')}</small></div><button class="btn print-btn sm" type="button" data-print-evolution-id="${esc(e.id)}">🖨 Imprimir esta evolução</button><p><b>Relato / avaliação:</b> ${esc(e.report||'—')}</p><p><b>Condutas:</b> ${esc(e.intervention||'—')}</p><p><b>Resposta e orientações:</b> ${esc(e.outcome||'—')}</p></article>`).join(''):'<p class="help">Ainda não há evoluções registradas para este paciente.</p>';
 const body=`<p class="sub"><strong>${esc(c.name)}</strong> · Evoluções e atendimentos.</p>${entries.length?'<div class="modal-print-bar"><button class="btn print-btn sm" type="button" id="printAllEvolutions">🖨 Imprimir histórico completo</button></div>':''}<details class="clinical-section" open><summary><div><strong>Registrar nova evolução</strong><small>Registro datado e identificado por profissional</small></div><span>⌄</span></summary><div class="clinical-fields formgrid"><div class="field"><label>Data *</label><input class="input" type="date" name="date" required value="${today()}"></div><div class="field"><label>Profissional responsável</label><input class="input" name="professional" value="${esc(c.clinical?.professional||'')}" maxlength="140"></div><div class="field wide"><label>Relato, achados e reavaliação *</label><textarea class="input" name="report" maxlength="4500" required rows="3"></textarea></div><div class="field wide"><label>Condutas realizadas</label><textarea class="input" name="intervention" maxlength="4500" rows="3"></textarea></div><div class="field wide"><label>Resposta, recomendações e próximos passos</label><textarea class="input" name="outcome" maxlength="4500" rows="3"></textarea></div><div class="field"><label>Próxima sessão (opcional)</label><input class="input" type="date" name="nextDate"></div><div class="field"><label>Horário da próxima sessão</label><input class="input" type="time" name="nextTime" value="09:00"></div><p class="help wide" style="grid-column:1/-1;margin:0">Se informar a data, a próxima sessão já entra na agenda automaticamente.</p></div></details><h3>Histórico de evoluções (${entries.length})</h3><div class="evolution-list">${cards}</div>`;
 let draft=null;
 openModal('Evolução fisioterapêutica',body,f=>{
   if(!f.date||!f.report.trim())throw Error('Informe a data e o relato da evolução.');
   c.evolutions ||= [];
   c.evolutions.push({id:uid(),date:f.date,professional:f.professional.trim(),report:f.report.trim(),intervention:f.intervention.trim(),outcome:f.outcome.trim(),createdAt:new Date().toISOString()});
   if(f.nextDate){const t=f.nextTime||'09:00';confirmConflict(f.nextDate,t,50);data.appointments.push({id:uid(),createdAt:new Date().toISOString(),clientId:c.id,date:f.nextDate,time:t,kind:'Fisioterapia',reminder:'1',status:'scheduled',duration:50})}
   c.updatedAt=new Date().toISOString();draft&&draft.clear();toast(f.nextDate?'Evolução salva e próxima sessão agendada.':'Evolução salva no histórico.');
 });
 setupDraft('evol_'+id).then(d=>draft=d);
 const allButton=$('#printAllEvolutions'); if(allButton) allButton.onclick=()=>printPatientDocument(id,'evolucoes');
 document.querySelectorAll('[data-print-evolution-id]').forEach(btn=>btn.onclick=()=>printPatientDocument(id,'evolucoes',btn.dataset.printEvolutionId));
}
/* Impressão A4: utiliza apenas os dados já salvos em memória; não envia informações a servidores externos. */
function ageFromBirth(date){
 if(!date)return '';
 const born=new Date(`${date}T12:00:00`);
 if(Number.isNaN(born.getTime())||born>new Date())return '';
 const nowDate=new Date();let age=nowDate.getFullYear()-born.getFullYear();
 if(nowDate.getMonth()<born.getMonth()||(nowDate.getMonth()===born.getMonth()&&nowDate.getDate()<born.getDate()))age--;
 if(age<2){let m=(nowDate.getFullYear()-born.getFullYear())*12+nowDate.getMonth()-born.getMonth();if(nowDate.getDate()<born.getDate())m--;if(m<24)return m<=0?'recém-nascido':`${m} ${m===1?'mês':'meses'}`}
 return age>=0&&age<125?`${age} ano${age===1?'':'s'}`:'';
}
function printField(label,value,wide=false){
 const v=Array.isArray(value)?value.filter(Boolean).join(', '):String(value??'').trim();
 if(!v)return '';
 return `<div class="pf ${wide?'wide':''}"><dt>${esc(label)}</dt><dd>${esc(v)}</dd></div>`;
}
function printSection(title, fields){
 const content=fields.filter(Boolean).join('');
 return content?`<section class="paper-section"><h2>${esc(title)}</h2><dl class="paper-grid">${content}</dl></section>`:'';
}
function printPatientDocument(clientId,kind,evolutionId){
 const patient=data?.clients.find(c=>c.id===clientId);
 if(!patient)return toast('Paciente não encontrado.');
 const isClinical=kind==='ficha';
 const evolutions=(patient.evolutions||[]).filter(e=>!evolutionId||e.id===evolutionId)
    .sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.createdAt||'').localeCompare(b.createdAt||''));
 if(!isClinical&&!evolutions.length)return toast('Este paciente ainda não tem evoluções salvas para imprimir.');
 const clinical=patient.clinical||{};
 const description=isClinical?'FICHA DE ANAMNESE FISIOTERAPÊUTICA':evolutionId?'REGISTRO DE EVOLUÇÃO FISIOTERAPÊUTICA':'HISTÓRICO DE EVOLUÇÕES FISIOTERAPÊUTICAS';
 const identity=printSection('Identificação do paciente',[
    printField('Nome completo',patient.name,true),
    printField('Data de nascimento',patient.birthDate?dayString(patient.birthDate):''),
    printField('Idade',ageFromBirth(patient.birthDate)),
    printField('Sexo / gênero',patient.gender),printField('CPF',patient.cpf),
    printField('Telefone',patient.phone),printField('Profissão / ocupação',patient.occupation),
    printField('E-mail',patient.email),printField('Endereço',patient.address,true),
    printField('Responsável legal',patient.guardian),printField('Parentesco',patient.guardianRelation),
    printField('Telefone do responsável',patient.guardianPhone),
    printField('Contato de emergência',patient.emergencyContact),
    printField('Telefone de emergência',patient.emergencyPhone),
    ...(isClinical?[printField('Origem do contato',patient.source),printField('Observações administrativas',patient.notes,true)]:[])
 ]);
 let content=identity;
 if(isClinical){
   const clinicalSections=ANAMNESE_SECTIONS.map(section=>printSection(section.title,section.fields.map(([key,label])=>printField(label,clinical[key],true)))).filter(Boolean);
   content+=clinicalSections.length?clinicalSections.join(''):'<p class="paper-note">Os campos da avaliação clínica ainda não foram preenchidos nesta ficha.</p>';
   content+=`<section class="sign-block"><div class="signature-line"></div><p>Assinatura e carimbo do(a) fisioterapeuta${clinical.registration?' · CREFITO: '+esc(clinical.registration):''}</p></section>`;
 }else{
   content+=`<p class="paper-count">${evolutions.length} registro(s) de evolução nesta impressão.</p>`;
   content+=evolutions.map((entry,index)=>`<section class="evo-paper"><h2>Evolução ${evolutions.length===1?'':String(index+1).padStart(2,'0')}</h2><dl class="paper-grid">${printField('Data do atendimento',entry.date?dayString(entry.date):'')}${printField('Profissional responsável',entry.professional)}</dl><dl class="paper-grid">${printField('Relato, achados e reavaliação',entry.report,true)}${printField('Condutas realizadas',entry.intervention,true)}${printField('Resposta, orientações e próximos passos',entry.outcome,true)}</dl><div class="sign-block"><div class="signature-line"></div><p>Assinatura e carimbo do(a) profissional${clinical.registration?' · CREFITO: '+esc(clinical.registration):''}</p></div></section>`).join('');
 }
 const logo=new URL('./assets/logo.webp',window.location.href).href;
 const printedAt=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>AMA FISIO — ${esc(description)} — ${esc(patient.name)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
 @page{size:A4 portrait;margin:14mm 14mm 17mm}
 *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.45;color:#26362b;margin:0;background:#fff}
 .sheet{max-width:190mm;margin:auto}.paper-head{display:flex;align-items:center;gap:13px;border-bottom:2px solid #617151;padding-bottom:13px;margin-bottom:17px}
 .paper-head img{width:66px;height:66px;object-fit:contain;border-radius:50%}.paper-head h1{font-size:19pt;letter-spacing:-.5px;margin:0;color:#33482d}
 .paper-head p{margin:3px 0;font-size:9pt;color:#67735c}.doc-title{margin:0 0 8px;color:#485e3f;font-size:13pt;font-weight:700;letter-spacing:.2px}
 .print-meta{display:flex;flex-wrap:wrap;gap:8px 24px;font-size:8.5pt;color:#5c6d58;margin-bottom:16px}
 .paper-section{margin:0 0 17px;break-inside:auto}.paper-section h2,.evo-paper h2{color:#405339;font-size:11.5pt;margin:0 0 9px;border-bottom:1px solid #cfd9ca;padding-bottom:5px}
 dl.paper-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin:0;padding:0}
 .pf{margin:0;min-width:0;break-inside:avoid-page}.pf.wide{grid-column:1/-1}dt{font-size:8.4pt;color:#64735d;font-weight:700;margin:0 0 2px}
 dd{margin:0;font-size:10.2pt;color:#1f2c22;white-space:pre-wrap;overflow-wrap:anywhere}
 .paper-note{color:#666;font-style:italic}.paper-count{font-size:9pt;color:#5a6756;margin:0 0 16px}
 .evo-paper{margin:0 0 19px;padding:0 0 14px;border-bottom:1px solid #d5ddd1;break-inside:auto}.evo-paper>.pf{margin:12px 0}
 .sign-block{margin:35px 0 8px;break-inside:avoid}.signature-line{border-bottom:1px solid #555;width:min(95%,100mm);margin:0 auto 7px}
 .sign-block p{text-align:center;font-size:8.5pt;color:#687266;margin:0}.paper-foot{border-top:1px solid #dfe5dc;color:#768270;font-size:7.5pt;padding-top:7px;margin-top:24px}
 @media screen{body{background:#f1f3ee;padding:20px}.sheet{background:#fff;padding:15mm;box-shadow:0 5px 30px #33442f26}.print-help{background:#e6ecdf;padding:12px 16px;margin:0 auto 20px;max-width:190mm;font-size:10pt}}
 @media print{.print-help{display:none}.sheet{padding:0;box-shadow:none;max-width:none}body{background:#fff}}
 </style></head><body><div class="print-help">Prévia para impressão. Se a janela de impressão não abrir automaticamente, use Ctrl+P (computador) ou Compartilhar → Imprimir (celular).</div><main class="sheet"><header class="paper-head"><img src="${esc(logo)}" alt="Logo AMA FISIO"><div><h1>AMA FISIO</h1><p>Cuidar é acolher · Registro clínico</p></div></header><h2 class="doc-title">${esc(description)}</h2><div class="print-meta"><span>Paciente: <b>${esc(patient.name)}</b></span><span>Emitido em: ${esc(printedAt)}</span></div>${content}<footer class="paper-foot">Documento impresso com informações salvas na ficha AMA FISIO. Confira os registros antes de assinar e arquivar.</footer></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));<\/script></body></html>`;
 const printWindow=window.open('','_blank');
 if(!printWindow){toast('A janela de impressão foi bloqueada. Permita pop-ups para este site e tente novamente.');return}
 printWindow.document.open();printWindow.document.write(html);printWindow.document.close();
}


/* ===== WhatsApp (abre a conversa com a mensagem pronta; o envio é feito pela pessoa) ===== */
function waNumber(c){const raw=String(c.phone||c.guardianPhone||'').replace(/\D/g,'');if(raw.length<10)return '';return raw.length<=11?'55'+raw:raw}
function openWhats(c,message){const n=waNumber(c);if(!n){toast('Este paciente não tem telefone válido cadastrado.');return}window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`,'_blank','noopener')}
function firstName(n){return String(n||'').trim().split(/\s+/)[0]||''}
function apptMessage(c,a){const d=new Date(a.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'});
  return `Olá, ${firstName(c.name)}! Passando para lembrar da sua sessão na AMA FISIO: ${d}, às ${a.time}. Qualquer imprevisto, é só nos avisar. 💚`}
function nextAppt(id){return data.appointments.filter(a=>a.clientId===id&&a.status==='scheduled'&&a.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))[0]}
function whatsClient(id){const c=data.clients.find(x=>x.id===id);if(!c)return;const a=nextAppt(id);openWhats(c,a?apptMessage(c,a):`Olá, ${firstName(c.name)}! Aqui é da AMA FISIO. Tudo bem? 💚`)}
function whatsAppt(id){const a=data.appointments.find(x=>x.id===id);const c=a&&data.clients.find(x=>x.id===a.clientId);if(!c)return;openWhats(c,apptMessage(c,a))}
function whatsBirthday(id){const c=data.clients.find(x=>x.id===id);if(c)openWhats(c,`Parabéns, ${firstName(c.name)}! 🎉 A equipe da AMA FISIO deseja um dia muito especial e muita saúde! 💚`)}
function birthdaysThisMonth(){const m=new Date().getMonth()+1;return data.clients.filter(c=>c.birthDate&&Number(c.birthDate.slice(5,7))===m).sort((a,b)=>a.birthDate.slice(8,10).localeCompare(b.birthDate.slice(8,10)))}

/* ===== Conflito de horário ===== */
const toMin=t=>{const [h,m]=String(t||'0:0').split(':');return Number(h)*60+Number(m)};
function findConflict(date,time,duration,ignoreId){const s0=toMin(time),e0=s0+(Number(duration)||50);
  return data.appointments.find(a=>a.id!==ignoreId&&a.date===date&&a.status==='scheduled'&&toMin(a.time)<e0&&s0<toMin(a.time)+(Number(a.duration)||50))}
function confirmConflict(date,time,duration,ignoreId){const x=findConflict(date,time,duration,ignoreId);
  if(x&&!confirm(`Atenção: já existe um agendamento neste horário (${clientName(x.clientId)}, ${x.time}).\n\nAgendar mesmo assim?`))throw Error('Agendamento não salvo: horário já ocupado.')}

/* ===== Rascunho automático (criptografado) ===== */
async function setupDraft(key){
  const form=$('#modalForm');const k='ama_draft_'+account.id+'_'+key;const kk=()=>aesKey(secret);
  try{const raw=localStorage.getItem(k);
    if(raw){if(confirm('Encontramos um rascunho não salvo desta tela. Deseja recuperá-lo?')){
      const obj=JSON.parse(new TextDecoder().decode(await decipher(await kk(),JSON.parse(raw))));
      for(const el of form.elements){if(!el.name||el.type==='password'||!(el.name in obj))continue;
        if(el.type==='checkbox')el.checked=obj[el.name].includes(el.value);else if(el.type==='radio')el.checked=obj[el.name][0]===el.value;else el.value=obj[el.name][0]}
    }else localStorage.removeItem(k)}}catch{}
  let t;const save=()=>{clearTimeout(t);t=setTimeout(async()=>{try{const obj={};for(const [n,v] of new FormData(form).entries())(obj[n]||=[]).push(String(v));
    localStorage.setItem(k,JSON.stringify(await cipher(await kk(),new TextEncoder().encode(JSON.stringify(obj)))))}catch{}},700)};
  form.addEventListener('input',save);form.addEventListener('change',save);
  const clear=()=>{clearTimeout(t);try{localStorage.removeItem(k)}catch{}};
  $('#cancelModal')?.addEventListener('click',clear);$('#modal .close')?.addEventListener('click',clear);
  return {clear}}

/* ===== Lembrete de backup ===== */
function backupAgeDays(){try{const d=localStorage.getItem('ama_last_backup');if(!d)return null;return Math.floor((Date.now()-new Date(d).getTime())/86400000)}catch{return null}}
async function deleteClient(id){
  const c=data.clients.find(x=>x.id===id);if(!c)return;
  const nAg=data.appointments.filter(a=>a.clientId===id).length, nEv=(c.evolutions||[]).length;
  if(!confirm(`Excluir a ficha de "${c.name}"?\n\nSerão apagados também ${nEv} evolução(ões) e ${nAg} agendamento(s) deste paciente.\nEsta ação não pode ser desfeita.`))return;
  const prevC=data.clients,prevA=data.appointments;
  data.clients=prevC.filter(x=>x.id!==id);data.appointments=prevA.filter(a=>a.clientId!==id);
  try{await saveVault();renderShell();toast('Ficha excluída.')}
  catch(err){data.clients=prevC;data.appointments=prevA;renderShell();toast(err.message)}
}
const normName=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function clientMatches(query){
  const q=normName(query);if(!q)return [];
  return data.clients.filter(c=>normName(c.name).split(/\s+/).some(w=>w.startsWith(q))||normName(c.name).startsWith(q))
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR',{sensitivity:'base'})).slice(0,8)}
function setupClientPicker(){
  const input=$('#clientSearchBox'),hidden=$('#clientIdHidden'),list=$('#clientResults');if(!input)return;
  const show=()=>{
    const m=clientMatches(input.value);
    if(!input.value.trim()){list.innerHTML='';list.hidden=true;return}
    list.hidden=false;
    list.innerHTML=m.length?m.map(c=>`<button type="button" class="pick-item" data-pick="${c.id}">${esc(c.name)}</button>`).join(''):'<div class="pick-empty">Nenhum paciente encontrado com esse nome.</div>';
    list.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{const c=data.clients.find(x=>x.id===b.dataset.pick);hidden.value=c.id;input.value=c.name;list.hidden=true;list.innerHTML='';input.classList.add('picked')});
  };
  input.addEventListener('input',()=>{hidden.value='';input.classList.remove('picked');show()});
}
function appointmentModal(id,clientId){if(!data.clients.length){toast('Cadastre pelo menos um cliente antes de agendar.');return}const a=data.appointments.find(x=>x.id===id)||{};const preId=a.clientId||clientId||'';const preClient=data.clients.find(c=>c.id===preId);openModal(id?'Editar agendamento':'Novo agendamento',`<div class="formgrid"><div class="field wide pickwrap"><label>Cliente * <small class="muted">(digite as primeiras letras do nome)</small></label><input class="input${preClient?' picked':''}" id="clientSearchBox" autocomplete="off" placeholder="Digite o nome do paciente..." value="${esc(preClient?.name||'')}"><input type="hidden" name="clientId" id="clientIdHidden" value="${esc(preClient?.id||'')}"><div id="clientResults" class="pick-list" hidden></div></div><div class="field"><label>Data *</label><input class="input" name="date" type="date" required value="${esc(a.date||today())}"></div><div class="field"><label>Horário *</label><input class="input" name="time" type="time" required value="${esc(a.time||'09:00')}"></div><div class="field"><label>Tipo de atendimento</label><input class="input" name="kind" maxlength="100" value="${esc(a.kind||'Fisioterapia')}"></div><div class="field"><label>Lembrete no sino 🔔</label><select class="input" name="reminder"><option value="none" ${a.reminder==='none'?'selected':''}>Não lembrar</option><option value="0" ${a.reminder==='0'?'selected':''}>No dia</option><option value="1" ${a.reminder===undefined||a.reminder==='1'?'selected':''}>1 dia antes</option><option value="2" ${a.reminder==='2'?'selected':''}>2 dias antes</option></select></div><div class="field"><label>Situação</label><select class="input" name="status"><option value="scheduled" ${a.status===undefined||a.status==='scheduled'?'selected':''}>Agendado</option><option value="completed" ${a.status==='completed'?'selected':''}>Concluído</option><option value="canceled" ${a.status==='canceled'?'selected':''}>Cancelado</option></select></div><div class="field"><label>Duração em minutos</label><input class="input" name="duration" type="number" min="10" max="240" value="${esc(a.duration||50)}"></div></div>`,f=>{if(!f.date||!f.time||!data.clients.some(c=>c.id===f.clientId))throw Error('Escolha o paciente na lista que aparece ao digitar o nome, e informe data e horário.');if(f.status==='scheduled')confirmConflict(f.date,f.time,f.duration,id);if(id)Object.assign(a,f);else data.appointments.push({id:uid(),createdAt:new Date().toISOString(),...f});toast('Agendamento registrado.')});setupClientPicker()}
function userModal(id){
  const u=registry.users.find(x=>x.id===id);const isChange=!!u;
  openModal(isChange?'Trocar senha do usuário':'Criar usuário',`<div class="formgrid"><div class="field wide"><label>Login do usuário *</label><input class="input" name="username" ${isChange?'readonly':''} required maxlength="100" value="${esc(u?.name||'')}"></div><div class="field wide"><label>${isChange?'Nova senha':'Senha inicial'} *</label><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field wide"><label>Confirmar senha *</label><input class="input" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div></div><p class="help">O acesso vale em qualquer aparelho, assim que for salvo.</p>`,async f=>{
    const name=f.username.trim();if(f.password!==f.confirm)throw Error('As senhas não coincidem.');if(f.password.length<8)throw Error('Senha deve ter pelo menos 8 caracteres.');
    if(!isChange&&registry.users.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw Error('Este usuário já existe.');
    const nu=await wrapped(name,f.password,secret,u?.role||'user',u?.id||uid());
    if(isChange){Object.assign(u,{salt:nu.salt,wrapped:nu.wrapped})}else registry.users.push(nu);
    toast('Usuário salvo.');
  })
}
function downloadBackup(){if(!registry?.vault)return toast('Nenhum cofre para exportar.');const json=JSON.stringify({...registry,exportedAt:new Date().toISOString()},null,2);const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`AMA-FISIO-backup-criptografado-${today()}.json`;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);try{localStorage.setItem('ama_last_backup',new Date().toISOString())}catch{}toast('Backup criptografado baixado. Guarde-o em local seguro.')}
function restoreBackup(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{try{const text=await input.files[0].text();const obj=JSON.parse(text);if(obj.version!==3||!Array.isArray(obj.users)||!obj.vault?.iv||!obj.vault?.payload)throw Error('Este arquivo não é um backup válido do AMA FISIO.');if(!confirm('Substituir TODOS os dados e usuários (inclusive na nuvem, no próximo login) pelo arquivo escolhido?'))return;localStorage.setItem(STORE_KEY,JSON.stringify({version:3,users:obj.users,vault:obj.vault}));try{localStorage.setItem(PENDING_KEY,'1')}catch{}registry=readRegistry();secret=null;data=null;account=null;view='dashboard';render();toast('Backup carregado. Entre novamente: ao entrar, ele substituirá os dados da nuvem.')}catch(err){toast('Falha na restauração: '+err.message)}};input.click()}
window.addEventListener('storage',e=>{if(e.key===STORE_KEY && !account){registry=readRegistry();render()}});
if(!window.crypto?.subtle){$('#app').innerHTML='<main class="authform" style="min-height:100vh"><div class="authbox"><h2>Navegador incompatível</h2><p>Abra o site por HTTPS (GitHub Pages) ou localhost. A proteção local precisa do Web Crypto.</p></div></main>'}else{render()}
async function syncFromCloud(manual){
  if(!account||!db)return;
  const c=await fetchCloud();if(!c)return;
  if(c.rev<=(registry.rev||0)){if(manual)toast('Já está atualizado.');return}
  const id=account.id;registry=c;cacheLocal();data=await readVault(secret);account=registry.users.find(x=>x.id===id);
  if(!account||!account.active){account=null;secret=null;data=null;render();toast('Seu acesso foi alterado. Entre novamente.');return}
  if(!$('#modal').open)renderShell();if(manual)toast('Dados atualizados da nuvem.')
}
setInterval(()=>{if(account&&view==='dashboard'&&!$('#modal').open){renderShell()}},60000);
setInterval(()=>{if(account&&!$('#modal').open)syncFromCloud(false).catch(()=>{})},45000);
