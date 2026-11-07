(() => {
  'use strict';
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;
  let session;
  function startSession() { try {
    session = sessionStorage.getItem('jm-visit');
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem('jm-visit', session);
    }
  } catch {
    session = crypto.randomUUID();
  } }
  const send = (type, project = '') => {
    if (window.jmAnalyticsAllowed !== true) return;
    if (!session) startSession();
    const body = JSON.stringify({
      id: crypto.randomUUID(),
      session,
      type,
      project,
      referrer: document.referrer,
    });
    fetch('/api/analytics', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});
  };
  send('page_view');
  window.addEventListener('jm-privacy-change', () => {
    if (!window.jmAnalyticsAllowed) { session = undefined; return; }
    send('page_view');
  });
  document.addEventListener('click', (event) => {
    const project = event.target.closest('[data-service]');
    if (project) send('project_view', project.dataset.service);
    const link = event.target.closest('a[href]');
    if (
      link &&
      /^(mailto:|tel:|https:\/\/(wa\.me|api\.whatsapp\.com)\/)/i.test(link.href)
    )
      send('contact_click');
  });
})();
