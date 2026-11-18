// Prévia de interface. Não há autenticação nem dados de estudantes fictícios.
const toggleSidebar = document.querySelector('#toggle-sidebar');
const sidebar = document.querySelector('#sidebar');
const toast = document.querySelector('#toast');
let toastTimeout;
function showMessage(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => { toast.hidden = true; }, 4200);
}
function closeMenus(except = null) {
  for (const [buttonId,panelId] of [['notifications-button','notifications-panel'], ['account-button','account-panel']]) {
    if (panelId === except) continue;
    document.getElementById(panelId).hidden = true;
    document.getElementById(buttonId).setAttribute('aria-expanded','false');
  }
}
for (const [buttonId,panelId] of [['notifications-button','notifications-panel'], ['account-button','account-panel']]) {
  document.getElementById(buttonId).addEventListener('click', (event) => {
    event.stopPropagation();
    const panel = document.getElementById(panelId);
    const willOpen = panel.hidden;
    closeMenus();
    panel.hidden = !willOpen;
    document.getElementById(buttonId).setAttribute('aria-expanded', String(willOpen));
  });
}
document.addEventListener('click', (event) => {
  if (!event.target.closest('.dropdown-wrap')) closeMenus();
  if (window.innerWidth <= 740 && !sidebar.contains(event.target) && event.target !== toggleSidebar && sidebar.classList.contains('is-open')) {
    sidebar.classList.remove('is-open');
    toggleSidebar.setAttribute('aria-expanded', 'false');
  }
});
toggleSidebar.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('is-open');
  toggleSidebar.setAttribute('aria-expanded', String(isOpen));
  toggleSidebar.setAttribute('aria-label', isOpen ? 'Fechar navegação' : 'Abrir navegação');
});
document.querySelectorAll('[data-future]').forEach((control) => {
  control.addEventListener('click', () => showMessage(`A seção “${control.dataset.future}” será adicionada nas próximas etapas do EduAlerta.`));
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenus();sidebar.classList.remove('is-open');toggleSidebar.setAttribute('aria-expanded','false');
  }
});

const periodStart = document.querySelector('#period-start');
const periodEnd = document.querySelector('#period-end');
const periodFeedback = document.querySelector('#dashboard-period-feedback');
const metricFormat = (value, percent = false) => {
  if (value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) return '—';
  const formatted = Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1});
  return percent ? `${formatted}%` : formatted;
};
function applyPeriod() {
  periodFeedback.hidden = false;
  periodFeedback.removeAttribute('data-error');
  if ((periodStart.value && !periodEnd.value) || (!periodStart.value && periodEnd.value)) {
    periodFeedback.textContent = 'Informe as duas datas para aplicar um período.';
    periodFeedback.dataset.error = 'true';
    return;
  }
  if (periodStart.value && periodEnd.value && periodStart.value > periodEnd.value) {
    periodFeedback.textContent = 'A data inicial deve ser anterior ou igual à data final.';
    periodFeedback.dataset.error = 'true';
    periodEnd.focus();
    return;
  }
  const period = {inicio:periodStart.value || null,fim:periodEnd.value || null};
  document.dispatchEvent(new CustomEvent('edualerta:dashboard-filter',{detail:period}));
  periodFeedback.textContent = period.inicio ? 'Período aplicado; os indicadores dependem dos dados do serviço.' : 'Filtro de período removido; aguardando dados do serviço.';
}
document.querySelector('#apply-period').addEventListener('click',applyPeriod);
document.querySelector('#clear-period').addEventListener('click',() => {
  periodStart.value = '';
  periodEnd.value = '';
  periodFeedback.hidden = true;
  periodFeedback.removeAttribute('data-error');
  applyPeriod();
});
for (const input of [periodStart,periodEnd]) input.addEventListener('change',() => {
  periodFeedback.hidden = true;
  periodFeedback.removeAttribute('data-error');
});

function renderDashboardStudents(items) {
  const body = document.querySelector('#dashboard-students-body');
  body.replaceChildren();
  if (!items.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-row';
    cell.colSpan = 5;
    const title = document.createElement('strong');
    title.textContent = 'Nenhum estudante para exibir';
    const description = document.createElement('small');
    description.textContent = 'Não há estudantes para o período recebido.';
    cell.append(title,description);
    row.append(cell);
    body.append(row);
    return;
  }
  for (const student of items) {
    const row = document.createElement('tr');
    const name = String(student.nome ?? student.aluno ?? student.name ?? 'Nome indisponível');
    for (const value of [
      name,
      student.turma ?? student.className ?? '—',
      metricFormat(student.frequencia ?? student.attendance,true),
      student.situacao ?? student.status ?? '—'
    ]) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    const action = document.createElement('td');
    const id = student.id ?? student.studentId ?? student.alunoId ?? student.matricula;
    if (id !== undefined && id !== null && String(id).trim()) {
      const link = document.createElement('a');
      link.className = 'dashboard-student-profile';
      link.href = `perfil-aluno.html?id=${encodeURIComponent(String(id))}`;
      link.textContent = 'Ver perfil';
      action.append(link);
    } else {
      action.textContent = 'Perfil indisponível';
    }
    row.append(action);
    body.append(row);
  }
}

function setDashboardData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('setDados espera um objeto com resumo e estudantes.');
  }
  const summary = payload.resumo && typeof payload.resumo === 'object' ? payload.resumo : payload;
  const values = [
    ['metric-students',summary.alunosAtivos ?? summary.totalAlunos ?? summary.totalEstudantes],
    ['metric-attendance',summary.frequenciaMedia ?? summary.mediaFrequencia,true],
    ['metric-regular',summary.estudantesRegulares ?? summary.regulares],
    ['metric-attention',summary.estudantesEmAtencao ?? summary.emAtencao],
    ['metric-risk',summary.estudantesEmAlerta ?? summary.emAlerta ?? summary.altoRisco],
    ['metric-pending',summary.acompanhamentosPendentes ?? summary.pendentes]
  ];
  for (const [id,value,isPercent] of values) {
    const target = document.getElementById(id);
    target.textContent = metricFormat(value,isPercent);
    target.setAttribute('aria-label',target.textContent === '—' ? 'Dado não disponível' : target.textContent);
  }
  const students = payload.alunos ?? payload.estudantes;
  if (students !== undefined && !Array.isArray(students)) throw new TypeError('alunos/estudantes precisa ser uma lista.');
  if (Array.isArray(students)) renderDashboardStudents(students);
  const apiState = document.querySelector('#dashboard-api-state');
  apiState.textContent = 'Dados recebidos do adaptador de API.';
  apiState.removeAttribute('data-error');
}
window.EduAlertaDashboard = Object.freeze({
  setDados: setDashboardData,
  setCarregando() {
    ['metric-students','metric-attendance','metric-regular','metric-attention','metric-risk','metric-pending'].forEach(id=>{
      const metric=document.getElementById(id);
      metric.textContent='—';
      metric.setAttribute('aria-label','Dado não disponível');
    });
    renderDashboardStudents([]);
    const apiState = document.querySelector('#dashboard-api-state');
    apiState.textContent = 'Carregando indicadores…';
    apiState.removeAttribute('data-error');
  },
  setErro(message) {
    ['metric-students','metric-attendance','metric-regular','metric-attention','metric-risk','metric-pending'].forEach(id=>{
      const metric=document.getElementById(id);
      metric.textContent='—';
      metric.setAttribute('aria-label','Dado não disponível');
    });
    renderDashboardStudents([]);
    const apiState = document.querySelector('#dashboard-api-state');
    apiState.textContent = String(message || 'Não foi possível carregar os indicadores.');
    apiState.dataset.error = 'true';
  }
});
if (window.EDUALERTA_DASHBOARD_DATA) setDashboardData(window.EDUALERTA_DASHBOARD_DATA);
