// EduAlerta — Diretório de Alunos (interface sem API conectada).
// Após a integração, chamar window.EduAlertaAlunos.setAlunos(lista, resumoOpcional).
// Não são fabricados dados de estudantes nem endpoints.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const sidebar = $('#sidebar');
  const toggle = $('#toggle-sidebar');
  const toast = $('#toast');
  const search = $('#student-search');
  const schoolFilter = $('#school-filter');
  const classFilter = $('#class-filter');
  const riskFilter = $('#risk-filter');
  const tableBody = $('#students-body');
  const registrationDialog = $('#add-student-dialog');
  const registrationForm = $('#add-student-form');
  const queueDialog = $('#add-to-queue-dialog');
  const queueForm = $('#add-to-queue-form');
  const modalStudent = $('#modal-student');
  let schoolCatalog = new Map();
  let records = [];
  let loaded = false;
  let dataStatus = 'idle';
  let dataError = '';
  let page = 1;
  const pageSize = 10;
  let summary = {};
  let toastTimeout;

  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const field = (object, ...keys) => {
    for (const key of keys) if (object[key] !== undefined && object[key] !== null) return String(object[key]);
    return '';
  };
  const getName = (item) => field(item,'nome','aluno','name');
  const getSchool = (item) => field(item,'escola','school');
  const getClass = (item) => field(item,'turma','classe','className');
  const getRegistration = (item) => field(item,'matricula','registro');
  const getRisk = (item) => field(item,'risco','nivelRisco','nivel_risco');
  function riskKey(value) {
    const risk = normalize(value);
    if (['alto', 'alto risco', 'critico', 'critica', 'alerta'].includes(risk)) return 'alto';
    if (['atencao', 'em atencao', 'medio', 'medio risco'].includes(risk)) return 'atencao';
    if (['baixo', 'baixo risco', 'regular', 'normal'].includes(risk)) return 'baixo';
    return '';
  }
  const numberLabel = (value) => Number.isFinite(value) && value >= 0 ? Math.trunc(value).toLocaleString('pt-BR') : '—';

  function message(value) {
    toast.textContent = value;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 4500);
  }
  function closeMenus() {
    for (const [buttonId,panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
      $( `#${panelId}` ).hidden = true;
      $( `#${buttonId}` ).setAttribute('aria-expanded','false');
    }
  }
  for (const [buttonId,panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
    $(`#${buttonId}`).addEventListener('click', (event) => {
      event.stopPropagation();
      const panel = $(`#${panelId}`);
      const open = panel.hidden;
      closeMenus();
      panel.hidden = !open;
      $(`#${buttonId}`).setAttribute('aria-expanded',String(open));
    });
  }
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open ? 'Fechar navegação' : 'Abrir navegação');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown-wrap')) closeMenus();
    if (window.innerWidth <= 740 && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      sidebar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenus();
      sidebar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
    }
  });
  document.querySelectorAll('[data-future]').forEach((button) => {
    button.addEventListener('click', () => message(`A seção “${button.dataset.future}” será adicionada nas próximas etapas do EduAlerta.`));
  });

  function element(tag,className,text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = String(text);
    return result;
  }
  function frequencyLabel(record) {
    const value = field(record,'frequencia','frequenciaPercentual','percentualFrequencia');
    if (!value) return '—';
    if (value.trim().endsWith('%')) return value;
    const parsed = Number(value.replace(',','.'));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) return `${parsed.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
    return '—';
  }
  function getFiltered() {
    const query = normalize(search.value);
    return records.filter((record) => {
      const matchesSearch = !query || normalize(`${getName(record)} ${getRegistration(record)}`).includes(query);
      const matchesSchool = !schoolFilter.value || getSchool(record) === schoolFilter.value;
      const matchesClass = !classFilter.value || getClass(record) === classFilter.value;
      const matchesRisk = !riskFilter.value || riskKey(getRisk(record)) === riskFilter.value;
      return matchesSearch && matchesSchool && matchesClass && matchesRisk;
    });
  }
  function makeOptions(select,items,allLabel) {
    const current = select.value;
    select.replaceChildren();
    const first = element('option','',allLabel);
    first.value = '';
    select.append(first);
    items.sort((a,b) => a.localeCompare(b,'pt-BR')).forEach((value) => {
      const option = element('option','',value);
      option.value = value;
      select.append(option);
    });
    if (items.includes(current)) select.value = current;
  }
  function syncSelects() {
    const schools = Array.from(new Set(records.map(getSchool).filter(Boolean)));
    const classes = Array.from(new Set(records.map(getClass).filter(Boolean)));
    makeOptions(schoolFilter, schools, 'Todas');
    makeOptions(classFilter, classes, 'Todas');
    modalStudent.replaceChildren();
    const placeholder = element('option','','Selecione um aluno');
    placeholder.value = '';
    modalStudent.append(placeholder);
    records.forEach((record,index) => {
      const name = getName(record);
      if (!name) return;
      const option = element('option','',[name,getRegistration(record)].filter(Boolean).join(' · '));
      option.value = String(index);
      modalStudent.append(option);
    });
    modalStudent.disabled = !records.length;
  }
  function syncStats() {
    const derive = (kind) => records.filter((record) => riskKey(getRisk(record)) === kind).length;
    const values = {
      'total-students': summary.total ?? (loaded ? records.length : NaN),
      'attention-students': summary.emAtencao ?? (loaded ? derive('atencao') : NaN),
      'high-students': summary.altoRisco ?? (loaded ? derive('alto') : NaN)
    };
    for (const [id,value] of Object.entries(values)) {
      const node = $(`#${id}`);
      node.textContent = numberLabel(value);
      node.setAttribute('aria-label',Number.isFinite(value) ? String(value) : 'Dado indisponível');
    }
    $('#students-api-status').textContent = dataStatus === 'loading' ? 'Carregando alunos…' :
      dataStatus === 'error' ? 'Não foi possível carregar os alunos' :
      loaded ? 'Informações atualizadas' : 'Os dados ainda não estão disponíveis';
  }
  function appendEmpty(title,subtitle) {
    const tr = element('tr');
    const cell = element('td','students-empty');
    cell.colSpan = 7;
    cell.append(element('span','','▤'),element('strong','',title),element('small','',subtitle));
    tr.append(cell);
    tableBody.append(tr);
  }
  function appendStudent(record) {
    const row = element('tr');
    const name = getName(record) || 'Nome indisponível';
    const student = element('td');
    const person = element('div','students-person');
    const initials = name.split(/\s+/).slice(0,2).map((part) => part.slice(0,1)).join('').toUpperCase();
    person.append(element('span','students-avatar',initials),element('strong','',name));
    student.append(person);
    row.append(student);
    row.append(element('td','',getRegistration(record) || '—'));
    row.append(element('td','',getSchool(record) || '—'));
    row.append(element('td','',getClass(record) || '—'));
    row.append(element('td','',frequencyLabel(record)));
    const risk = getRisk(record);
    const riskCell = element('td');
    riskCell.append(element('span',`students-risk ${riskKey(risk)==='alto'?'high':riskKey(risk)==='atencao'?'attention':riskKey(risk)==='baixo'?'low':''}`,risk || 'Não informado'));
    row.append(riskCell);
    const actionCell = element('td');
    const identifier = field(record,'id','studentId','alunoId','matricula','registro');
    let action;
    if (identifier) {
      action = element('a','students-view','Ver perfil');
      action.href = `perfil-aluno.html?id=${encodeURIComponent(identifier)}`;
      action.setAttribute('aria-label',`Ver perfil de ${name}`);
    } else {
      action = element('button','students-view','Perfil indisponível');
      action.type = 'button';
      action.disabled = true;
      action.title = 'O estudante não possui identificador para abrir o perfil.';
    }
    actionCell.append(action);
    row.append(actionCell);
    tableBody.append(row);
  }
  function render() {
    syncStats();
    const filtered = getFiltered();
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(1,page),lastPage);
    tableBody.replaceChildren();
    if (!loaded && dataStatus === 'loading') appendEmpty('Carregando alunos…','Aguarde a resposta do serviço de alunos.');
    else if (!loaded && dataStatus === 'error') appendEmpty('Não foi possível carregar os alunos',dataError || 'Tente novamente quando o serviço estiver disponível.');
    else if (!loaded) appendEmpty('Ainda não há alunos para exibir','Quando as informações estiverem disponíveis, a lista aparecerá aqui.');
    else if (!filtered.length) appendEmpty('Nenhum aluno encontrado','Tente outra busca ou altere os filtros.');
    else filtered.slice((page-1)*pageSize,page*pageSize).forEach(appendStudent);
    $('#result-count').textContent = !loaded ? dataStatus === 'loading' ? 'Carregando alunos…' : dataStatus === 'error' ? 'Erro ao carregar' : 'Os dados ainda não estão disponíveis' : `${filtered.length.toLocaleString('pt-BR')} aluno(s) na lista`;
    const pagination = $('#students-pagination');
    pagination.hidden = !loaded || !filtered.length;
    if (!pagination.hidden) {
      const first = (page-1)*pageSize+1;
      const last = Math.min(page*pageSize,filtered.length);
      $('#students-page-summary').textContent = `Mostrando ${first} a ${last} de ${filtered.length.toLocaleString('pt-BR')} alunos`;
      $('#students-page-number').textContent = `Página ${page} de ${lastPage}`;
      $('#students-prev').disabled = page === 1;
      $('#students-next').disabled = page === lastPage;
    }
  }
  [search,schoolFilter,classFilter,riskFilter].forEach((control) => control.addEventListener(control === search ? 'input' : 'change', () => {page=1;render();}));
  $('#clear-filters').addEventListener('click', () => {search.value='';schoolFilter.value='';classFilter.value='';riskFilter.value='';page=1;render();});
  document.querySelectorAll('[data-stat-filter]').forEach((button) => button.addEventListener('click', () => {
    riskFilter.value = button.dataset.statFilter === 'todos' ? '' : button.dataset.statFilter;
    page=1;render();
    $('#directory-title').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  $('#students-prev').addEventListener('click', () => {page--;render();});
  $('#students-next').addEventListener('click', () => {page++;render();});

  function closeRegistrationDialog() {registrationDialog.close();}
  function closeQueueDialog() {queueDialog.close();}
  function updateRegistrationClasses() {
    const school = schoolCatalog.get(normalize($('#registration-school').value));
    const classes = school ? school.classes : new Set();
    const datalist = $('#registration-classes');
    datalist.replaceChildren();
    Array.from(classes).sort((a,b) => a.localeCompare(b,'pt-BR')).forEach((value) => {
      const option = element('option');
      option.value = value;
      datalist.append(option);
    });
  }
  function updateRegistrationCatalog(catalog = {}) {
    schoolCatalog = new Map();
    const addSchool = (name, classes = []) => {
      if (!name) return;
      const key = normalize(name);
      if (!schoolCatalog.has(key)) schoolCatalog.set(key,{name,classes:new Set()});
      const entry = schoolCatalog.get(key);
      for (const item of classes) {
        const className = typeof item === 'string' ? item : field(item,'nome','turma','name');
        if (className) entry.classes.add(className);
      }
    };
    for (const record of records) addSchool(getSchool(record),[getClass(record)]);
    const schools = Array.isArray(catalog.escolas) ? catalog.escolas : [];
    for (const item of schools) {
      if (typeof item === 'string') addSchool(item);
      else if (item && typeof item === 'object') addSchool(field(item,'nome','name'),Array.isArray(item.turmas)?item.turmas:[]);
    }
    const datalist = $('#registration-schools');
    datalist.replaceChildren();
    Array.from(schoolCatalog.values()).sort((a,b) => a.name.localeCompare(b.name,'pt-BR')).forEach((school) => {
      const option = element('option');
      option.value = school.name;
      datalist.append(option);
    });
    const classDatalist = $('#registration-classes');
    classDatalist.dataset.schoolOptions = 'Atualizadas conforme a escola selecionada.';
    updateRegistrationClasses();
  }

  $('#add-student-button').addEventListener('click', () => {
    registrationForm.reset();
    $('#registration-year').value = String(new Date().getFullYear());
    $('#registration-message').textContent = 'Cadastro em prévia: os dados não serão gravados nem armazenados neste navegador.';
    updateRegistrationClasses();
    registrationDialog.showModal();
  });
  $('#add-to-queue-button').addEventListener('click', () => {
    queueForm.reset();
    $('#modal-message').textContent = records.length ? 'A inclusão depende da integração com o serviço de acompanhamento.' : 'Não há alunos disponíveis para selecionar no momento.';
    queueDialog.showModal();
  });
  $('#registration-school').addEventListener('input',updateRegistrationClasses);
  $('#close-add-student').addEventListener('click',closeRegistrationDialog);
  $('#cancel-student-registration').addEventListener('click',closeRegistrationDialog);
  $('#close-add-to-queue').addEventListener('click',closeQueueDialog);
  $('#cancel-add-to-queue').addEventListener('click',closeQueueDialog);
  registrationDialog.addEventListener('click', (event) => { if (event.target === registrationDialog) closeRegistrationDialog(); });
  queueDialog.addEventListener('click', (event) => { if (event.target === queueDialog) closeQueueDialog(); });
  registrationForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!registrationForm.reportValidity()) return;
    const formData = new FormData(registrationForm);
    const student = Object.fromEntries(formData.entries());
    document.dispatchEvent(new CustomEvent('edualerta:student-registration', {detail:student}));
    $('#registration-message').textContent = 'Dados validados. O cadastro aguarda integração com o serviço de alunos; nada foi gravado.';
  });
  queueForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!queueForm.reportValidity()) return;
    const record = records[Number(modalStudent.value)];
    if (!record) {
      $('#modal-message').textContent = 'O estudante selecionado não está mais disponível na lista.';
      return;
    }
    const payload = {
      alunoId: field(record,'id','studentId','alunoId','matricula','registro'),
      aluno: record,
      motivo: $('#modal-reason').value,
      prioridade: queueForm.elements.prioridade.value,
      observacao: $('#modal-observation').value.trim()
    };
    document.dispatchEvent(new CustomEvent('edualerta:queue-add', {detail:payload}));
    $('#modal-message').textContent = 'Inclusão preparada e aguardando o serviço de acompanhamento. Nenhuma alteração foi gravada.';
  });

  window.EduAlertaAlunos = Object.freeze({
    // itens: [{nome, matricula, escola, turma, frequencia, risco}].
    // resumo (opcional): {total: number, emAtencao: number, altoRisco: number}
    setCarregando() {records=[];summary={};loaded=false;dataStatus='loading';dataError='';syncSelects();updateRegistrationCatalog();render();},
    setErro(error) {records=[];summary={};loaded=false;dataStatus='error';dataError=String(error||'Tente novamente quando o serviço estiver disponível.');syncSelects();updateRegistrationCatalog();render();},
    setAlunos(items, totals = {}, catalog = {}) {
      if (!Array.isArray(items)) throw new TypeError('setAlunos espera uma lista de alunos.');
      if (!totals || typeof totals !== 'object' || Array.isArray(totals)) throw new TypeError('O resumo precisa ser um objeto.');
      if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) throw new TypeError('O catálogo precisa ser um objeto.');
      records = items.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
      summary = Object.fromEntries(['total','emAtencao','altoRisco'].filter((key) => Number.isFinite(totals[key]) && totals[key] >= 0).map((key) => [key,totals[key]]));
      loaded = true;
      dataStatus = 'success';
      dataError = '';
      search.value='';schoolFilter.value='';classFilter.value='';riskFilter.value='';page=1;
      syncSelects();
      updateRegistrationCatalog(catalog);
      render();
    }
  });
  syncSelects();
  updateRegistrationCatalog();
  $('#registration-year').value = String(new Date().getFullYear());
  render();
})();
