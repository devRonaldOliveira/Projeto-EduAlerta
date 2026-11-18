// Painel de notificações compartilhado. O estado vive apenas na página atual.
(() => {
  'use strict';
  const button = document.getElementById('notifications-button');
  const panel = document.getElementById('notifications-panel');
  if (!button || !panel) return;

  panel.classList.add('notifications-panel');
  panel.setAttribute('role','region');
  panel.setAttribute('aria-label','Notificações');
  panel.replaceChildren();
  const heading = document.createElement('div');
  heading.className = 'notifications-panel-heading';
  const headingTitle = document.createElement('strong');
  headingTitle.textContent = 'Notificações';
  const headingCaption = document.createElement('span');
  headingCaption.textContent = 'Central de avisos';
  heading.append(headingTitle,headingCaption);
  const state = document.createElement('p');
  state.className = 'notification-state';
  state.setAttribute('role','status');
  state.setAttribute('aria-live','polite');
  state.hidden = true;
  const list = document.createElement('div');
  list.className = 'notification-list';
  list.setAttribute('role','list');
  const empty = document.createElement('p');
  empty.className = 'notification-empty';
  empty.textContent = 'Nenhuma notificação disponível no momento.';
  panel.append(heading,state,list,empty);
  let unreadCount = button.querySelector('[data-notification-count]');
  if (!unreadCount) {
    unreadCount = document.createElement('span');
    unreadCount.className = 'notification-count';
    unreadCount.dataset.notificationCount = '';
    unreadCount.hidden = true;
    button.append(unreadCount);
  }
  const dot = button.querySelector('.notification-dot');
  let notifications = [];
  let localId = 0;

  const text = (value) => value === undefined || value === null ? '' : String(value);
  const categoryOf = (item) => {
    const type = text(item.tipo ?? item.type).toLowerCase().replace(/[\s-]+/g, '_');
    if (['retorno', 'return', 'retorno_agendado'].includes(type)) return 'retorno';
    if (['acompanhamento', 'followup', 'acompanhamento_pendente'].includes(type)) return 'acompanhamento';
    return 'frequencia';
  };
  const categoryLabel = (category) => ({
    frequencia: 'Alerta de frequência',
    acompanhamento: 'Acompanhamento pendente',
    retorno: 'Retorno agendado'
  })[category];

  function render() {
    const unread = notifications.filter((item) => !item.lida).length;
    unreadCount.textContent = unread > 99 ? '99+' : String(unread);
    unreadCount.hidden = unread === 0;
    unreadCount.setAttribute('aria-label', unread === 1 ? '1 notificação não lida' : `${unread} notificações não lidas`);
    if (dot) dot.hidden = true;
    list.replaceChildren();
    empty.hidden = notifications.length > 0;
    for (const item of notifications) {
      const category = categoryOf(item);
      const card = document.createElement('article');
      card.className = `notification-item${item.lida ? '' : ' is-unread'}`;
      card.setAttribute('role', 'listitem');
      const heading = document.createElement('div');
      heading.className = 'notification-item-heading';
      const categoryText = document.createElement('span');
      categoryText.className = `notification-category ${category}`;
      categoryText.textContent = categoryLabel(category);
      heading.append(categoryText);
      if (item.data || item.date) {
        const time = document.createElement('time');
        time.textContent = text(item.data ?? item.date);
        heading.append(time);
      }
      card.append(heading);
      const title = document.createElement('strong');
      title.className = 'notification-title';
      title.textContent = text(item.titulo ?? item.title) || categoryLabel(category);
      card.append(title);
      const description = document.createElement('p');
      description.className = 'notification-description';
      description.textContent = text(item.descricao ?? item.message) || 'Detalhes indisponíveis.';
      card.append(description);

      const actions = document.createElement('div');
      actions.className = 'notification-item-actions';
      const studentId = item.studentId ?? item.alunoId ?? item.estudanteId ?? item.matricula;
      if (studentId !== undefined && studentId !== null && String(studentId).trim()) {
        const link = document.createElement('a');
        link.href = `perfil-aluno.html?id=${encodeURIComponent(String(studentId))}`;
        link.textContent = 'Ver perfil';
        actions.append(link);
      }
      if (!item.lida) {
        const markRead = document.createElement('button');
        markRead.type = 'button';
        markRead.textContent = 'Marcar como lida';
        markRead.addEventListener('click', () => {
          item.lida = true;
          document.dispatchEvent(new CustomEvent('edualerta:notification-read',{detail:{id:item.id}}));
          render();
        });
        actions.append(markRead);
      } else {
        const readLabel = document.createElement('span');
        readLabel.className = 'notification-read-label';
        readLabel.textContent = 'Lida';
        actions.append(readLabel);
      }
      card.append(actions);
      list.append(card);
    }
  }

  function setNotificacoes(items) {
    if (!Array.isArray(items)) throw new TypeError('setNotificacoes espera uma lista.');
    notifications = items.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
      .map((item) => ({...item, lida: item.lida === true || item.read === true}));
    state.hidden = true;
    state.removeAttribute('data-error');
    render();
  }

  window.EduAlertaNotificacoes = Object.freeze({
    setNotificacoes,
    setCarregando() {
      notifications = [];
      state.textContent = 'Carregando notificações…';
      state.removeAttribute('data-error');
      state.hidden = false;
      empty.hidden = true;
    },
    setErro(message) {
      notifications = [];
      state.textContent = text(message) || 'Não foi possível carregar as notificações.';
      state.dataset.error = 'true';
      state.hidden = false;
      empty.hidden = true;
    },
    adicionarPrevia(item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError('A notificação precisa ser um objeto.');
      }
      notifications.unshift({...item, id: item.id ?? `preview-${++localId}`, lida: false, previa: true});
      state.hidden = true;
      state.removeAttribute('data-error');
      render();
    }
  });
  render();
})();
