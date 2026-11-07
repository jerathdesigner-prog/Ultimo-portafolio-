import {
  DestroyRef,
  Directive,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
} from '@angular/core';

/** Pointer-driven reflection for the existing contact link; no layout changes. */
@Directive({
  host: { class: 'specular-contact' },
  selector: '[appContactSpecular]',
  standalone: true,
})
export class ContactSpecularDirective {
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.attach()));
  }

  private attach(): void {
    const element = this.element.nativeElement;
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const property of [
        '--specular-x',
        '--specular-y',
        '--specular-strength',
      ]) {
        element.style.removeProperty(property);
      }
    };
    const paint = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const dx = Math.max(rect.left - x, 0, x - rect.right);
      const dy = Math.max(rect.top - y, 0, y - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance >= 250 || rect.bottom < 0 || rect.top > innerHeight) {
        reset();
        return;
      }
      element.style.setProperty('--specular-x', `${x - rect.left}px`);
      element.style.setProperty('--specular-y', `${y - rect.top}px`);
      element.style.setProperty(
        '--specular-strength',
        String(0.35 + 0.65 * (1 - distance / 250)),
      );
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const sync = () => {
      window.removeEventListener('pointermove', move);
      reset();
      if (fine.matches && !reduced.matches) {
        window.addEventListener('pointermove', move, { passive: true });
      }
    };
    sync();
    fine.addEventListener('change', sync);
    reduced.addEventListener('change', sync);
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', reset, { passive: true });
    this.destroyRef.onDestroy(() => {
      reset();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', reset);
      fine.removeEventListener('change', sync);
      reduced.removeEventListener('change', sync);
    });
  }
}
