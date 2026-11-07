(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const ICON = {
    overview:
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    services:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
    projects:
      '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/>',
    media:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M8 6h10v10M18 6 7 17M5 5h5M5 5v14h14v-5"/>',
    edit: '<path d="m14 4 6 6M4 20l4-.8L20 7.2 16.8 4 4.8 16z"/>',
    trash: '<path d="M4 7h16M10 4h4M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
    up: '<path d="m5 14 7-7 7 7"/>',
    down: '<path d="m5 10 7 7 7-7"/>',
    logout:
      '<path d="M10 17l5-5-5-5M15 12H3M13 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
    video:
      '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3"/>',
    audio:
      '<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    eye: '<path d="M2 12c3-5 6-7 10-7s7 2 10 7c-3 5-6 7-10 7s-7-2-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M17 8h4M3 16h4M17 16h4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
  };
  const ico = (n) =>
    `<svg aria-hidden="true" viewBox="0 0 24 24">${ICON[n] || ICON.layers}</svg>`;
  const E = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  const store = {
    data: { services: [], projects: [], media: [] },
    view: 'overview',
    filter: 'all',
    search: '',
    editor: null,
    pickTarget: '',
    loading: false,
    uploading: false,
    saving: false,
    storage: null,
    storageError: null,
  };
  const fromData = (id) => store.data.media.find((x) => x.id === id);
  const fromService = (id) => store.data.services.find((x) => x.id === id);
  const sizeText = (n) =>
    n > 1048576
      ? (n / 1048576).toFixed(1) + ' MB'
      : (n / 1024).toFixed(0) + ' KB';
  const sortByOrder = (a, b) => a.order - b.order;
  function toast(text, error = false) {
    const wrap = $('#toastContainer'),
      box = document.createElement('div');
    box.className = 'toast' + (error ? ' error' : '');
    if (error) box.setAttribute('role', 'alert');
    box.textContent = text;
    wrap.append(box);
    setTimeout(() => box.remove(), 4700);
  }
  async function api(url, method = 'GET', data) {
    const opt = { method, credentials: 'same-origin', headers: {} };
    if (data !== undefined) {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(data);
    }
    let r;
    try {
      r = await fetch(url, opt);
    } catch {
      throw new Error('No se pudo conectar con el servidor.');
    }
    let json;
    try {
      json = await r.json();
    } catch {
      json = {};
    }
    if (!r.ok) throw Error(json.detail || `Error HTTP ${r.status}`);
    return json;
  }
  async function refresh() {
    store.data = await api('/api/admin/state');
    render();
    if (store.view === 'media') loadStorage();
  }
  function switchLogin(yes) {
    $('#loginScreen').hidden = yes;
    $('#dashboard').hidden = !yes;
    if (yes) {
      render();
    } else {
      $('#loginPass').value = '';
      $('#loginMessage').textContent = '';
    }
  }
  async function init() {
    window.addEventListener('beforeunload', (e) => {
      if (store.editor) {
        syncEditorFromForm();
        if (JSON.stringify(store.editor.draft) !== store.editor.initial) {
          e.preventDefault();
          e.returnValue = '';
        }
      }
    });
    const navTitles = [
      ['overview', 'Resumen', 'overview'],
      ['services', 'Servicios', 'services'],
      ['projects', 'Proyectos', 'projects'],
      ['media', 'Biblioteca', 'media'],
      ['metrics', 'Métricas', 'layers'],
    ];
    navTitles.forEach(([id, name, ic]) => {
      const b = $(`[data-view="${id}"]`);
      b.innerHTML = ico(ic) + `<span>${name}</span>`;
    });
    $('#logoutBtn').innerHTML = ico('logout') + ' Cerrar sesión';
    $('#siteLinkIcon').innerHTML = ico('external');
    $('#loginForm').addEventListener('submit', login);
    $('#togglePassword').addEventListener('click', () => {
      const show = $('#loginPass').type === 'password';
      $('#loginPass').type = show ? 'text' : 'password';
      $('#togglePassword').setAttribute(
        'aria-label',
        show ? 'Ocultar contraseña' : 'Mostrar contraseña',
      );
      $('#togglePassword').setAttribute('aria-pressed', String(show));
    });
    $$('[data-view]').forEach((el) =>
      el.addEventListener('click', () => setView(el.dataset.view)),
    );
    $('#logoutBtn').addEventListener('click', logout);
    $('#mobileMenu').addEventListener('click', () =>
      setMobileMenu(!$('#sidebar').classList.contains('mobile-open')),
    );
    $('#mobileBackdrop').addEventListener('click', () =>
      setMobileMenu(false, true),
    );
    const mobileLayout = matchMedia('(max-width: 720px)');
    mobileLayout.addEventListener('change', () => setMobileMenu(false));
    setMobileMenu(false);
    $('#closeDrawer').addEventListener('click', () => closeEditor());
    $('#cancelEditor').addEventListener('click', () => closeEditor());
    $('#drawerBackdrop').addEventListener('click', () => closeEditor());
    $('#hiddenFilePicker').addEventListener('change', (e) => {
      handleFiles([...e.target.files]);
      e.target.value = '';
    });
    $('#main').addEventListener('click', actionClick);
    $('#main').addEventListener('input', mainInput);
    $('#main').addEventListener('change', mainChange);
    $('#drawerBody').addEventListener('click', drawerClick);
    $('#drawerBody').addEventListener('change', drawerChange);
    $('#drawerBody').addEventListener('dragover', (e) => {
      if (e.target.closest('.dropzone')) {
        e.preventDefault();
        e.target.closest('.dropzone').classList.add('dragover');
      }
    });
    $('#drawerBody').addEventListener('dragleave', (e) => {
      e.target.closest('.dropzone')?.classList.remove('dragover');
    });
    $('#drawerBody').addEventListener('drop', (e) => {
      const zone = e.target.closest('.dropzone');
      if (zone) {
        e.preventDefault();
        zone.classList.remove('dragover');
        handleFiles([...e.dataTransfer.files]);
      }
    });
    document.addEventListener('keydown', (e) => {
      const menuOpen = $('#sidebar').classList.contains('mobile-open');
      if (e.key === 'Tab' && (store.editor || menuOpen)) {
        const root = store.editor ? $('.editor-drawer') : $('#sidebar');
        const focusable = $$(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
          root,
        ).filter((el) => el.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if (e.key === 'Escape' && store.editor) closeEditor();
      else if (e.key === 'Escape' && menuOpen) setMobileMenu(false, true);
    });
    try {
      await api('/api/session');
      await refresh();
      switchLogin(true);
      setView(location.hash.slice(1) || 'overview');
    } catch {
      switchLogin(false);
    }
  }
  async function login(e) {
    e.preventDefault();
    const b = $('#loginBtn');
    b.disabled = true;
    b.textContent = 'Verificando acceso…';
    try {
      await api('/api/login', 'POST', {
        username: $('#loginUser').value.trim(),
        password: $('#loginPass').value,
      });
      await refresh();
      switchLogin(true);
      setView(location.hash.slice(1) || 'overview');
      toast('Bienvenido a tu estudio.');
    } catch (err) {
      $('#loginMessage').textContent = err.message;
    } finally {
      b.disabled = false;
      b.innerHTML = 'Entrar al estudio <span>↗</span>';
    }
  }
  async function logout() {
    const button = $('#logoutBtn');
    button.disabled = true;
    try {
      await api('/api/logout', 'POST');
      closeEditor(true);
      setMobileMenu(false);
      switchLogin(false);
      $('#loginUser').focus();
    } catch (err) {
      toast(err.message, true);
    } finally {
      button.disabled = false;
    }
  }
  function setMobileMenu(open, restoreFocus = false) {
    const mobile = matchMedia('(max-width: 720px)').matches;
    open = mobile && open;
    $('#sidebar').classList.toggle('mobile-open', open);
    $('#sidebar').inert = mobile && !open;
    $('.workspace').inert = open;
    $('#mobileBackdrop').hidden = !open;
    $('#mobileMenu').setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open || store.editor ? 'hidden' : '';
    if (open) $('#mainNav button').focus();
    else if (restoreFocus) $('#mobileMenu').focus();
  }
  function setView(v) {
    store.view = [
      'overview',
      'services',
      'projects',
      'media',
      'metrics',
    ].includes(v)
      ? v
      : 'overview';
    store.search = '';
    store.filter = 'all';
    setMobileMenu(false);
    render();
    if (v === 'media') loadStorage();
    if (v === 'metrics') loadMetrics();
    $('#main').focus();
    history.replaceState(null, '', '#' + store.view);
  }
  function render() {
    const names = {
      overview: 'Resumen',
      services: 'Servicios',
      projects: 'Proyectos',
      media: 'Biblioteca',
      metrics: 'Métricas',
    };
    $('#viewCrumb').textContent = names[store.view];
    $$('[data-view]').forEach(
      (b) => (
        b.classList.toggle('active', b.dataset.view === store.view),
        b.setAttribute(
          'aria-current',
          b.dataset.view === store.view ? 'page' : 'false',
        )
      ),
    );
    $('#main').innerHTML =
      store.view === 'overview'
        ? renderOverview()
        : store.view === 'services'
          ? renderServices()
          : store.view === 'projects'
            ? renderProjects()
            : store.view === 'metrics'
              ? renderMetrics()
              : renderLibrary();
  }
  function head(k, title, subtitle, action = '', name = '') {
    return `<div class="section-heading"><div><p class="eyebrow">${k}</p><h1>${title}</h1><p class="sub">${subtitle}</p></div>${action ? `<div class="section-actions"><button class="btn primary" data-action="${action}">${ico('plus')} ${name}</button></div>` : ''}</div>`;
  }
  function stats() {
    const s = store.data.services,
      p = store.data.projects,
      m = store.data.media;
    const data = [
      ['Servicios', s.length, 'services', 'Áreas creativas'],
      ['Proyectos', p.length, 'projects', 'Trabajos de portafolio'],
      ['Archivos', m.length, 'media', 'Fotos, video, GIF y audio'],
    ];
    return `<div class="stats">${data.map((x) => `<div class="stat-card"><div class="stat-icon">${ico(x[2])}</div><div class="stat-label">${x[0]}</div><div class="stat-value">${x[1]}</div><div class="stat-mini">${x[3]}</div></div>`).join('')}</div>`;
  }
  function avatar(m, cls = 'item-icon') {
    if (!m) return `<div class="${cls}">${ico('layers')}</div>`;
    if (m.kind === 'image')
      return `<div class="${cls}"><img src="${E(m.url)}" alt="" loading="lazy"/></div>`;
    if (m.kind === 'video') return `<div class="${cls}">${ico('video')}</div>`;
    return `<div class="${cls}">${ico('audio')}</div>`;
  }
  function projectRows(items) {
    const filtered =
      store.view === 'projects' && (store.search || store.filter !== 'all');
    return `<div class="list-card">${
      items.length
        ? items
            .map((p) => {
              const svc = fromService(p.serviceId);
              const media =
                fromData(p.coverMediaId) ||
                fromData((p.media || [])[0]?.mediaId);
              return `<div class="table-row">${avatar(media)}<div class="item-main"><span class="item-title">${E(p.title)}</span><div class="item-meta">${E(svc?.title || 'Sin servicio')} · ${(p.media || []).length} archivos</div></div><div class="item-right"><span class="status-badge ${p.published ? '' : 'draft'}">${p.published ? 'Publicado' : 'Oculto'}</span>${store.view === 'projects' ? `<button type="button" class="icon-action" data-action="move-project-up" data-id="${E(p.id)}" aria-label="Subir proyecto">${ico('up')}</button><button type="button" class="icon-action" data-action="move-project-down" data-id="${E(p.id)}" aria-label="Bajar proyecto">${ico('down')}</button>` : ''}<button type="button" class="icon-action" data-action="edit-project" data-id="${E(p.id)}" aria-label="Editar ${E(p.title)}">${ico('edit')}</button></div></div>`;
            })
            .join('')
        : filtered
          ? `<div class="empty"><div class="empty-icon">${ico('search')}</div><h2>No hay resultados</h2><p>Prueba otro nombre o limpia los filtros para ver todos tus proyectos.</p><button class="btn secondary" data-action="clear-filters">Limpiar filtros</button></div>`
          : `<div class="empty"><div class="empty-icon">${ico('projects')}</div><h2>Aún no hay proyectos</h2><p>Sube tu primer proyecto para empezar a mostrar tu trabajo.</p><button class="btn primary" data-action="new-project">${ico('plus')} Crear proyecto</button></div>`
    }</div>`;
  }
  function renderOverview() {
    const items = [...store.data.projects]
      .sort((a, b) => b.order - a.order)
      .slice(0, 6);
    const previews = items
      .slice(0, 3)
      .map((p) => {
        const media =
          fromData(p.coverMediaId) || fromData(p.media?.[0]?.mediaId);
        return `<div class="overview-preview">${avatar(media, 'preview-art')}<span>${E(p.title)}</span></div>`;
      })
      .join('');
    return (
      head(
        'TU ESTUDIO',
        'Hola, Jerath.',
        'Todo tu portafolio bajo control, en un solo lugar.',
      ) +
      `<div class="overview-intro"><div class="welcome-card"><div class="welcome-copy"><h2>Tus ideas merecen estar a la vista.</h2><p>Organiza tus servicios, agrega videos y fotografías, y publica los cambios cuando quieras.</p><button class="btn primary" data-action="new-project">${ico('plus')} Nuevo proyecto</button></div>${previews ? `<div class="overview-previews" aria-label="Vista previa de tus proyectos">${previews}</div>` : ''}</div>${stats()}</div><div class="subsection-heading"><h2>Proyectos recientes</h2><span>${store.data.projects.length} en total</span></div>` +
      projectRows(items)
    );
  }
  function renderServices() {
    let services = [...store.data.services].sort(sortByOrder);
    return (
      head(
        'ORGANIZA TU OFERTA',
        'Servicios',
        'Agrega, edita, reordena u oculta categorías. Los proyectos se agrupan automáticamente dentro de cada servicio.',
        'new-service',
        'Nuevo servicio',
      ) +
      (services.length
        ? `<div class="service-grid">${services
            .map((s, i) => {
              const m = fromData(s.coverMediaId);
              const count = store.data.projects.filter(
                (p) => p.serviceId === s.id,
              ).length;
              return `<article class="service-card"><button type="button" class="service-cover" data-action="edit-service" data-id="${E(s.id)}" aria-label="Editar servicio ${E(s.title)}" title="Haz clic para editar este servicio">${m ? (m.kind === 'image' ? `<img src="${E(m.url)}" alt=""/>` : m.kind === 'video' ? `<video src="${E(m.url)}" preload="metadata" muted></video>` : `<span class="initials">✳</span>`) : `<span class="initials">${E(s.title.slice(0, 2).toUpperCase())}</span>`}<span class="service-num">${String(i + 1).padStart(2, '0')}</span><span class="cover-type">${s.focus === 'video' ? 'Video / Reels' : 'Diseño / Visual'}</span><span class="cover-edit-hint">✎ Editar</span></button><div class="service-content"><h3>${E(s.title)}</h3><p>${E(s.subtitle)}</p><span class="status-badge ${s.published ? '' : 'draft'}">${s.published ? 'Visible' : 'Oculto'}</span></div><div class="service-bottom"><span class="tiny">${count} proyectos</span><div style="display:flex;gap:5px"><button class="icon-action" data-action="move-service-up" data-id="${E(s.id)}" title="Mover a la izquierda" aria-label="Mover antes">${ico('up')}</button><button class="icon-action" data-action="move-service-down" data-id="${E(s.id)}" title="Mover a la derecha" aria-label="Mover después">${ico('down')}</button><button class="btn secondary" data-action="edit-service" data-id="${E(s.id)}">Editar ${ico('edit')}</button></div></div></article>`;
            })
            .join('')}</div>`
        : `<div class="empty"><div class="empty-icon">${ico('services')}</div><h2>Aún no hay servicios</h2><p>Crea un servicio para organizar los proyectos de tu portafolio.</p><button class="btn primary" data-action="new-service">${ico('plus')} Crear servicio</button></div>`)
    );
  }
  function renderProjects() {
    let projects = [...store.data.projects].sort(
      (a, b) => a.serviceId.localeCompare(b.serviceId) || a.order - b.order,
    );
    const opts = store.data.services
      .map(
        (s) =>
          `<option value="${E(s.id)}" ${store.filter === s.id ? 'selected' : ''}>${E(s.title)}</option>`,
      )
      .join('');
    if (store.filter !== 'all')
      projects = projects.filter((p) => p.serviceId === store.filter);
    if (store.search)
      projects = projects.filter((p) =>
        (p.title + ' ' + p.description)
          .toLowerCase()
          .includes(store.search.toLowerCase()),
      );
    return (
      head(
        'TU PORTAFOLIO',
        'Proyectos',
        'Cada trabajo incluye una portada, su descripción y una galería sin límite de longitud predeterminado.',
        'new-project',
        'Nuevo proyecto',
      ) +
      `<div class="toolbar"><div class="search-box">${ico('search')}<input aria-label="Buscar proyectos" id="searchInput" placeholder="Buscar trabajo…" value="${E(store.search)}" autocomplete="off"/></div><select aria-label="Filtrar por servicio" id="filterService" class="field-select"><option value="all">Todos los servicios</option>${opts}</select></div>` +
      projectRows(projects)
    );
  }
  function storagePanel() {
    return `<section class="storage-panel" aria-labelledby="r2title"><div class="storage-head"><div><p class="eyebrow">ALMACENAMIENTO · CLOUDFLARE R2</p><h2 id="r2title">Espacio de tus archivos</h2></div><button type="button" data-action="refresh-storage" class="storage-reload">Actualizar uso</button></div><div class="storage-numbers"><strong id="storageUsed">Consultando…</strong><span id="storageLeft">Referencia gratuita: 10 GB-mes</span></div><div class="storage-track" id="storageTrack" role="progressbar" aria-label="Uso frente a la referencia gratuita de R2" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div id="storageFill" class="storage-fill"></div></div><div class="storage-bottom"><span id="storageCount">Calculando archivos en R2…</span><span id="storagePercent">—</span></div><p class="storage-disclaimer">Se cuentan los archivos almacenados realmente en este bucket. La cuota gratuita de R2 Standard es de 10 GB-mes, no un límite fijo de espacio. El cobro depende del promedio de almacenamiento y de las operaciones; revisa la facturación oficial para el consumo mensual.</p></section>`;
  }
  function mediaGuide() {
    return `<section class="media-guide" aria-labelledby="mediaGuideTitle"><div class="media-guide-heading"><div><p class="eyebrow">GUÍA DE EXPORTACIÓN</p><h2 id="mediaGuideTitle">Tamaños recomendados</h2></div><span>Calidad · Velocidad · Lectura</span></div><div class="media-guide-grid"><article><b>Portada de servicio</b><strong>1640 × 624 px</strong><p>WebP o JPG · ideal hasta 1,5 MB</p></article><article><b>Portada de proyecto</b><strong>1920 × 1240 px</strong><p>WebP o JPG · ideal 2–4 MB</p></article><article><b>Foto de galería</b><strong>1600–2400 px</strong><p>Ancho recomendado · ideal 1–3 MB</p></article><article><b>GIF animado</b><strong>960 × 540 px</strong><p>Ideal 2–8 MB; para GIF largos, usa MP4</p></article><article><b>Video horizontal</b><strong>1920 × 1080 px</strong><p>MP4 H.264 · ideal 15–60 MB</p></article><article><b>Video vertical / reel</b><strong>1080 × 1920 px</strong><p>MP4 H.264 · ideal 15–50 MB</p></article></div><p class="media-guide-note"><b>Subida:</b> para evitar errores en el plan Free, mantén cada archivo por debajo de 90 MB. La aplicación actual permite archivos de hasta 100 MiB, pero Cloudflare puede rechazar solicitudes mayores de 100 MB. Las medidas en píxeles son recomendaciones, no dimensiones obligatorias.</p></section>`;
  }
  function updateStoragePanel() {
    const panel = $('.storage-panel');
    if (!panel) return;
    const st = store.storage;
    if (store.storageError) {
      $('#storageUsed').textContent = 'No se pudo consultar R2';
      $('#storageLeft').textContent = store.storageError;
      $('#storageCount').textContent =
        'Pulsa «Actualizar uso» para volver a intentar';
      $('#storagePercent').textContent = '—';
      return;
    }
    if (!st) return;
    const used = (st.usedBytes / 1e9).toFixed(st.usedBytes >= 1e9 ? 2 : 3),
      percent = (100 * st.usedBytes) / st.referenceBytes;
    $('#storageUsed').textContent = st.complete
      ? `${used} GB usados`
      : `Al menos ${used} GB`;
    $('#storageLeft').textContent = st.complete
      ? `${(Math.max(0, st.remainingBytes) / 1e9).toFixed(2)} GB hasta referencia gratuita`
      : 'Listado parcial: el valor restante no esta disponible';
    $('#storageFill').style.width = Math.min(100, percent) + '%';
    $('#storageTrack').setAttribute(
      'aria-valuenow',
      String(Math.min(100, Math.round(percent))),
    );
    $('#storageCount').textContent =
      `${st.objects.toLocaleString('es-EC')} archivo(s) en R2` +
      (st.complete ? '' : ' (listado parcial)');
    $('#storagePercent').textContent = st.complete
      ? `${percent.toFixed(2)}% de referencia`
      : 'Consulta parcial';
    panel.classList.toggle('storage-high', percent >= 85);
  }
  async function loadStorage() {
    if (store.view !== 'media') return;
    store.storageError = null;
    try {
      store.storage = await api('/api/admin/storage');
    } catch (err) {
      store.storageError = err.message;
    }
    updateStoragePanel();
  }
  function renderLibrary() {
    let media = store.data.media;
    const notice =
      '<div class="hint-box">Los originales se almacenan en Cloudflare R2. Puedes eliminarlos definitivamente desde aquí. Si un archivo se usa en un proyecto, también se retirará de esa galería.</div>';
    return (
      head(
        'ARCHIVOS Y RECURSOS',
        'Biblioteca',
        'Fotografías, GIF, videos y pistas de audio almacenados en tu servidor.',
        'upload-library',
        'Subir archivos',
      ) +
      storagePanel() +
      mediaGuide() +
      notice +
      (media.length
        ? `<div class="library-grid">${media.map((m) => `<article class="media-card"><div class="media-thumb">${m.kind === 'image' ? `<img loading="lazy" alt="${E(m.filename)}" src="${E(m.url)}"/>` : ico(m.kind === 'video' ? 'video' : 'audio')}</div><div class="media-info"><strong title="${E(m.filename)}">${E(m.filename)}</strong><small>${E(m.kind)} · ${sizeText(m.bytes)}</small></div><div class="media-actions"><a href="${E(m.url)}" target="_blank" rel="noopener noreferrer">Ver ↗</a><button aria-label="Eliminar archivo ${E(m.filename)}" data-action="delete-media" data-id="${E(m.id)}">${ico('trash')}</button></div></article>`).join('')}</div>`
        : `<div class="empty"><h3>No hay archivos aún</h3><button class="btn primary" data-action="upload-library">Subir mi primer archivo</button></div>`)
    );
  }
  function mainInput(e) {
    if (e.target.id === 'searchInput') {
      const pos = e.target.selectionStart;
      store.search = e.target.value;
      render();
      const box = $('#searchInput');
      box.focus();
      box.setSelectionRange(pos, pos);
    }
  }
  function mainChange(e) {
    if (e.target.id === 'filterService') {
      store.filter = e.target.value;
      render();
      $('#filterService').focus();
    }
  }
  async function actionClick(e) {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action,
      id = b.dataset.id;
    try {
      if (a === 'clear-filters') {
        store.search = '';
        store.filter = 'all';
        render();
        $('#searchInput').focus();
        return;
      }
      if (a === 'metrics-period') {
        metricsDays = Number(b.dataset.days);
        render();
        await loadMetrics();
        return;
      }
      if (a === 'refresh-metrics') {
        await loadMetrics();
        return;
      }
      if (a === 'new-service') openEditor('service');
      else if (a === 'edit-service') openEditor('service', id);
      else if (a === 'new-project') openEditor('project');
      else if (a === 'edit-project') openEditor('project', id);
      else if (a === 'delete-service') await deleteItem('services', id);
      else if (a === 'delete-project') await deleteItem('projects', id);
      else if (a === 'delete-media') await deleteItem('media', id);
      else if (a === 'move-service-up' || a === 'move-service-down')
        await moveItem('services', id, a.endsWith('up') ? -1 : 1);
      else if (a === 'move-project-up' || a === 'move-project-down')
        await moveItem('projects', id, a.endsWith('up') ? -1 : 1);
      else if (a === 'upload-library') {
        store.pickTarget = 'library';
        $('#hiddenFilePicker').click();
      } else if (a === 'refresh-storage') await loadStorage();
    } catch (err) {
      toast(err.message, true);
    }
  }
  async function deleteItem(type, id) {
    let item = store.data[type].find((x) => x.id === id);
    if (!item) return;
    const name = item.title || item.filename;
    let msg =
      type === 'services'
        ? `¿Eliminar «${name}» y sus proyectos? Los archivos se conservarán en la biblioteca.`
        : type === 'media'
          ? `¿Eliminar permanentemente «${name}» del servidor? Desaparecerá de cualquier proyecto que lo utilice.`
          : `¿Eliminar definitivamente el proyecto «${name}»? Los archivos permanecerán en la biblioteca.`;
    if (!confirm(msg)) return;
    await api(`/api/admin/${type}/${id}`, 'DELETE');
    await refresh();
    toast('Elemento eliminado.');
    if (store.editor?.originalId === id) closeEditor(true);
  }
  async function moveItem(type, id, dir) {
    let list = [...store.data[type]];
    if (type === 'projects') {
      const current = list.find((x) => x.id === id);
      if (current) list = list.filter((x) => x.serviceId === current.serviceId);
    }
    list.sort(sortByOrder);
    const i = list.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const a = list[i],
      b = list[j],
      orderA = a.order,
      orderB = b.order;
    if (orderA === orderB) {
      await api(`/api/admin/${type}/${b.id}`, 'PUT', {
        order: orderA + (dir > 0 ? 0.1 : -0.1),
      });
      await refresh();
      return;
    }
    await api(`/api/admin/${type}/${a.id}`, 'PUT', { order: orderB });
    await api(`/api/admin/${type}/${b.id}`, 'PUT', { order: orderA });
    await refresh();
    toast('Orden actualizado.');
  }
  function mediaChoice(cover) {
    const m = fromData(cover);
    return `<select name="coverMediaId" id="coverSelect"><option value="">Sin portada personalizada</option>${store.data.media
      .filter((x) => x.kind !== 'audio')
      .map(
        (x) =>
          `<option value="${E(x.id)}" ${cover === x.id ? 'selected' : ''}>${E(x.filename)} (${E(x.kind)})</option>`,
      )
      .join(
        '',
      )}</select>${m ? `<div class="cover-picker" style="margin-top:12px">${avatar(m, 'cover-thumbnail')}<span><strong>${E(m.filename)}</strong><small>Portada seleccionada</small></span></div>` : ''}<button type="button" class="mini-link" data-action="upload-cover">${ico('upload')} Subir una portada nueva</button>`;
  }
  function openEditor(type, id) {
    const data = type === 'service' ? store.data.services : store.data.projects;
    const original = id ? data.find((x) => x.id === id) : null;
    let draft = original
      ? structuredClone(original)
      : type === 'service'
        ? {
            title: '',
            subtitle: '',
            tag: 'ENFOQUE',
            keywords: '',
            focus: 'visual',
            coverMediaId: null,
            published: true,
          }
        : {
            title: '',
            description: '',
            tag: 'Proyecto',
            serviceId: store.data.services[0]?.id || '',
            coverMediaId: null,
            media: [],
            published: true,
          };
    if (type === 'project' && !store.data.services.length) {
      toast('Primero crea un servicio.', true);
      return;
    }
    store.editor = {
      type,
      originalId: id || null,
      draft,
      initial: JSON.stringify(draft),
      returnFocus: document.activeElement,
    };
    $('#dashboard').inert = true;
    $('#editorOverlay').hidden = false;
    document.body.style.overflow = 'hidden';
    renderEditor();
    syncEditorFromForm();
    store.editor.initial = JSON.stringify(store.editor.draft);
    $('#title')?.focus();
  }
  function closeEditor(force = false) {
    if (!force && (store.uploading || store.saving)) {
      toast(
        'Espera a que termine la operación antes de cerrar el editor.',
        true,
      );
      return;
    }
    if (store.editor && !force) {
      syncEditorFromForm();
      if (
        JSON.stringify(store.editor.draft) !== store.editor.initial &&
        !confirm('Tienes cambios sin guardar. ¿Descartarlos?')
      )
        return;
    }
    const returnFocus = store.editor?.returnFocus;
    store.editor = null;
    $('#dashboard').inert = false;
    if (returnFocus?.isConnected) returnFocus.focus();
    else $('#main').focus();
    $('#editorOverlay').hidden = true;
    document.body.style.overflow = '';
  }
  function renderEditor() {
    const ed = store.editor;
    if (!ed) return;
    let p = ed.draft,
      service = ed.type === 'service';
    $('#editorEyebrow').textContent = service
      ? 'CATEGORÍA DE SERVICIO'
      : 'TRABAJO DEL PORTAFOLIO';
    $('#editorTitle').textContent =
      (ed.originalId ? 'Editar ' : 'Nuevo ') +
      (service ? 'servicio' : 'proyecto');
    const row = `<div class="field-row">`;
    let html = `<form id="contentForm" onsubmit="return false"><div class="field-group"><label for="title">${service ? 'Nombre del servicio' : 'Nombre del proyecto'} <span class="required">*</span></label><input id="title" name="title" required maxlength="${service ? 100 : 160}" placeholder="${service ? 'Ej. Motion graphics' : 'Ej. Campaña para marca X'}" value="${E(p.title)}"/></div>`;
    if (service) {
      html += `<div class="field-group"><label for="subtitle">Descripción corta</label><textarea id="subtitle" name="subtitle" maxlength="190" style="min-height:78px" placeholder="De una idea a una pieza que destaca.">${E(p.subtitle)}</textarea></div>${row}<div class="field-group"><label for="focus">Tipo de contenido</label><select id="focus" name="focus"><option value="visual" ${p.focus === 'visual' ? 'selected' : ''}>Diseño / fotografía</option><option value="video" ${p.focus === 'video' ? 'selected' : ''}>Video / reels (dos columnas)</option></select></div><div class="field-group"><label for="tag">Etiqueta visual</label><input id="tag" name="tag" maxlength="45" value="${E(p.tag)}" placeholder="ENFOQUE"/></div></div><div class="field-group"><label for="keywords">Palabras clave</label><input id="keywords" name="keywords" value="${E(p.keywords)}" maxlength="130" placeholder="Composición · Tipografía · Impacto visual"/></div>`;
    } else {
      html += `<div class="field-group"><label for="serviceId">Servicio al que pertenece <span class="required">*</span></label><select name="serviceId" id="serviceId">${store.data.services.map((s) => `<option value="${E(s.id)}" ${s.id === p.serviceId ? 'selected' : ''}>${E(s.title)}</option>`).join('')}</select></div><div class="field-group"><label for="description">Descripción del proyecto</label><textarea name="description" id="description" rows="7" placeholder="Cuenta la idea, el concepto y cómo resolviste el proyecto…">${E(p.description)}</textarea><small class="field-hint">Este texto aparecerá debajo del título grande en la web.</small></div><div class="field-group"><label for="tag">Etiqueta corta</label><input id="tag" name="tag" maxlength="60" value="${E(p.tag)}" placeholder="Ej. Edición, Concepto, Branding"/></div>`;
    }
    html += `<div class="switch-row"><div><strong>Mostrar en la web</strong><small>Si desactivas esta opción quedará oculto sin borrarlo</small></div><input class="toggle" type="checkbox" name="published" ${p.published ? 'checked' : ''} aria-label="Publicado"/></div><div class="form-section-title"><div><h3>Imagen de portada</h3><p>Se mostrará en la vista previa y al abrir el proyecto</p></div></div><div class="field-group"><label for="coverSelect">Archivo de portada</label>${mediaChoice(p.coverMediaId)}</div>`;
    if (!service) {
      html += `<div class="form-section-title"><div><h3>Galería multimedia</h3><p>Organiza fotos, GIF, videos y audios en el orden que elijas</p></div><span class="heading-tag">${p.media.length} ARCHIVOS</span></div><div class="dropzone" id="editorDropzone" data-action="pick-project-media"><div class="dropicon">${ico('upload')}</div><h4>Arrastra tus archivos aquí</h4><p>MP4, MOV, WebM, JPG, PNG, GIF, MP3, WAV…<br>Los archivos se guardan en tu servidor.</p><button type="button" class="btn secondary" data-action="pick-project-media">${ico('plus')} Agregar archivos</button><div class="upload-status" id="uploadStatus"></div></div><div class="asset-list">${p.media
        .map((r, i) => {
          const m = fromData(r.mediaId);
          return m
            ? `<div class="asset-row">${avatar(m, 'asset-thumb')}<div class="asset-properties"><strong title="${E(m.filename)}">${E(m.filename)}</strong><small>${m.kind === 'video' ? 'Video' : m.kind === 'audio' ? 'Audio' : 'Imagen'} · ${sizeText(m.bytes)}</small><select data-layout-index="${i}" aria-label="Distribución de ${E(m.filename)}"><option value="full" ${r.layout === 'full' ? 'selected' : ''}>Ancho completo</option><option value="half" ${r.layout === 'half' ? 'selected' : ''}>Mitad del ancho (2 columnas)</option></select></div><div class="asset-tools"><button type="button" data-action="asset-up" data-index="${i}" title="Subir" aria-label="Mover arriba">${ico('up')}</button><button type="button" data-action="asset-down" data-index="${i}" title="Bajar" aria-label="Mover abajo">${ico('down')}</button><button type="button" class="remove" data-action="asset-remove" data-index="${i}" title="Quitar de este proyecto" aria-label="Quitar archivo">${ico('trash')}</button></div></div>`
            : '';
        })
        .join(
          '',
        )}</div><div class="hint-box">Para Reels, selecciona <strong>Mitad del ancho</strong>: aparecerán dos videos verticales pegados. Para fotos de proyectos visuales, usa <strong>Ancho completo</strong>. No hay límite fijo de longitud de la galería.</div>`;
    }
    if (ed.originalId) {
      html += `<div class="form-section-title"><div><h3>Zona de peligro</h3><p>Esta acción no se puede deshacer</p></div></div><button type="button" class="btn danger" data-action="${service ? 'delete-service' : 'delete-project'}" data-id="${E(ed.originalId)}">${ico('trash')} Eliminar ${service ? 'servicio' : 'proyecto'}</button>`;
    }
    html += '</form>';
    $('#drawerBody').innerHTML = html;
    $('#contentForm').removeAttribute('onsubmit');
    $('#contentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      saveEditor();
    });
  }
  function syncEditorFromForm() {
    const ed = store.editor;
    if (!ed) return;
    const form = $('#contentForm');
    if (!form) return;
    const val = (n) => form.elements.namedItem(n)?.value;
    ed.draft.title = val('title')?.trim() || '';
    ed.draft.tag = val('tag')?.trim() || '';
    ed.draft.coverMediaId = val('coverMediaId') || null;
    ed.draft.published = !!form.elements.namedItem('published')?.checked;
    if (ed.type === 'service') {
      ed.draft.subtitle = val('subtitle') || '';
      ed.draft.keywords = val('keywords') || '';
      ed.draft.focus = val('focus') || 'visual';
    } else {
      ed.draft.description = val('description') || '';
      ed.draft.serviceId = val('serviceId') || '';
    }
  }
  async function saveEditor() {
    const ed = store.editor;
    if (!ed || store.saving || store.uploading) return;
    syncEditorFromForm();
    if (!$('#contentForm').reportValidity()) return;
    if (!ed.draft.title) {
      toast('Escribe el nombre antes de guardar.', true);
      $('#title')?.focus();
      return;
    }
    const btn = $('#saveEditor');
    store.saving = true;
    btn.disabled = true;
    $('#contentForm').inert = true;
    btn.innerHTML = 'Guardando…';
    try {
      const endpoint = ed.type === 'service' ? 'services' : 'projects';
      const path =
        '/api/admin/' + endpoint + (ed.originalId ? '/' + ed.originalId : '');
      await api(path, ed.originalId ? 'PUT' : 'POST', ed.draft);
      closeEditor(true);
      await refresh();
      $('#main').focus();
      toast('¡Guardado! Ya está actualizado en tu portafolio.');
    } catch (err) {
      toast(err.message, true);
    } finally {
      store.saving = false;
      if ($('#contentForm')) $('#contentForm').inert = false;
      btn.disabled = false;
      btn.innerHTML = 'Guardar cambios <span>↗</span>';
    }
  }
  async function drawerClick(e) {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const a = b.dataset.action;
    try {
      if (a === 'upload-cover') {
        syncEditorFromForm();
        store.pickTarget = 'cover';
        $('#hiddenFilePicker').click();
      } else if (a === 'pick-project-media') {
        syncEditorFromForm();
        store.pickTarget = 'project';
        $('#hiddenFilePicker').click();
      } else if (
        a === 'asset-up' ||
        a === 'asset-down' ||
        a === 'asset-remove'
      ) {
        syncEditorFromForm();
        const i = Number(b.dataset.index),
          arr = store.editor.draft.media;
        if (a === 'asset-remove') {
          if (
            !confirm(
              '¿Quitar este archivo del proyecto? El archivo permanecerá en la biblioteca hasta que lo elimines allí.',
            )
          )
            return;
          arr.splice(i, 1);
        } else {
          const j = i + (a === 'asset-up' ? -1 : 1);
          if (j < 0 || j >= arr.length) return;
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        renderEditor();
      } else if (a.startsWith('delete-'))
        await deleteItem(
          a.slice(7) === 'service' ? 'services' : 'projects',
          b.dataset.id,
        );
    } catch (err) {
      toast(err.message, true);
    }
  }
  function drawerChange(e) {
    if (e.target.matches('[data-layout-index]')) {
      const i = Number(e.target.dataset.layoutIndex);
      store.editor.draft.media[i].layout = e.target.value;
    } else if (e.target.id === 'coverSelect') {
      syncEditorFromForm();
      renderEditor();
    }
  }
  async function handleFiles(files) {
    if (!files.length || store.uploading || store.saving) return;
    const kind = store.pickTarget || 'library';
    const editor = store.editor;
    store.uploading = true;
    $('#saveEditor').disabled = true;
    $('#saveEditor').textContent = 'Subiendo archivos…';
    let counter = 0;
    const msgs = [];
    for (const f of files) {
      counter++;
      const status = $('#uploadStatus');
      if (status)
        status.textContent = `Subiendo ${counter} de ${files.length}: ${f.name}`;
      try {
        if (f.size > 100 * 1024 * 1024)
          throw new Error(
            'El archivo supera 100 MB. Reduce o divide el video.',
          );
        const r = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: {
            'X-Filename': encodeURIComponent(f.name),
            'Content-Type': f.type || 'application/octet-stream',
          },
          body: f,
          credentials: 'same-origin',
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.detail || 'Fallo al subir');
        store.data.media.push(result);
        if (editor && editor === store.editor) syncEditorFromForm();
        if (kind === 'cover' && editor && editor === store.editor) {
          editor.draft.coverMediaId = result.id;
        } else if (kind === 'project' && editor && editor === store.editor) {
          const svc = fromService(editor.draft.serviceId);
          editor.draft.media.push({
            mediaId: result.id,
            layout:
              result.kind === 'video' && svc?.focus === 'video'
                ? 'half'
                : 'full',
            caption: '',
            order: editor.draft.media.length,
          });
        }
        if (editor && editor === store.editor && kind !== 'library') {
          renderEditor();
          $('#drawerBody').setAttribute('aria-busy', 'true');
        }
        msgs.push('✓ ' + f.name);
      } catch (err) {
        msgs.push('✕ ' + f.name + ': ' + err.message);
        toast(err.message, true);
      }
    }
    store.uploading = false;
    $('#saveEditor').disabled = false;
    $('#saveEditor').innerHTML = 'Guardar cambios <span>↗</span>';
    $('#drawerBody').setAttribute('aria-busy', 'false');
    if (!store.editor || kind === 'library') {
      try {
        await refresh();
      } catch (err) {
        toast(err.message, true);
      }
    }
    toast(
      `${msgs.filter((x) => x.startsWith('✓')).length} archivos cargados. ${kind !== 'library' ? 'Recuerda guardar los cambios del proyecto.' : ''}`,
    );
  }
  let metricsDays = 30,
    metricsRequest = 0;
  const number = (n) =>
    new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 }).format(n || 0);
  function renderMetrics() {
    return (
      head(
        'Audiencia del portafolio',
        'Tu audiencia, en perspectiva',
        'Conoce cómo llegan a tu trabajo y qué despierta su interés.',
      ) +
      `<div class="metrics-toolbar"><div class="period-control" role="group" aria-label="Período de métricas">${[7, 30, 90].map((d) => `<button type="button" data-action="metrics-period" data-days="${d}" aria-pressed="${metricsDays === d}">${d} días</button>`).join('')}</div><button class="btn secondary" data-action="refresh-metrics">${ico('clock')} Actualizar</button></div><div id="metricsContent" aria-live="polite" aria-busy="true"><div class="metrics-loading">Consultando las visitas de tu portafolio…</div></div>`
    );
  }
  function metricBreakdown(title, items, kind = '', overallTotal) {
    const total = Math.max(
      1,
      overallTotal ?? items.reduce((sum, item) => sum + item.count, 0),
    );
    return `<section class="analytics-panel"><h2>${title}</h2>${
      items.length
        ? `<ul class="breakdown-list">${items
            .map((item) => {
              let label = item.label;
              if (kind === 'country') {
                try {
                  label =
                    label === 'XX'
                      ? 'Sin ubicación'
                      : new Intl.DisplayNames(['es'], { type: 'region' }).of(
                          label,
                        );
                } catch {
                  label = 'Sin ubicación';
                }
              }
              if (kind === 'project')
                label =
                  store.data.projects.find((p) => p.id === item.label)?.title ||
                  'Proyecto retirado';
              return `<li><div><span>${E(label)}</span><strong>${number(item.count)} <small>${number((item.count / total) * 100)}%</small></strong></div><div class="breakdown-track"><span style="width:${(item.count / total) * 100}%"></span></div></li>`;
            })
            .join('')}</ul>`
        : '<p class="metrics-empty">Todavía no hay actividad en este período.</p>'
    }</section>`;
  }
  async function loadMetrics() {
    const request = ++metricsRequest,
      days = metricsDays;
    const content = $('#metricsContent');
    if (!content) return;
    content.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/api/admin/analytics?days=' + days);
      if (request !== metricsRequest || store.view !== 'metrics') return;
      const cards = [
        ['Vistas de página', 'views', 'Cargas del portafolio'],
        [
          'Visitantes estimados',
          'visitors',
          'Identificadores anónimos diarios',
        ],
        ['Sesiones', 'sessions', 'Sesiones de navegador por día'],
        ['Proyectos abiertos', 'projects', 'Aperturas de tus trabajos'],
        ['Clics de contacto', 'contacts', 'WhatsApp, correo y teléfono'],
        [
          'Conversión a contacto',
          'conversion',
          'Sesiones con clic de contacto',
        ],
      ];
      const max = Math.max(1, ...data.daily.map((d) => d.views));
      content.innerHTML = `<div class="metrics-stats">${cards
        .map(([title, key, hint]) => {
          const current = data.totals[key] || 0,
            previous = data.previous[key] || 0;
          const delta = previous
            ? Math.round(((current - previous) / previous) * 100)
            : null;
          return `<article class="metric-card"><h2>${title}</h2><strong>${number(current)}${key === 'conversion' ? '%' : ''}</strong><div class="metric-comparison ${delta > 0 ? 'positive' : ''}">${delta === null ? 'Sin base de comparación' : `${delta > 0 ? '+' : ''}${delta}% vs. período anterior`}</div><p>${hint}</p></article>`;
        })
        .join(
          '',
        )}</div><section class="analytics-panel trend-panel"><div class="chart-heading"><div><h2>Visitas a lo largo del tiempo</h2><p>${E(data.start)} al ${E(data.end)} · Hora de Ecuador</p></div><span class="chart-key"><i></i> Vistas de página</span></div>${data.totals.views ? '' : '<p class="metrics-empty">Tu próxima visita empieza esta historia. Los datos aparecerán después de publicar esta versión.</p>'}<div class="visits-chart" role="img" aria-label="Vistas por día. Los valores exactos están en la tabla desplegable.">${data.daily.map((d) => `<div class="chart-column" title="${E(d.day)}: ${number(d.views)} vistas"><div style="height:${(d.views / max) * 100}%;${d.views ? 'min-height:3px' : ''}"></div></div>`).join('')}</div><div class="chart-axis"><span>${E(data.start)}</span><span>${E(data.end)}</span></div><details class="chart-details"><summary>Ver datos por día</summary><div class="table-scroll"><table><caption>Actividad diaria del portafolio</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Vistas</th><th scope="col">Visitantes estimados</th></tr></thead><tbody>${data.daily.map((d) => `<tr><th scope="row">${E(d.day)}</th><td>${number(d.views)}</td><td>${number(d.visitors)}</td></tr>`).join('')}</tbody></table></div></details></section><div class="analytics-grid">${metricBreakdown('De dónde llegan', data.sources, '', data.totals.views)}${metricBreakdown('Proyectos más vistos', data.projects, 'project', data.totals.projects)}${metricBreakdown('Dispositivos', data.devices, '', data.totals.views)}${metricBreakdown('Países', data.countries, 'country', data.totals.views)}</div><aside class="analytics-note">${ico('eye')}<p><strong>Una mirada a tu audiencia, sin identificar personas.</strong> Visitantes estimados con identificadores que cambian cada día; el mismo visitante puede contarse en varios días. Sesiones de navegador por día. No se guardan direcciones IP, nombres ni correos. Se excluyen bots conocidos, tu sesión de administrador y navegadores con señales de no seguimiento. Se consultan hasta 180 días para comparar períodos de 90 días; los datos antiguos se eliminan al registrar nuevas visitas. Los clics de contacto indican intención, no mensajes enviados.</p></aside>`;
    } catch (err) {
      if (request !== metricsRequest || store.view !== 'metrics') return;
      content.innerHTML = `<div class="metrics-error" role="alert"><h2>No se pudieron cargar las métricas</h2><p>${E(err.message)}</p><button class="btn secondary" data-action="refresh-metrics">Volver a intentar</button></div>`;
    } finally {
      if (request === metricsRequest && store.view === 'metrics')
        content.setAttribute('aria-busy', 'false');
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else init();
})();
