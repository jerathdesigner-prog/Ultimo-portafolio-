import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
} from '@angular/core';

import { mountRecognitionSwap } from './recognition-swap.engine';

@Directive({
  host: { class: 'card-swap' },
  selector: '[appRecognitionSwap]',
  standalone: true,
})
export class RecognitionSwapDirective {
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLDivElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.attach()));
  }

  private attach(): void {
    const root = this.element.nativeElement;
    const section = root.closest('section')!;
    const cards = [...root.querySelectorAll<HTMLButtonElement>('.award-card')];
    const counter = section.querySelector<HTMLElement>('#awards-counter')!;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    const stage = document.createElement('div');
    stage.className = 'card-swap-stage';
    const shades: HTMLSpanElement[] = [];
    const slots = cards.map((card, index) => {
      const slot = document.createElement('div');
      slot.className = 'card-swap-slot';
      slot.dataset['swapIndex'] = String(index);
      card.querySelectorAll('img').forEach((image) => {
        image.draggable = false;
      });
      slot.appendChild(card);
      const shade = document.createElement('span');
      shade.className = 'card-swap-shade';
      shade.setAttribute('aria-hidden', 'true');
      shades.push(shade);
      slot.appendChild(shade);
      stage.appendChild(slot);
      return slot;
    });
    root.appendChild(stage);
    const updateCounter = (index: number) => {
      counter.textContent = `${String(index + 1).padStart(2, '0')} / ${cards.length}`;
      counter.setAttribute(
        'aria-label',
        `Reconocimiento ${index + 1} de ${cards.length}`,
      );
    };
    const makeEngine = () =>
      mountRecognitionSwap(
        root,
        stage,
        slots,
        shades,
        !paused && !motion.matches,
        updateCounter,
      );
    let engine = makeEngine();
    updateCounter(0);
    const syncPause = () => {
      const stopped = paused || motion.matches;
      counter.setAttribute('aria-live', stopped ? 'polite' : 'off');
      engine.setAutoplay(!stopped);
    };
    syncPause();
    const preference = () => {
      engine.destroy();
      engine = makeEngine();
      updateCounter(0);
      syncPause();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === ' ' && event.target === root) {
        event.preventDefault();
        paused = !paused;
        syncPause();
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.key === 'ArrowLeft') engine.prev();
        else engine.next();
        root.focus({ preventScroll: true });
      }
    };
    root.addEventListener('keydown', keyboard);
    motion.addEventListener('change', preference);
    this.destroyRef.onDestroy(() => {
      engine.destroy();
      root.removeEventListener('keydown', keyboard);
      motion.removeEventListener('change', preference);
      for (const card of cards) root.appendChild(card);
      stage.remove();
    });
  }
}
