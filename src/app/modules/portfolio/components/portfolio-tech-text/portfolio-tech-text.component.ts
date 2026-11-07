import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { mountPortfolioTechText } from './portfolio-tech-text.engine';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-ready]': 'ready()' },
  selector: 'app-portfolio-tech-text',
  standalone: true,
  styleUrl: './portfolio-tech-text.component.scss',
  template:
    '<span class="tech-text-fallback">PORTAFOLIO</span><canvas #canvas aria-hidden="true"></canvas>',
})
export class PortfolioTechTextComponent {
  private readonly canvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  protected readonly ready = signal(false);

  constructor() {
    afterNextRender(async () => {
      await document.fonts?.ready.catch(() => {});
      if (this.destroyRef.destroyed) return;
      this.zone.runOutsideAngular(() => {
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let cleanup: (() => void) | undefined;
        let frame = 0;
        const mount = () => {
          cleanup?.();
          cancelAnimationFrame(frame);
          this.ready.set(false);
          if (motion.matches) return;
          cleanup = mountPortfolioTechText(
            this.element.nativeElement,
            this.canvas().nativeElement,
          );
          frame = requestAnimationFrame(() => this.ready.set(true));
        };
        mount();
        motion.addEventListener('change', mount);
        this.destroyRef.onDestroy(() => {
          cancelAnimationFrame(frame);
          cleanup?.();
          motion.removeEventListener('change', mount);
        });
      });
    });
  }
}
