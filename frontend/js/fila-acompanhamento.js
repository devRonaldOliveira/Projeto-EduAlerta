// EduAlerta — Fila de Acompanhamento (prévia de interface).
// Não contém dados inventados nem define regras de risco: classificação vem da API.
// Para integrar depois: window.EduAlertaFila.setAlertas(listaDeAlertas).
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const sidebar = $('#sidebar');
  const toggle = $('#toggle-sidebar');
  const toast = $('#toast');
  const tbody = $('#alerts-body');
  const search = $('#queue-search');
  const tabs = Array.from(document.querySelectorAll('[data-filter]'));
  const pageSize = 10;
  let allAlerts = [];
  let loaded = false;
  let dataStatus = 'idle';
  let dataError = '';
  let selectedFilter = 'todos';
  let page = 1;
  let toastTimer;

  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const valueOf = (alerta, ...keys) => {
    for (const key of keys) if (alerta[key] !== undefined && alerta[key] !== null) return String(alerta[key]);
    return '';
  };
  const isHigh = (a) => ['alto', 'alto risco', 'alerta', 'critico', 'critico(a)'].includes(normalize(valueOf(a,'nivel','risco','status')));
  const isAttention = (a) => ['atencao','em atencao','medio','medio risco'].includes(normalize(valueOf(a,'nivel','risco','status')));
  const isNew = (a) => a.novo === true || ['novo','nova'].includes(normalize(valueOf(a,'status')));
  const hasRecentFall = (a) => a.quedaRecente === true;
  const count = (items, test) => items.filter(test).length;

  function message(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {toast.hidden = true;}, 4200);
  }
  function closeMenus() {
    for (const [buttonId, panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
      const button = document.getElementById(buttonId);
      const panel = document.getElementById(panelId);
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  }
  for (const [buttonId, panelId] of [['notifications-button','notifications-panel'],['account-button','account-panel']]) {
    document.getElementById(buttonId).addEventListener('click', (event) => {
      event.stopPropagation();
      const panel = document.getElementById(panelId);
      const open = panel.hidden;
      closeMenus();
      panel.hidden = !open;
      document.getElementById(buttonId).setAttribute('aria-expanded', String(open));
    });
  }
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar navegação' : 'Abrir navegação');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.dropdown-wrap')) closeMenus();
    if (window.innerWidth <= 740 && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      sidebar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeMenus();
    sidebar.classList.remove('is-open');
    toggle.setAttribute('aria-expanded','false');
  });
  document.querySelectorAll('[data-future]').forEach((button) => {
    button.addEventListener('click', () => message(`A seção “${button.dataset.future}” será adicionada nas próximas etapas do EduAlerta.`));
  });

  function updateTotals() {
    const totals = {todos:allAlerts.length, alto:count(allAlerts,isHigh), atencao:count(allAlerts,isAttention), novos:count(allAlerts,isNew)};
    const shown = (number) => loaded ? number.toLocaleString('pt-BR') : '—';
    for (const key of Object.keys(totals)) {
      document.getElementById(`count-${key}`).textContent = `(${shown(totals[key])})`;
    }
    for (const [elementId, number] of [['metric-alto',totals.alto], ['metric-atencao',totals.atencao], ['metric-queda',count(allAlerts,hasRecentFall)]]) {
      const element = document.getElementById(elementId);
      element.textContent = shown(number);
      element.setAttribute('aria-label',loaded ? String(number) : 'Dado não disponível');
    }
    $('#queue-data-label').textContent = dataStatus === 'loading' ? 'Carregando alertas…' :
      dataStatus === 'error' ? 'Não foi possível carregar os alertas' :
      loaded ? 'Informações atualizadas' : 'Os dados ainda não estão disponíveis';
  }
  function getFiltered() {
    const query = normalize(search.value);
    return allAlerts.filter((a) => {
      const matchesFilter = selectedFilter === 'todos' ||
        (selectedFilter === 'alto' && isHigh(a)) ||
        (selectedFilter === 'atencao' && isAttention(a)) ||
        (selectedFilter === 'novos' && isNew(a));
      const haystack = normalize([valueOf(a,'nome','aluno'),valueOf(a,'escola'),valueOf(a,'matricula'),valueOf(a,'sinal','motivo')].join(' '));
      return matchesFilter && (!query || haystack.includes(query));
    });
  }
  function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = String(text);
    return el;
  }
  function formatDate(input) {
    if (!input) return '—';
    const source = String(input);
    if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
      const [year,month,day] = source.split('-');
      return `${day}/${month}/${year}`;
    }
    return source;
  }
  function appendEmptyRow(title, subtitle) {
    const tr = createElement('tr');
    const td = createElement('td','empty-row queue-empty');
    td.colSpan = 6;
    td.append(createElement('span','', '▤'), createElement('strong','',title),createElement('small','',subtitle));
    tr.append(td);
    tbody.append(tr);
  }
  function appendAlert(a) {
    const tr = createElement('tr');
    const name = valueOf(a,'nome','aluno') || 'Não informado';
    const matricula = valueOf(a,'matricula');
    const className = valueOf(a,'turma');
    const studentCell = createElement('td');
    const student = createElement('div','queue-student');
    const initials = name.split(/\s+/).slice(0,2).map((w) => w.charAt(0)).join('').toUpperCase();
    student.append(createElement('span','queue-initials',initials),createElement('div'));
    student.lastChild.append(createElement('strong','',name),createElement('small','',[className,matricula].filter(Boolean).join(' · ') || 'Informação não disponível'));
    studentCell.append(student);
    tr.append(studentCell);
    tr.append(createElement('td','',valueOf(a,'escola') || '—'));
    tr.append(createElement('td','',valueOf(a,'sinal','motivo') || '—'));
    tr.append(createElement('td','',formatDate(valueOf(a,'data'))));
    const statusCell = createElement('td');
    const statusLabel = valueOf(a,'nivel','risco','status') || 'Em análise';
    statusCell.append(createElement('span',`queue-status ${isHigh(a)?'alto':isAttention(a)?'atencao':isNew(a)?'novo':''}`,statusLabel));
    tr.append(statusCell);
    const actionCell = createElement('td');
    const identifier = valueOf(a,'studentId','alunoId','estudanteId','idEstudante','matricula');
    let action;
    if (identifier) {
      action = createElement('a','queue-action','Ver perfil');
      action.href = `perfil-aluno.html?id=${encodeURIComponent(identifier)}`;
      action.setAttribute('aria-label', `Ver perfil de ${name}`);
    } else {
      action = createElement('button','queue-action','Perfil indisponível');
      action.type = 'button';
      action.disabled = true;
      action.title = 'O estudante não possui identificador para abrir o perfil.';
    }
    actionCell.append(action);tr.append(actionCell);
    tbody.append(tr);
  }
  function render() {
    updateTotals();
    const filtered = getFiltered();
    const pageCount = Math.max(1,Math.ceil(filtered.length/pageSize));
    page = Math.max(1, Math.min(page,pageCount));
    tbody.replaceChildren();
    if (!loaded && dataStatus === 'loading') appendEmptyRow('Carregando alertas…','Aguarde a resposta do serviço de acompanhamento.');
    else if (!loaded && dataStatus === 'error') appendEmptyRow('Não foi possível carregar os alertas',dataError || 'Tente novamente quando o serviço estiver disponível.');
    else if (!loaded) appendEmptyRow('Ainda não há alertas para exibir','Quando as informações estiverem disponíveis, os alertas aparecerão aqui.');
    else if (!filtered.length) appendEmptyRow('Nenhum alerta encontrado','Tente outro termo ou altere o filtro.');
    else filtered.slice((page-1)*pageSize,page*pageSize).forEach(appendAlert);
    $('#results-summary').textContent = !loaded ? dataStatus === 'loading' ? 'Carregando alertas…' : dataStatus === 'error' ? 'Erro ao carregar alertas' : 'Os alertas ainda não estão disponíveis' : `${filtered.length.toLocaleString('pt-BR')} alerta(s) encontrado(s)`;
    const pagination = $('#queue-pagination');
    pagination.hidden = !loaded || filtered.length === 0;
    if (!pagination.hidden) {
      const start = (page-1)*pageSize+1;
      const end = Math.min(page*pageSize, filtered.length);
      $('#page-summary').textContent = `Mostrando ${start} a ${end} de ${filtered.length.toLocaleString('pt-BR')}`;
      $('#page-number').textContent = `Página ${page} de ${pageCount}`;
      $('#page-prev').disabled = page === 1;
      $('#page-next').disabled = page === pageCount;
    }
  }
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    selectedFilter = tab.dataset.filter;
    page = 1;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('active',active);
      item.setAttribute('aria-pressed',String(active));
    });
    render();
  }));
  search.addEventListener('input', () => {page=1;render();});
  $('#show-all').addEventListener('click', () => {
    tabs.find((tab) => tab.dataset.filter === 'todos').click();
    search.value = '';
    render();
    $('#lista-alertas').scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('#page-prev').addEventListener('click', () => {page--;render();});
  $('#page-next').addEventListener('click', () => {page++;render();});
  // Integração futura: lista com {nome, matricula, turma, escola, sinal, data, nivel, novo, quedaRecente}.
  // Nenhum endpoint foi presumido: a equipe pode usar esta função após obter os dados da API.
  window.EduAlertaFila = Object.freeze({
    setCarregando() {allAlerts=[];loaded=false;dataStatus='loading';dataError='';window.EduAlertaNotificacoes?.setNotificacoes([]);render();},
    setErro(error) {allAlerts=[];loaded=false;dataStatus='error';dataError=String(error||'Tente novamente quando o serviço estiver disponível.');window.EduAlertaNotificacoes?.setErro(dataError);render();},
    setAlertas(items) {
      if (!Array.isArray(items)) throw new TypeError('setAlertas espera uma lista de alertas.');
      allAlerts = items.filter((item) => item && typeof item === 'object');
      loaded = true;
      dataStatus = 'success';
      dataError = '';
      page = 1;
      render();
      window.EduAlertaNotificacoes?.setNotificacoes(allAlerts.map((item) => ({
        tipo:'frequencia',
        titulo:valueOf(item,'sinal','motivo') || 'Alerta de frequência',
        descricao:[valueOf(item,'nome','aluno'),valueOf(item,'escola'),valueOf(item,'nivel','risco')].filter(Boolean).join(' · ') || 'Alerta recebido do serviço escolar.',
        data:formatDate(valueOf(item,'data')),
        studentId:valueOf(item,'studentId','alunoId','estudanteId','idEstudante','matricula'),
        lida:item.lida === true || item.read === true
      })));
    }
  });
  render();
})();
