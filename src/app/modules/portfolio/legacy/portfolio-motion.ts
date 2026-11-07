// @ts-nocheck -- Legacy vanilla script migrated verbatim from plantilla.html.
// It drives the scroll scenes, the menu, the project dialog and the brief
// form by querying the DOM that PortfolioHomePage renders. Port pieces to
// Angular (signals, host listeners) incrementally, with tests, then delete.
/* eslint-disable */
import type { PublicPortfolio } from '../interfaces/portfolio.interface';

/** Starts every legacy behavior. Call once, after the page DOM is rendered. */
export function startPortfolioMotion(portfolio: PublicPortfolio): void {

  const $ = (q, node=document) => node.querySelector(q);
  const $$ = (q, node=document) => [...node.querySelectorAll(q)];
  const clamp = (v,a=0,b=1) => Math.min(b, Math.max(a,v));
  const smooth = (a,b,v) => {const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
  const lerp = (a,b,t) => a+(b-a)*t;
  const hero = $('#inicio'); const character = $('#character-wrap');
  const intro = $('#intro-copy'), stories = $$('.story-copy[data-story]');
  const works = $('#servicios'), track = $('#works-track'), siteHeader = $('#site-header');
  const worksWindow = $('.works-window'), worksLaunch = $('#works-launch-copy'), sceneFooter = $('.scene-footer'), worksStage = $('.works-stage');
  const panels = $$('.service-panel');
  const desktopLen=1125+Math.max(0,panels.length-4)*78;const mobileLen=1200+Math.max(0,panels.length-4)*94;
  hero.style.setProperty('--hero-height-desktop',desktopLen+'svh');hero.style.setProperty('--hero-height-mobile',mobileLen+'svh');
  let activePanel = 0, reduceMotion = false, ticking = false, lastVw=innerWidth;
  // A continuous reading layout avoids scroll choreography on short screens
  // and when the visitor requests reduced motion (including live changes).
  const mobileMedia=matchMedia('(max-width: 650px)');
  const readingMedia=matchMedia('(prefers-reduced-motion: reduce), (max-height: 540px) and (min-aspect-ratio: 1/1)');
  mobileMedia.addEventListener('change',requestRender);
  readingMedia.addEventListener('change',requestRender);
  function effectiveScroll(){return Math.max(0,scrollY)}
  function viewport(){return Math.max(document.documentElement.clientHeight,1)}
  // No hay un segundo hero: ambas secuencias comparten exactamente el mismo escenario sticky.
  function heroDistance(){return viewport()*(innerWidth<651 ? 6.10 : 5.70)}
  function heroProgress(){return clamp((effectiveScroll()-hero.offsetTop)/heroDistance())}
  function worksTimeline(){
    const total=Math.max(1,hero.offsetHeight-viewport()-heroDistance());
    const intro=Math.min(viewport()*.27,total*.12);
    const reveal=Math.min(viewport()*.87,total*.22);
    const galleryStart=intro+reveal;
    const local=effectiveScroll()-hero.offsetTop-heroDistance();
    return {local,intro,reveal,galleryStart,total,
      gallery:clamp((local-galleryStart)/Math.max(1,total-galleryStart)),
      slide:smooth(intro,intro+reveal,local)};
  }
  function worksProgress(){return worksTimeline().gallery;}
  function targetXForWorks(){return Math.max(0,track.getBoundingClientRect().width-worksWindow.getBoundingClientRect().width)}
  function setOpacity(el,value,x=0){el.style.opacity=clamp(value).toFixed(3); el.style.transform=el===intro?`translate(-50%, ${x}px)`:`translateX(${x}px)`;el.style.pointerEvents=value>.5?'auto':'none';}
  // Cinco escenas editoriales. La escala y la posición cambian para dar profundidad
  // sin deformar ni reinterpretar el rostro original (solo transformaciones 2D).
  const storyWindows = [
    {start:.115,end:.270},
    {start:.285,end:.445},
    {start:.460,end:.620},
    {start:.635,end:.790},
    {start:.805,end:.975}
  ];
  function storyOpacity(p, scene){
    const lead=smooth(scene.start,scene.start+.030,p);
    const leave=1-smooth(scene.end-.030,scene.end,p);
    return lead*leave;
  }
  // Zero acceleration at each stop keeps the changes of direction unhurried.
  function characterEase(t){return t*t*t*(t*(t*6-15)+10)}
  function characterPath(p,mobile){
    if(mobile){
      // One continuous approach, then the same centered framing as before.
      const t=characterEase(clamp(p/.18));
      return {shift:0,zoom:lerp(1,1.18,t),moveY:lerp(0,3.2,t)};
    }
    // Keep the original framing; settle at the center of each story/cue stop.
    const poses=[
      {at:0,x:0,z:1,y:0},
      {at:.1925,x:24,z:1.35,y:-2},
      {at:.365,x:-22,z:1.13,y:3},
      {at:.54,x:25,z:1.54,y:-6},
      {at:.7125,x:-23,z:1.27,y:1},
      {at:.89,x:-28,z:1.46,y:-3},
      {at:1,x:-26,z:1.40,y:-4}
    ];
    for(let i=0;i<poses.length-1;i++){
      const a=poses[i],b=poses[i+1];
      if(p<=b.at){
        const t=characterEase(clamp((p-a.at)/(b.at-a.at)));
        return {shift:lerp(a.x,b.x,t),zoom:lerp(a.z,b.z,t),moveY:lerp(a.y,b.y,t)};
      }
    }
    const last=poses[poses.length-1];
    return {shift:last.x,zoom:last.z,moveY:last.y};
  }
  function renderHero(){
    const p=heroProgress(), mobile=innerWidth<651;
    const oIntro=1-smooth(.025,.108,p);
    setOpacity(intro,oIntro,lerp(0,-20,smooth(.035,.11,p)));
    stories.forEach((story,i)=>{
      const phase=storyWindows[i];
      const opacity=storyOpacity(p,phase);
      const entrance=smooth(phase.start,phase.start+.04,p);
      const fromRight=story.classList.contains('jm-right');
      setOpacity(story,opacity,lerp(fromRight?22:-22,0,entrance));
      story.setAttribute('aria-hidden',opacity<.05?'true':'false');
      story.querySelectorAll('a').forEach(a=>a.tabIndex=opacity>.7?0:-1);
    });
    let {shift,zoom,moveY}=characterPath(p,mobile);
    const t=worksTimeline();
    // Mantener intacta la entrada a Servicios sobre el mismo escenario sticky.
    const rise=smooth(-viewport()*.10,viewport()*.52,t.local);
    if(t.local>-viewport()*.10){
      shift=lerp(shift,0,rise);
      zoom=lerp(zoom,mobile?1.02:1.04,rise);
      moveY=lerp(moveY,mobile?-1:-2,rise);
    }
    character.style.transform=`translateX(-50%) translate(${shift.toFixed(2)}vw, ${moveY.toFixed(2)}vh) scale(${zoom.toFixed(3)})`;
  }
  function renderWorks(){
    const t=worksTimeline();
    const max=targetXForWorks();
    const px=Math.round(t.gallery*max);
    // Se mantiene el personaje del HERO sin duplicarlo ni cambiar de imagen/fondo.
    worksWindow.style.transform=`translate3d(${((1-t.slide)*innerWidth).toFixed(2)}px,0,0)`;
    track.style.transform=`translate3d(${-px}px,0,0)`;
    worksWindow.style.pointerEvents=t.slide>.012?'auto':'none';
    worksStage?.classList.toggle('is-revealed',t.slide>.998);
    // «Servicios» entra desde debajo del viewport, sube y se ancla arriba
    // mientras avanza el carrusel. La animación depende del scroll y es reversible.
    const rise=smooth(-viewport()*.10,viewport()*.52,t.local);
    const labelTravel=lerp(viewport()*1.03,0,rise);
    const labelScale=lerp(1.18,1,rise);
    const exit=1-smooth(t.total-viewport()*.27,t.total,t.local);
    worksLaunch.style.opacity=(smooth(0,.13,rise)*exit).toFixed(3);
    worksLaunch.style.transform=`translate3d(0,${labelTravel.toFixed(2)}px,0) scale(${labelScale.toFixed(3)})`;
    // Mostrar «DESLIZA» durante todas las presentaciones, no solo la primera.
    // Ocultar el indicador únicamente al entrar en Servicios.
    const cueOpacity=1-smooth(-viewport()*.12,viewport()*.12,t.local);
    sceneFooter.style.opacity=cueOpacity.toFixed(3);
    sceneFooter.style.pointerEvents=cueOpacity>.16?'auto':'none';
    const panelW=panels[0]?.getBoundingClientRect().width||innerWidth;
    activePanel=clamp(Math.round(px/panelW),0,panels.length-1);
    // Visible folders are usable during the entrance; only fully offscreen
    // panels stay inert so they cannot capture focus or pointer input.
    panels.forEach(panel=>{
      const bounds=panel.getBoundingClientRect();
      panel.inert=bounds.right<=0 || bounds.left>=innerWidth;
    });
  }
  function render(){
    ticking=false;
    const reading=readingMedia.matches;
    document.body.classList.toggle('mobile-layout',mobileMedia.matches);
    document.body.classList.toggle('reading-layout',reading);
    hero.classList.toggle('reading-layout',reading);
    if(reading){
      stories.forEach(story=>{
        story.setAttribute('aria-hidden','false');
        story.querySelectorAll('a').forEach(a=>a.tabIndex=0);
      });
      worksWindow.style.pointerEvents='auto';
      panels.forEach(panel=>panel.inert=false);
      siteHeader.classList.remove('is-scrolled-away','on-dark','works-active','contact-visible');
      return;
    }
    renderHero();
    renderWorks();
    const t=worksTimeline();
    siteHeader.classList.toggle('on-dark',t.slide>.55 && t.local<t.total+viewport()*.5);
    siteHeader.classList.toggle('works-active',t.local>viewport()*.39 && t.local<t.total-viewport()*.20);
    // Visible al principio; oculta durante el recorrido; visible otra vez al llegar al final.
    const contactRect=$('#contacto').getBoundingClientRect();
    // El panel ya está centrado bajo la máscara: el encabezado espera al zoom final.
    const contactAligned=contactRect.left<=Math.max(3,innerWidth*.004)
      && contactRect.right<=innerWidth+Math.max(3,innerWidth*.004);
    const contactProgress=Number($('#contacto').style.getPropertyValue('--contact-progress')||0);
    const inFinalSection=contactRect.top<=viewport()*.12 && contactAligned && contactProgress>=.98;
    const atBeginning=effectiveScroll()<40;
    const hidden=!atBeginning&&!inFinalSection;
    siteHeader.classList.toggle('is-scrolled-away',hidden);
    siteHeader.classList.toggle('contact-visible',inFinalSection);
    if(hidden){
      const navigation=$('#navigation'),toggle=$('#menu-toggle');
      if(navigation&&!navigation.hidden){navigation.classList.remove('is-open');navigation.inert=true;navigation.hidden=true;toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Abrir menú')}
    }
  }
  function requestRender(){if(!ticking){ticking=true;requestAnimationFrame(render)}}
  addEventListener('scroll',requestRender,{passive:true});addEventListener('resize',()=>{if(innerWidth!==lastVw){lastVw=innerWidth;}requestRender()},{passive:true});
  render();setTimeout(render,100);
  // El indicador avanza progresivamente por las cinco escenas, en vez de
  // enlazar siempre a una única ancla. Funciona también con toques en móvil.
  const scrollCue=$('.scroll-cue');
  // Pulsaciones rápidas también avanzan: no repetir el mismo destino
  // mientras el navegador todavía está realizando el scroll suave.
  let lastCueTarget=-Infinity,lastCueAt=0;
  scrollCue?.addEventListener('click',e=>{
    e.preventDefault();
    if(readingMedia.matches){stories[0]?.scrollIntoView({behavior:'instant'});return;}
    const now=performance.now();
    const p=heroProgress();
    const effectiveP=now-lastCueAt<1400?Math.max(p,lastCueTarget):p;
    const stops=storyWindows.map(({start,end})=>start+(end-start)*.5);
    const next=stops.find(stop=>stop>effectiveP+.016);
    const targetP=next===undefined?1+(.58*viewport()/heroDistance()):next;
    lastCueTarget=targetP;lastCueAt=now;
    const destination=next!==undefined
      ? hero.offsetTop+heroDistance()*targetP
      : hero.offsetTop+heroDistance()+viewport()*.58;
    const noMotion=reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:destination,behavior:noMotion?'instant':'smooth'});
  });
  function goPanel(i){const n=clamp(i,0,panels.length-1);const max=targetXForWorks();const distance=Math.min(max,n*(panels[0].getBoundingClientRect().width));const pct=distance/Math.max(1,max);const t=worksTimeline();const galleryScroll=Math.max(0,t.total-t.galleryStart);const desired=hero.offsetTop+heroDistance()+t.galleryStart+pct*galleryScroll;scrollTo({top:desired,behavior:reduceMotion?'instant':'smooth'});}
  // The original photograph remains unmodified; the eyes do not track the pointer.
  const menuBtn=$('#menu-toggle'),nav=$('#navigation');
  let menuCloseTimer;
  function closeMenu(immediate=false){
    clearTimeout(menuCloseTimer);nav.classList.remove('is-open');nav.inert=true;
    menuBtn.setAttribute('aria-expanded','false');
    menuBtn.setAttribute('aria-label','Abrir menú');
    if(immediate){nav.hidden=true;return;}
    menuCloseTimer=setTimeout(()=>{if(!nav.classList.contains('is-open'))nav.hidden=true},380);
  }
  function openMenu(){
    clearTimeout(menuCloseTimer);nav.hidden=false;nav.inert=false;
    menuBtn.setAttribute('aria-expanded','true');
    menuBtn.setAttribute('aria-label','Cerrar menú');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(menuBtn.getAttribute('aria-expanded')==='true')nav.classList.add('is-open')}));
  }
  nav.inert=true;
  menuBtn.addEventListener('click',()=>{if(menuBtn.getAttribute('aria-expanded')==='true')closeMenu();else openMenu()});
  $$('a[href^="#"]',nav).forEach(a=>a.addEventListener('click',()=>closeMenu()));
  $$('a[href="#sobre-mi"]').forEach(a=>a.addEventListener('click',e=>{
    if(!readingMedia.matches)return;
    e.preventDefault();stories[0]?.scrollIntoView({behavior:'instant'});
  }));
  $$('a[href="#servicios"]').forEach(a=>a.addEventListener('click',e=>{
    e.preventDefault();closeMenu();
    if(readingMedia.matches){works.scrollIntoView({behavior:'instant'});return;}
    const desired=hero.offsetTop+heroDistance()+worksTimeline().galleryStart+1;
    scrollTo({top:desired,behavior:reduceMotion?'instant':'smooth'});
  }));
  addEventListener('keydown',e=>{if(e.key==='Escape'){if(!nav.hidden)menuBtn.focus();closeMenu();if(serviceDialog.open){e.preventDefault();closeProjectDialog()}else{document.querySelectorAll('dialog[open]').forEach(d=>d.close())}}if(e.key==='ArrowRight'&&inWorks()&&!dialogOpen()){e.preventDefault();goPanel(activePanel+1)}if(e.key==='ArrowLeft'&&inWorks()&&!dialogOpen()){e.preventDefault();goPanel(activePanel-1)}});
  addEventListener('click',e=>{if(!nav.hidden&&!nav.contains(e.target)&&!menuBtn.contains(e.target))closeMenu()});
  const motion=$('#motion-toggle');motion?.addEventListener('click',()=>{reduceMotion=!reduceMotion;document.body.classList.toggle('reduce-motion',reduceMotion);motion.setAttribute('aria-pressed',String(reduceMotion));motion.title=reduceMotion?'Activar animaciones':'Pausar animaciones';motion.setAttribute('aria-label',motion.title)});
  function inWorks(){const t=worksTimeline();return !readingMedia.matches&&t.local>0&&t.local<t.total}
  function dialogOpen(){return !!$('dialog[open]')}
  const serviceDialog=$('#service-dialog'),briefDialog=$('#brief-dialog');
  // Data comes from PortfolioService (injected by the Worker or /api/public).
  const projectById=new Map(portfolio.projects.map(p=>[p.id,p]));
  const mediaById=new Map(portfolio.media.map(m=>[m.id,m]));
  let projectClosingTimer=null;
  let projectReturnFocus=null;
  function closeProjectDialog(){
    if(!serviceDialog.open||serviceDialog.classList.contains('is-closing'))return;
    const motionOff=reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(motionOff){serviceDialog.close();return;}
    serviceDialog.classList.add('is-closing');
    clearTimeout(projectClosingTimer);
    projectClosingTimer=setTimeout(()=>{if(serviceDialog.open)serviceDialog.close()},270);
  }
  function showDialog(d){
    if(dialogOpen())$('dialog[open]').close();
    if(d===serviceDialog){clearTimeout(projectClosingTimer);d.classList.remove('is-closing');d.scrollTop=0;}
    d.showModal();
    document.body.classList.add('modal-open');
    if(d===serviceDialog)document.body.classList.add('project-open');
  }
  function escapeText(x){return String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]))}
  function makeMediaNode(m,lay,alt){
    const wrap=document.createElement('div');wrap.className='portfolio-media-item '+(lay==='half'?'is-half':'is-full');
    const url=m.url;
    if(m.kind==='image'){
      const im=document.createElement('img');im.src=url;im.alt=alt||m.filename||'Proyecto';im.loading='lazy';im.decoding='async';wrap.append(im);
    } else if(m.kind==='video'){
      const vid=document.createElement('video');vid.controls=true;vid.preload='metadata';vid.playsInline=true;vid.src=url;vid.setAttribute('controlsList','nodownload');wrap.append(vid);
    } else if(m.kind==='audio'){
      wrap.classList.add('is-audio');const h=document.createElement('div');h.className='audio-icon';h.textContent='♫';const label=document.createElement('span');label.textContent=m.filename||'Pista de audio';const a=document.createElement('audio');a.controls=true;a.preload='none';a.src=url;wrap.append(h,label,a);
    }
    return wrap;
  }
  function openDetail(key,opener){
    const p=projectById.get(key);if(!p)return;
    projectReturnFocus=opener?.closest('app-service-folder')?.querySelector('.folder-float__trigger')||opener;
    const service=portfolio.services.find(s=>s.id===p.serviceId);
    const banner=$('#detail-banner');banner.replaceChildren();banner.removeAttribute('role');
    const heroMedia=mediaById.get(p.coverMediaId)||mediaById.get(service?.coverMediaId);
    if(heroMedia){banner.append(makeMediaNode(heroMedia,'full',p.title));}
    else{
      const art=$(`[data-service="${CSS.escape(key)}"]`)?.closest('.service-panel')?.querySelector('.sample-button .artwork');
      if(art){banner.append(art.cloneNode(true));}else{const blank=document.createElement('div');blank.className='portfolio-hero-placeholder';blank.textContent=(service?.title||'JM')+' ✳';banner.append(blank);}
    }
    $('#detail-title').textContent=p.title;
    $('#detail-description').textContent=p.description||'Descripción próximamente.';
    const gallery=$('#project-gallery');gallery.replaceChildren();
    const entries=(p.media||[]).map(e=>({...e,info:mediaById.get(e.mediaId)})).filter(e=>e.info);
    for(const e of entries)gallery.append(makeMediaNode(e.info,e.layout||(e.info.kind==='video'&&service?.focus==='video'?'half':'full'),e.caption||p.title));
    gallery.hidden=entries.length===0;
    showDialog(serviceDialog);
  }

  const awardDialog=$('#award-dialog');
  const awardDialogImage=$('#award-dialog-image');
  const awardDialogTitle=$('#award-dialog-title');
  const awardDialogCaption=$('#award-dialog-caption');
  function openAward(card){
    if(!awardDialog||!card)return;
    awardDialogImage.src=card.querySelector('img')?.currentSrc||card.querySelector('img')?.src||'';
    awardDialogImage.alt=card.querySelector('img')?.alt||card.dataset.awardTitle||'Documento';
    awardDialogTitle.textContent=card.dataset.awardTitle||'Documento';
    awardDialogCaption.textContent=card.dataset.awardCaption||'';
    showDialog(awardDialog);
  }
  $$('.award-card').forEach(card=>card.addEventListener('click',()=>openAward(card)));

  track.addEventListener('click',event=>{
    const button=event.target.closest('button[data-service]');
    if(button&&track.contains(button))openDetail(button.dataset.service,button);
  });
  $$('[data-brief]').forEach(btn=>btn.addEventListener('click',()=>showDialog(briefDialog)));
  $$('dialog .dialog-close').forEach(btn=>btn.addEventListener('click',()=>{const d=btn.closest('dialog');if(d===serviceDialog)closeProjectDialog();else d.close()}));
  [serviceDialog,briefDialog,awardDialog].filter(Boolean).forEach(d=>{
    d.addEventListener('close',()=>{
      if(d===serviceDialog){clearTimeout(projectClosingTimer);d.classList.remove('is-closing');document.body.classList.remove('project-open');projectReturnFocus?.focus({preventScroll:true})}
      if(!dialogOpen())document.body.classList.remove('modal-open');
    });
    d.addEventListener('click',e=>{if(e.target===d){if(d===serviceDialog)closeProjectDialog();else d.close()}});
    if(d===serviceDialog)d.addEventListener('cancel',e=>{e.preventDefault();closeProjectDialog()});
  });
  function briefText(){const form=$('#brief-form');const name=$('#client-name').value.trim();const desc=$('#client-idea').value.trim();if(!form.reportValidity())return null;
    const categories=$$('input[name=service]:checked',form).map(i=>i.value);const date=$('#client-date').value;
    return `SOLICITUD DE PROYECTO — JERATH MOREIRA\n\nNombre o marca: ${name||'No indicado'}\nServicios: ${categories.join(', ')||'Por definir'}\nFecha estimada: ${date||'Por definir'}\n\nIDEA DEL PROYECTO\n${desc}\n\n---\nCreado desde el portafolio de Jerath Moreira.`;
  }
  let briefBusy=false;
  async function acceptedBrief(method){
    const text=briefText();if(!text||briefBusy)return null;
    briefBusy=true;
    const buttons=$$('#brief-form .brief-buttons button');buttons.forEach(button=>button.disabled=true);
    $('#brief-status').textContent='Guardando justificante…';
    try{
      if(typeof window.jmRecordBriefAcceptance!=='function')throw new Error('No se pudo cargar el registro de aceptación. Recarga la página.');
      const receipt=await window.jmRecordBriefAcceptance(method);if(!receipt)return null;
      return `${text}\nJustificante: ${receipt.receipt}\nFecha: ${receipt.occurredAt}\nVersión legal: ${receipt.version}\nAcción: ${method==='copy'?'Copiar':'Descargar'}\nTérminos aceptados y privacidad leída. No constituye un encargo contratado.`;
    }catch(error){$('#brief-status').textContent=error.message||'No se pudo registrar la aceptación. Inténtalo de nuevo.';return null}
    finally{briefBusy=false;buttons.forEach(button=>button.disabled=false)}
  }
  $('#brief-form').addEventListener('submit',async e=>{e.preventDefault();const t=await acceptedBrief('copy');if(!t)return;$('#brief-output').hidden=false;$('#brief-output').value=t;try{await navigator.clipboard.writeText(t);$('#brief-status').textContent='Solicitud copiada con su justificante. Ya puedes compartirla.'}catch{const el=$('#brief-output');el.select();try{document.execCommand('copy');$('#brief-status').textContent='Solicitud copiada con su justificante.'}catch{$('#brief-status').textContent='Selecciona y copia el texto preparado con su justificante.'}}});
  $('#download-brief').addEventListener('click',async()=>{const t=await acceptedBrief('download');if(!t)return;const blob=new Blob([t],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='solicitud-jerath-moreira.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);$('#brief-status').textContent='Archivo .txt descargado con su justificante.'});

  // Entrada de Reconocimientos: una sola vez, con fallback visible si JS falla.
  // El título nunca queda bloqueado en opacity:0 al entrar mediante un ancla.
  const awardsSection=$('#reconocimientos');
  if(awardsSection && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const makeAwardsVisible=()=>awardsSection.classList.add('is-in-view');
    const box=awardsSection.getBoundingClientRect();
    if(box.top<innerHeight*.82 && box.bottom>0) makeAwardsVisible();
    if('IntersectionObserver' in window){
      const observer=new IntersectionObserver(entries=>{
        if(entries.some(e=>e.isIntersecting)){
          makeAwardsVisible();observer.disconnect();
        }
      },{rootMargin:'0px 0px -12% 0px',threshold:.07});
      awardsSection.classList.add('awards-ready');
      observer.observe(awardsSection);
    } else makeAwardsVisible();
  }

  // Drag, keyboard and visible buttons share the same document positions.
  // Clic corto en una tarjeta: amplia el certificado. Arrastre: desplaza el carrusel.
  const awardsTrack=$('#awards-track');
  if(awardsTrack && !awardsTrack.hasAttribute('appRecognitionSwap')){
    const cards=$$('.award-card',awardsTrack);
    let drag=null, suppressClick=false;
    cards.forEach(card=>card.querySelectorAll('img').forEach(img=>img.draggable=false));
    const getCardLeft=(card)=>card.offsetLeft-cards[0].offsetLeft;
    const previousAward=$('#awards-prev'),nextAward=$('#awards-next');
    function syncAwardControls(){
      const left=awardsTrack.scrollLeft;
      const remaining=awardsTrack.scrollWidth-awardsTrack.clientWidth-left;
      if(previousAward)previousAward.disabled=left<=1;
      if(nextAward)nextAward.disabled=remaining<=1;
    }
    function moveAward(direction){
      if(!cards.length)return;
      const x=awardsTrack.scrollLeft;
      const pos=cards.reduce((best,item,i)=>Math.abs(getCardLeft(item)-x)<Math.abs(getCardLeft(cards[best])-x)?i:best,0);
      const idx=clamp(pos+direction,0,cards.length-1);
      awardsTrack.scrollTo({left:getCardLeft(cards[idx]),behavior:readingMedia.matches?'instant':'smooth'});
      return cards[idx];
    }
    previousAward?.addEventListener('click',()=>moveAward(-1));
    nextAward?.addEventListener('click',()=>moveAward(1));
    awardsTrack.addEventListener('scroll',syncAwardControls,{passive:true});
    if(window.ResizeObserver)new ResizeObserver(syncAwardControls).observe(awardsTrack);
    syncAwardControls();
    function snapToNearest(){
      const x=awardsTrack.scrollLeft;
      const closest=cards.reduce((best,item)=>Math.abs(getCardLeft(item)-x)<Math.abs(getCardLeft(best)-x)?item:best,cards[0]);
      awardsTrack.scrollTo({left:getCardLeft(closest),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
    awardsTrack.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button===0){
        drag={x:e.clientX,y:e.clientY,left:awardsTrack.scrollLeft,moved:false,id:e.pointerId};
        suppressClick=false;
      }
    });
    addEventListener('pointermove',e=>{
      if(!drag || e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.x;
      if(!drag.moved && Math.abs(dx)>6 && Math.abs(dx)>Math.abs(e.clientY-drag.y)){
        drag.moved=true;awardsTrack.classList.add('is-dragging');awardsTrack.style.scrollSnapType='none';awardsTrack.style.scrollBehavior='auto';
        awardsTrack.setPointerCapture?.(e.pointerId);
      }
      if(drag.moved){awardsTrack.scrollLeft=drag.left-dx;e.preventDefault?.()}
    },{passive:false});
    function finishDrag(e){
      if(!drag || e.pointerId!==drag.id)return;
      if(drag.moved){
        suppressClick=true;
        awardsTrack.classList.remove('is-dragging');
        awardsTrack.style.scrollSnapType=''; awardsTrack.style.scrollBehavior='';
        // El siguiente clic sintetizado por la interacción no debe abrir la tarjeta.
        setTimeout(()=>{suppressClick=false},220);
      }
      drag=null;
    }
    addEventListener('pointerup',finishDrag);
    addEventListener('pointercancel',finishDrag);
    awardsTrack.addEventListener('click',e=>{
      if(suppressClick){e.preventDefault();e.stopImmediatePropagation()}
    },true);
    awardsTrack.addEventListener('keydown',e=>{
      if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
      e.preventDefault();
      moveAward(e.key==='ArrowRight'?1:-1)?.focus({preventScroll:true});
    });
  }

  // El favicon asciende, se centra y abre Contacto al acercarse con el scroll.
  const contactArea=$('#contacto');
  if(contactArea){
    const revealShell=document.createElement('div');
    revealShell.className='contact-reveal-shell contact-ready contact-portal';
    revealShell.setAttribute('aria-label','Transición a la sección Tu proyecto');
    contactArea.parentNode.insertBefore(revealShell,contactArea);
    revealShell.appendChild(contactArea);
    const portalInk=document.createElement('div');
    portalInk.className='contact-portal-ink';
    portalInk.setAttribute('aria-hidden','true');
    portalInk.innerHTML='<img src="/static/media/contact-transition-favicon.svg" alt="" width="512" height="512"/>';
    revealShell.insertBefore(portalInk,contactArea);
    const setPortal=(name,value)=>{
      revealShell.style.setProperty(name,value);
      contactArea.style.setProperty(name,value);
    };
    // Reconocimientos permanece fijo detrás de la máscara, sin duplicar sus tarjetas.
    const awardsForPin=$('#reconocimientos');
    const measureAwards=()=>{
      if(awardsForPin)awardsForPin.style.setProperty('--awards-rendered-height', awardsForPin.getBoundingClientRect().height+'px');
    };
    measureAwards();
    addEventListener('resize',measureAwards,{passive:true});
    if(window.ResizeObserver&&awardsForPin){
      new ResizeObserver(measureAwards).observe(awardsForPin);
    }
    const reducedMedia=matchMedia('(prefers-reduced-motion: reduce)');
    let scheduled=false;
    const clamp01=v=>Math.max(0,Math.min(1,v));
    const ease=v=>v*v*(3-2*v);
    const updateContactReveal=()=>{
      scheduled=false;
      if(readingMedia.matches){
        contactArea.style.setProperty('--reveal-x','0%');
        contactArea.style.setProperty('--contact-progress','1');
        setPortal('--portal-opacity','1');
        setPortal('--portal-ink','0');
        contactArea.style.setProperty('--portal-page-opacity','1');
        contactArea.style.maskImage='none';
        contactArea.style.webkitMaskImage='none';
        revealShell.style.removeProperty('height');
        revealShell.dataset.revealDistance='0';
        contactArea.inert=false;
        contactArea.style.pointerEvents='auto';
        return;
      }
      const vh=window.innerHeight||1;
      const top=revealShell.getBoundingClientRect().top;
      const distance=vh*1.5;
      const progress=clamp01(-top/distance);
      const rise=ease(clamp01(progress/.28));
      const zoom=ease(clamp01((progress-.38)/.60));
      const baseSize=Math.min(210,innerWidth*.38);
      const fullSize=Math.max(innerWidth,vh)*2.3;
      const size=baseSize*Math.pow(fullSize/baseSize,zoom);
      revealShell.style.setProperty('height',(contactArea.offsetHeight+distance)+'px','important');
      revealShell.dataset.revealDistance=String(distance);
      contactArea.style.setProperty('--contact-progress',progress.toFixed(4));
      setPortal('--portal-size',size.toFixed(2)+'px');
      setPortal('--portal-y',((1-rise)*vh*.75).toFixed(2)+'px');
      setPortal('--portal-opacity',String(ease(clamp01(progress/.08))));
      setPortal('--portal-ink',String(1-ease(clamp01((progress-.4)/.22))));
      contactArea.style.setProperty('--portal-page-opacity',String(ease(clamp01((progress-.38)/.22))));
      const mask=progress>=.98?'none':'url("/static/media/contact-transition-favicon.svg")';
      contactArea.style.maskImage=mask;
      contactArea.style.webkitMaskImage=mask;
      contactArea.inert=progress<.98;
      contactArea.style.pointerEvents=progress>=.98?'auto':'none';
      requestRender();
    };
    const queue=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateContactReveal)}};
    addEventListener('scroll',queue,{passive:true});
    addEventListener('resize',queue,{passive:true});
    reducedMedia.addEventListener?.('change',queue);
    readingMedia.addEventListener('change',queue);
    new ResizeObserver(queue).observe(contactArea);
    // Permite acceder directamente a #contacto con enlace de menú.
    document.querySelectorAll('a[href="#contacto"]').forEach(a=>a.addEventListener('click',e=>{
      e.preventDefault();
      const target=revealShell.getBoundingClientRect().top+scrollY+
        (readingMedia.matches?0:innerHeight*1.5);
      scrollTo({top:target,behavior:readingMedia.matches?'instant':'smooth'});
    }));
    requestAnimationFrame(updateContactReveal);
  }

  $('#year').textContent=new Date().getFullYear();
  // If the file is opened directly from disk, everything works without a local server.

}
