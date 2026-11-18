// EduAlerta — Perfil do Aluno. HTML/CSS/JavaScript sem dependências.
// Integração futura: após obter um aluno REAL da API, execute
// window.EduAlertaPerfil.setPerfil({id, nome, matricula, dataNascimento, escola,
//   serie, turma, turno, anoLetivo, situacaoMatricula, responsavel,
//   telefoneResponsavel, emailResponsavel, frequencia, faltasMes, diasLetivos,
//   meta, ultimoAlerta, historico, eventos}).
// Nenhum endpoint é presumido. Dados do Figma só aparecem na prévia direta sem ?id=.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(window.location.search);
  const selectedId = params.get('id') || params.get('matricula');
  const example = {
    id: '202400187', nome: 'Mariana Silva Santos', matricula: '202400187', escola: 'Escola Municipal do Recife',
    turma: '8º ano B', frequencia: 78.4, faltasMes: 5, diasLetivos: 20, meta: 85,
    serie: '8º ano', turno: '', anoLetivo: '', situacaoMatricula: '',
    dataNascimento: '', responsavel: '', telefoneResponsavel: '', emailResponsavel: '',
    ultimoAlerta: '12 set', ultimoAlertaDescricao: 'Há 8 dias no exemplo do Figma',
    historico: [
      {mes: 'Mar/2026', valor: 92.1}, {mes: 'Abr/2026', valor: 86.7},
      {mes: 'Mai/2026', valor: 82.3}, {mes: 'Jun/2026', valor: 79.5},
      {mes: 'Jul/2026', valor: 79.6}, {mes: 'Ago/2026', valor: 76.4}
    ],
    eventos: [
      {data: '12 de setembro de 2026',tipo:'alerta',titulo:'Alerta de frequência',descricao:'Frequência abaixo de 80% no mês de setembro'},
      {data: '03 de setembro de 2026',tipo:'acompanhamento',titulo:'Registro de acompanhamento',descricao:'Conversa com responsável. Família ciente da situação e se comprometeu a acompanhar mais de perto'},
      {data: '20 de agosto de 2026',tipo:'alerta',titulo:'Alerta de frequência',descricao:'Frequência abaixo de 80% no mês de agosto'},
      {data: '12 de setembro de 2026',tipo:'contato',titulo:'Contato com responsável',descricao:'Ligação realizada. Responsável informou dificuldades com transporte'},
      {data: '05 de agosto de 2026',tipo:'retorno',titulo:'Retorno positivo',descricao:'Aluna retornou às aulas após período de faltas'}
    ]
  };
  let isDemo = !selectedId && !window.EDUALERTA_PROFILE_DATA;
  let current = isDemo ? structuredClone(example) : null;
  let eventsExpanded = false;
  let profileStatus = current ? 'success' : 'idle';
  let profileError = '';
  let toastTimeout;

  function message(text) {
    const toast = $('#toast');
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {toast.hidden = true;},4500);
  }

  const sidebar = $('#sidebar');
  const toggle = $('#toggle-sidebar');
  function closeMenus() {
    for (const [buttonId, panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
      const button = document.getElementById(buttonId);
      const panel = document.getElementById(panelId);
      panel.hidden = true;
      button.setAttribute('aria-expanded','false');
    }
  }
  for (const [buttonId, panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
    document.getElementById(buttonId).addEventListener('click',(event) => {
      event.stopPropagation();
      const panel = document.getElementById(panelId);
      const opening = panel.hidden;
      closeMenus();
      panel.hidden = !opening;
      document.getElementById(buttonId).setAttribute('aria-expanded',String(opening));
    });
  }
  toggle.addEventListener('click', () => {
    const opening = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded',String(opening));
    toggle.setAttribute('aria-label',opening?'Fechar navegação':'Abrir navegação');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown-wrap')) closeMenus();
    if (window.innerWidth<=740 && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      sidebar.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key==='Escape') {closeMenus();sidebar.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');}
  });
  document.querySelectorAll('[data-future]').forEach((button) => button.addEventListener('click', () => message(`A seção “${button.dataset.future}” será adicionada nas próximas etapas do EduAlerta.`)));

  const numeric = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(String(value).replace(',','.').replace('%',''));
    return Number.isFinite(n) ? n : null;
  };
  const text = (value,fallback='—') => value===null || value===undefined || String(value).trim()===''?fallback:String(value);
  const percent = (value) => numeric(value)===null?'—':`${numeric(value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  const node = (tag,className,content) => {const element=document.createElement(tag);if (className) element.className=className;if (content!==undefined) element.textContent=String(content);return element;};
  const initialLetters = (name) => text(name,'').split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0].toUpperCase()).join('') || '—';
  const isoLocalDate = () => {const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
  const readableDate = (iso) => {if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;const [y,m,d]=iso.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});};
  const dateInputValue = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : '';
  const displayChoice = (value,choices) => choices[value] || value || 'Não informado';

  function normalizeProfile(profile) {
    if (!profile || typeof profile!=='object' || Array.isArray(profile)) return null;
    return {
      nome: text(profile.nome ?? profile.name,'Nome não informado'),
      id: text(profile.id ?? profile.studentId ?? profile.alunoId ?? profile.matricula ?? profile.registro),
      matricula: text(profile.matricula ?? profile.registro ?? profile.id),
      dataNascimento: text(profile.dataNascimento ?? profile.data_nascimento ?? profile.birthDate,''),
      escola: text(profile.escola ?? profile.school),
      serie: text(profile.serie ?? profile.anoEscolar ?? profile.grade,''),
      turma: text(profile.turma ?? profile.className),
      turno: text(profile.turno ?? profile.shift,''),
      anoLetivo: text(profile.anoLetivo ?? profile.ano_letivo ?? profile.academicYear,''),
      situacaoMatricula: text(profile.situacaoMatricula ?? profile.situacao_matricula ?? profile.enrollmentStatus,''),
      responsavel: text(profile.responsavel ?? profile.nomeResponsavel ?? profile.guardian,''),
      telefoneResponsavel: text(profile.telefoneResponsavel ?? profile.telefone_responsavel ?? profile.guardianPhone,''),
      emailResponsavel: text(profile.emailResponsavel ?? profile.email_responsavel ?? profile.guardianEmail,''),
      frequencia: numeric(profile.frequencia ?? profile.frequenciaPercentual),
      faltasMes: numeric(profile.faltasMes),
      diasLetivos: numeric(profile.diasLetivos),
      meta: numeric(profile.meta) ?? 85,
      ultimoAlerta: text(profile.ultimoAlerta),
      ultimoAlertaDescricao: text(profile.ultimoAlertaDescricao,''),
      historico: Array.isArray(profile.historico) ? profile.historico : [],
      eventos: Array.isArray(profile.eventos) ? profile.eventos : []
    };
  }

  function renderChart(profile) {
    const bars = $('#chart-bars');
    const months = $('#chart-months');
    bars.replaceChildren();months.replaceChildren();
    const history = Array.isArray(profile?.historico)?profile.historico.slice(-6):[];
    const target = numeric(profile?.meta) ?? 85;
    $('#chart-target').style.bottom = `${Math.min(100,Math.max(0,target))}%`;
    $('#goal-legend-text').textContent = `Meta da rede ${target.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
    if (!history.length) {
      $('#chart-state').setAttribute('aria-label','Histórico de frequência indisponível. Aguardando dados da API.');
      $('#chart-note-text').textContent='O histórico de frequência aparecerá quando os dados do estudante forem recebidos.';
      return;
    }
    $('#chart-state').setAttribute('aria-label','Frequência mensal: '+history.map((item)=>`${text(item.mes)} ${percent(item.valor)}`).join(', '));
    for (const item of history) {
      const value = numeric(item.valor);
      const slot = node('div','profile-bar-slot');
      if (value!==null && value>=0 && value<=100) {
        const bar=node('div','profile-bar');
        bar.style.height = `${value}%`;
        bar.append(node('span','profile-bar-value',percent(value)));
        slot.append(bar);
      }
      bars.append(slot);
      months.append(node('span','',text(item.mes)));
    }
    const freq=numeric(profile.frequencia);
    if (freq===null) $('#chart-note-text').textContent='Os indicadores individuais ficarão disponíveis após a integração com a API.';
    else {
      const gap=Math.abs(freq-target).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
      const position=freq<target?'abaixo':freq>target?'acima':'na meta';
      const difference=freq===target?'está exatamente na meta':`está ${gap} pontos percentuais ${position} da meta`;
      $('#chart-note-text').textContent=`A frequência do estudante ${difference} da rede municipal (${target.toLocaleString('pt-BR')}%).`;
    }
  }

  function renderEvents(profile) {
    const list=$('#timeline-list');
    list.replaceChildren();
    const events=Array.isArray(profile?.eventos)?profile.eventos:[];
    $('#timeline-count').textContent=events.length?`${events.length} registro(s)`:'Nenhum registro disponível';
    const toggleButton=$('#timeline-toggle');
    toggleButton.hidden=events.length<=3;
    toggleButton.textContent=eventsExpanded?'Ver menos':'Ver todos';
    toggleButton.setAttribute('aria-expanded',String(eventsExpanded));
    if (!events.length) {
      list.append(node('li','profile-timeline-empty','Alertas e acompanhamentos aparecerão aqui quando forem disponibilizados pelo sistema.'));
      return;
    }
    const visible=eventsExpanded?events:events.slice(0,4);
    for (const event of visible) {
      const li=node('li','profile-event');
      const category=['alerta','contato','retorno','acompanhamento'].includes(event.tipo)?event.tipo:'acompanhamento';
      li.append(node('span',`profile-event-marker ${category}`));
      const body=node('div','profile-event-body');
      body.append(node('time','profile-event-date',text(event.data)),node('h3','profile-event-title',text(event.titulo)),node('p','profile-event-description',text(event.descricao,'')));
      if (event.resultado) body.append(node('p','profile-event-description',`Resultado: ${event.resultado}`));
      if (event.proximaAcao) body.append(node('p','profile-event-description',`Próxima ação: ${event.proximaAcao}`));
      if (event.status) body.append(node('p','profile-event-description',`Status: ${event.status}`));
      if (event.localPreview===true) body.append(node('small','profile-event-tag','Somente nesta sessão · Não salvo'));
      li.append(body);list.append(li);
    }
  }

  function render() {
    const profile = current;
    const notice = $('#profile-notice-text');
    if (!profile) {
      notice.textContent=profileStatus==='loading'?'Carregando perfil do estudante…':
        profileStatus==='error'?`Não foi possível carregar o perfil: ${profileError}`:
        selectedId?`O identificador ${selectedId} foi selecionado, mas o serviço ainda não forneceu seus dados. Não exibimos um estudante de demonstração no lugar de um perfil real.`:'Nenhum perfil recebido. A API deverá fornecer os dados do estudante.';
    } else if (isDemo) {
      notice.textContent='Exemplo visual do Figma. Nome, matrícula, indicadores, gráfico e histórico são apenas dados ilustrativos. Nada é enviado ou salvo na API.';
    } else {
      notice.textContent='Perfil carregado a partir de dados fornecidos à página. Edições e registros feitos nesta prévia não são enviados nem salvos no servidor.';
    }
    $('#student-initials').textContent=profile?initialLetters(profile.nome):'—';
    $('#student-name').textContent=profile?text(profile.nome):'Dados do aluno indisponíveis';
    $('#student-registration').textContent=profile?`Matrícula ${text(profile.matricula)}`:selectedId?`Matrícula ${selectedId}`:'Matrícula —';
    $('#student-school').textContent=profile?text(profile.escola):'Escola indisponível';
    $('#student-class').textContent=profile?text(profile.turma):'Turma indisponível';
    $('#student-birth-date').textContent=profile?text(readableDate(profile.dataNascimento),'Não informado'):'—';
    $('#student-grade').textContent=profile?text(profile.serie,'Não informado'):'—';
    $('#student-shift').textContent=profile?displayChoice(profile.turno,{manha:'Manhã',tarde:'Tarde',noite:'Noite',integral:'Integral'}):'—';
    $('#student-academic-year').textContent=profile?text(profile.anoLetivo,'Não informado'):'—';
    $('#student-enrollment-status').textContent=profile?displayChoice(profile.situacaoMatricula,{matriculado:'Matriculado',transferencia:'Em transferência',inativo:'Inativo',concluido:'Concluído'}):'—';
    $('#student-guardian').textContent=profile?text(profile.responsavel,'Não informado'):'—';
    $('#student-guardian-phone').textContent=profile?text(profile.telefoneResponsavel,'Não informado'):'—';
    $('#student-guardian-email').textContent=profile?text(profile.emailResponsavel,'Não informado'):'—';
    $('#student-attendance').textContent=percent(profile?.frequencia);
    $('#student-absences').textContent=profile&&numeric(profile.faltasMes)!==null?String(profile.faltasMes):'—';
    $('#absences-description').textContent=profile&&numeric(profile.diasLetivos)!==null?`de ${profile.diasLetivos} dias letivos`:'Dados da API pendentes';
    $('#student-last-alert').textContent=profile?text(profile.ultimoAlerta):'—';
    $('#last-alert-description').textContent=profile?text(profile.ultimoAlertaDescricao,'Sem informações adicionais'):'Aguardando alertas';
    const freq=numeric(profile?.frequencia),target=numeric(profile?.meta)??85;
    $('#attendance-description').textContent=freq===null?'Dados da API pendentes':freq<target?`Abaixo da meta de ${target}%`:freq>target?`Acima da meta de ${target}%`:`Na meta de ${target}%`;
    $('#register-followup').disabled=!profile;
    $('#edit-student').disabled=!profile;
    renderChart(profile);renderEvents(profile);
  }

  $('#timeline-toggle').addEventListener('click', () => {eventsExpanded=!eventsExpanded;renderEvents(current);});
  const followupDialog=$('#followup-dialog');
  const editDialog=$('#edit-dialog');
  const followupForm=$('#followup-form');
  const editForm=$('#edit-form');
  const returnDate=$('#followup-return-date');
  function validateReturnDate() {
    returnDate.required=$('#followup-reminder').checked;
    const invalid=$('#followup-reminder').checked && returnDate.value && returnDate.value<$('#followup-date').value;
    returnDate.setCustomValidity(invalid?'A data de retorno não pode ser anterior ao atendimento.':'');
  }
  $('#followup-reminder').addEventListener('change',validateReturnDate);
  returnDate.addEventListener('change',validateReturnDate);
  $('#followup-date').addEventListener('change',validateReturnDate);
  $('#register-followup').addEventListener('click',()=>{
    if (!current) return;
    followupForm.reset();
    $('#followup-date').value=isoLocalDate();
    returnDate.required=false;
    $('#followup-form-message').textContent='O registro só será mantido nesta sessão; a integração com o serviço ainda é necessária.';
    followupDialog.showModal();
  });
  $('#edit-student').addEventListener('click',()=>{
    if (!current) return;
    $('#edit-name').value=text(current.nome,'');$('#edit-registration').value=text(current.matricula,'');
    $('#edit-birth-date').value=dateInputValue(current.dataNascimento);
    $('#edit-school').value=text(current.escola,'');$('#edit-grade').value=text(current.serie,'');$('#edit-class').value=text(current.turma,'');
    $('#edit-shift').value=text(current.turno,'');$('#edit-academic-year').value=text(current.anoLetivo,'');
    $('#edit-enrollment-status').value=text(current.situacaoMatricula,'');
    $('#edit-guardian').value=text(current.responsavel,'');$('#edit-guardian-phone').value=text(current.telefoneResponsavel,'');
    $('#edit-guardian-email').value=text(current.emailResponsavel,'');
    $('#edit-form-message').textContent='As alterações só serão aplicadas nesta sessão; nada será gravado.';
    editDialog.showModal();
  });
  document.querySelectorAll('[data-close-dialog]').forEach((button)=>button.addEventListener('click',()=>button.closest('dialog').close()));
  for (const dialog of [followupDialog,editDialog]) dialog.addEventListener('click',(event)=>{if (event.target===dialog) dialog.close();});

  followupForm.addEventListener('submit',(event)=>{
    event.preventDefault();
    if (!current || !followupForm.reportValidity()) return;
    if ($('#followup-reminder').checked && !returnDate.value) {returnDate.focus();$('#followup-form-message').textContent='Informe a data de retorno para preparar o alerta.';return;}
    if (returnDate.validationMessage) {returnDate.reportValidity();return;}
    const date=$('#followup-date').value;
    const intervention=$('#followup-kind').selectedOptions[0].textContent;
    const description=$('#followup-description').value.trim();
    const result=$('#followup-result').value.trim();
    const nextAction=$('#followup-next-action').value.trim();
    const professional=$('#followup-professional').value.trim();
    const status=$('#followup-status').selectedOptions[0].textContent;
    const returnValue=returnDate.value;
    const eventRecord={
      id:`preview-${Date.now()}`, data:readableDate(date), tipo:'acompanhamento',
      titulo:`Acompanhamento · ${intervention}`,
      descricao:`Profissional: ${professional}. ${description}`,
      resultado:result, proximaAcao:nextAction, status, localPreview:true
    };
    document.dispatchEvent(new CustomEvent('edualerta:followup-submit',{detail:{
      alunoId:current.id!=='—'?current.id:current.matricula,
      dataAtendimento:date, tipoIntervencao:intervention, profissional:professional,
      descricao:description, resultado:result, proximaAcao:nextAction,
      status, dataRetorno:returnValue||null, criarAlertaRetorno:$('#followup-reminder').checked
    }}));
    current.eventos=[eventRecord,...current.eventos];
    if ($('#followup-reminder').checked) {
      const returnLabel=readableDate(returnValue);
      window.EduAlertaNotificacoes?.adicionarPrevia({
        tipo:'retorno', titulo:'Retorno agendado', descricao:`${current.nome}: ${nextAction}`,
        data:returnLabel, studentId:current.id!=='—'?current.id:current.matricula
      });
    }
    followupDialog.close();render();
    message('Registro e histórico atualizados somente nesta sessão; nenhum dado foi enviado ou gravado.');
  });
  editForm.addEventListener('submit',(event)=>{
    event.preventDefault();if (!current || !editForm.reportValidity()) return;
    const changes={
      nome:$('#edit-name').value.trim(),matricula:$('#edit-registration').value.trim(),
      dataNascimento:$('#edit-birth-date').value,escola:$('#edit-school').value.trim(),
      serie:$('#edit-grade').value.trim(),turma:$('#edit-class').value.trim(),
      turno:$('#edit-shift').value,anoLetivo:$('#edit-academic-year').value,
      situacaoMatricula:$('#edit-enrollment-status').value,responsavel:$('#edit-guardian').value.trim(),
      telefoneResponsavel:$('#edit-guardian-phone').value.trim(),emailResponsavel:$('#edit-guardian-email').value.trim()
    };
    document.dispatchEvent(new CustomEvent('edualerta:student-update',{detail:{alunoId:current.id!=='—'?current.id:current.matricula,...changes}}));
    Object.assign(current,changes);
    current.id=current.id==='—'?current.matricula:current.id;
    editDialog.close();render();message('Alterações validadas e atualizadas somente nesta sessão; nada foi gravado.');
  });

  function setPerfil(profile) {
    const parsed=normalizeProfile(profile);
    if (!parsed) {message('O formato do perfil recebido é inválido.');return false;}
    if (selectedId && parsed.id!=='—' && parsed.id!==selectedId && parsed.matricula!==selectedId) {
      message('Os dados recebidos não correspondem ao identificador selecionado.');return false;
    }
    current=parsed;isDemo=false;profileStatus='success';profileError='';eventsExpanded=false;render();return true;
  }
  window.EduAlertaPerfil=Object.freeze({
    setPerfil,
    setCarregando(){current=null;isDemo=false;profileStatus='loading';profileError='';render();},
    setErro(error){current=null;isDemo=false;profileStatus='error';profileError=String(error||'Tente novamente quando o serviço estiver disponível.');render();}
  });
  if (window.EDUALERTA_PROFILE_DATA) setPerfil(window.EDUALERTA_PROFILE_DATA);
  else render();
})();
