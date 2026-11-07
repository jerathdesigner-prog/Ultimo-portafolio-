(() => {
  'use strict';
  const blocked = navigator.doNotTrack === '1' || navigator.globalPrivacyControl;
  let version;
  let state = { analytics: false, decided: false };
  let pending = false;
  const ready = fetch('/api/consent', { credentials: 'same-origin', cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw Error('No se pudieron consultar las preferencias.');
      state = await response.json();
      version = state.version;
      return state;
    });
  // There is no analytics script request, ID or storage until an explicit choice.
  function syncAnalytics() {
    window.jmAnalyticsAllowed = !!state.analytics && !blocked;
    window.dispatchEvent(new Event('jm-privacy-change'));
    if (window.jmAnalyticsAllowed && !document.getElementById('jm-analytics-script')) {
      const script = document.createElement('script');
      script.id = 'jm-analytics-script';
      script.src = '/static/analytics.js?v=2';
      document.head.append(script);
    }
    if (!window.jmAnalyticsAllowed) {
      try { sessionStorage.removeItem('jm-visit'); } catch { /* Storage may be disabled. */ }
    }
  }
  const box = document.createElement('aside');
  box.id = 'jm-privacy-banner';
  box.className = 'jm-privacy-banner';
  box.hidden = true;
  box.setAttribute('aria-label', 'Preferencias de privacidad');
  box.innerHTML = '<h2>Cookies y privacidad</h2><p>La analítica es opcional. Puedes aceptarla, rechazarla o cambiar tu elección al pie de la web.</p><p><a href="/legal/cookies" target="_blank" rel="noopener">Ver política de cookies</a></p><div class="jm-privacy-actions"><button type="button" data-choice="false">Solo necesarias</button><button type="button" data-choice="true">Aceptar analítica</button></div><button class="jm-privacy-close" type="button" aria-label="Cerrar aviso sin aceptar">×</button><p role="status" class="jm-privacy-status"></p>';
  document.body.append(box);
  const status = box.querySelector('[role="status"]');
  const buttons = [...box.querySelectorAll('[data-choice]')];
  if (blocked) {
    box.querySelector('p').textContent = 'Tu navegador pide no ser rastreado. Respetamos esa señal: la analítica permanece desactivada.';
    buttons[1].disabled = true;
  }
  function show() { box.hidden = false; }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-privacy-settings]')) { show(); buttons[0].focus(); }
  });
  box.querySelector('.jm-privacy-close').addEventListener('click', () => { box.hidden = true; });
  async function record(body) {
    await ready;
    const response = await fetch('/api/consent', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, version }),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.detail || 'No se pudo guardar tu elección.');
    return result;
  }
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (pending) return;
    pending = true;
    buttons.forEach(item => { item.disabled = true; });
    status.textContent = 'Guardando tu elección…';
    // Stop sending immediately, even if persisting a withdrawal fails.
    state.analytics = false;
    syncAnalytics();
    try {
      const result = await record({ purpose: 'cookies', analytics: button.dataset.choice === 'true' && !blocked });
      state = { ...result, decided: true };
      syncAnalytics();
      status.textContent = 'Elección guardada. Puedes cambiarla al pie de la web.';
      box.hidden = true;
      document.querySelector('[data-privacy-settings]')?.focus({ preventScroll: true });
    } catch (error) {
      status.textContent = error.message + ' La analítica sigue apagada en esta página.';
    } finally {
      pending = false;
      buttons.forEach(item => { item.disabled = blocked && item.dataset.choice === 'true'; });
    }
  }));
  window.jmRecordBriefAcceptance = async method => {
    const form = document.getElementById('brief-form');
    if (!form.reportValidity()) return null;
    return record({ purpose: 'brief', method, terms: form.elements.terms.checked, privacy: form.elements.privacy.checked });
  };
  ready.then(() => { syncAnalytics(); if (!state.decided) show(); })
    .catch(() => { syncAnalytics(); show(); status.textContent = 'No se pudieron consultar las preferencias. La analítica permanece apagada.'; });
})();
