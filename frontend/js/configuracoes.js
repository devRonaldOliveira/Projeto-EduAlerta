// EduAlerta — Configurações. Prévia local: não transmite dados ao servidor.
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const sidebar = get('sidebar'), toggle = get('toggle-sidebar');
  const toastBox = get('toast');
  let toastTimer;
  function toast(message) {
    toastBox.textContent = message;
    toastBox.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastBox.hidden = true; }, 4400);
  }
  const dropdowns = [['notifications-button','notifications-panel'],['account-button','account-panel']];
  function closeMenus() {
    for (const [buttonId,panelId] of dropdowns) {
      get(panelId).hidden = true;
      get(buttonId).setAttribute('aria-expanded', 'false');
    }
  }
  for (const [buttonId,panelId] of dropdowns) {
    get(buttonId).addEventListener('click', event => {
      event.stopPropagation();
      const panel = get(panelId), willOpen = panel.hidden;
      closeMenus(); panel.hidden = !willOpen;
      get(buttonId).setAttribute('aria-expanded', String(willOpen));
    });
  }
  toggle.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar navegação' : 'Abrir navegação');
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.dropdown-wrap')) closeMenus();
    if (innerWidth <= 740 && sidebar.classList.contains('is-open') && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
      sidebar.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenus(); sidebar.classList.remove('is-open');toggle.setAttribute('aria-expanded', 'false');
    }
  });
  const ids = ['notify-high-risk', 'notify-followups', 'notify-reports'];
  const appearance = get('appearance'), language = get('language'), feedback = get('settings-feedback');
  const STORAGE_KEY = 'EduAlerta.configuracoes.preview.v1';
  function applyAppearance() {
    document.documentElement.classList.toggle('settings-high-contrast', appearance.value === 'alto-contraste');
  }
  function readSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!data || typeof data !== 'object') return;
      for (const id of ids) if (typeof data[id] === 'boolean') get(id).checked = data[id];
      if ([...appearance.options].some(opt => opt.value === data.appearance)) appearance.value = data.appearance;
      if ([...language.options].some(opt => opt.value === data.language)) language.value = data.language;
    } catch (error) { console.info('Preferências locais indisponíveis.', error); }
  }
  function clearFeedback() { feedback.textContent = ''; feedback.removeAttribute('data-error'); }
  for (const id of ids) get(id).addEventListener('change', clearFeedback);
  language.addEventListener('change', clearFeedback);
  appearance.addEventListener('change', () => { applyAppearance(); clearFeedback(); });
  get('save-settings').addEventListener('click', () => {
    const data = { appearance: appearance.value, language: language.value };
    for (const id of ids) data[id] = get(id).checked;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      feedback.textContent = 'Preferências salvas neste navegador.';
      feedback.removeAttribute('data-error');
      toast('Preferências salvas neste navegador.');
    } catch {
      feedback.textContent = 'Não foi possível salvar as preferências neste navegador.';
      feedback.dataset.error = 'true';
    }
  });
  readSaved(); applyAppearance();
})();
