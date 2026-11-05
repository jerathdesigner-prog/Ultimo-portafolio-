import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

import { HeroEyesComponent } from '../hero-eyes/hero-eyes.component';
import { HERO_IMAGE_SIZE, type Point } from '../hero-eyes/hero-eyes.geometry';
import { headTarget } from './hero-head.geometry';

/** Original artwork with compositor-only motion anchored at the shirt collar. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-label': 'Personaje de Jerath Moreira con gorra hacia atrás',
    role: 'img',
  },
  imports: [HeroEyesComponent],
  selector: 'app-hero-character',
  standalone: true,
  styleUrl: './hero-character.component.scss',
  templateUrl: './hero-character.component.html',
})
export class HeroCharacterComponent {
  private readonly head = viewChild.required<ElementRef<HTMLElement>>('head');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      zone.runOutsideAngular(() => this.follow(destroyRef));
    });
  }

  private follow(destroyRef: DestroyRef): void {
    const policy = matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    const head = this.head().nativeElement;
    const current = { pitch: 0, tilt: 0, yaw: 0 };
    let pointer: Point | null = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      // Measure the stationary illustration rather than the already rotated head.
      const rect = this.host.nativeElement.getBoundingClientRect();
      const scale = rect.width / HERO_IMAGE_SIZE.width;
      const center = { x: rect.left + 1470 * scale, y: rect.top + 515 * scale };
      const target = headTarget(
        center,
        policy.matches ? pointer : null,
        rect.width,
      );
      let moving = false;
      for (const key of ['pitch', 'tilt', 'yaw'] as const) {
        current[key] += (target[key] - current[key]) * 0.18;
        moving ||= Math.abs(target[key] - current[key]) > 0.005;
        if (Math.abs(target[key] - current[key]) < 0.005) {
          current[key] = target[key];
        }
      }
      head.style.transform =
        policy.matches &&
        (Math.abs(current.yaw) > 0.005 || Math.abs(current.pitch) > 0.005)
          ? `skewX(${-current.yaw * 0.15}deg) scaleY(${1 + current.pitch * 0.0007})`
          : 'none';
      if (moving) {
        schedule();
      }
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      if (policy.matches && event.pointerType !== 'touch') {
        pointer = { x: event.clientX, y: event.clientY };
        schedule();
      }
    };
    const reset = () => {
      pointer = null;
      schedule();
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        reset();
      }
    };
    const onScroll = () => {
      if (pointer) {
        schedule();
      }
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    addEventListener('blur', reset);
    document.documentElement.addEventListener('pointerout', onLeave);
    policy.addEventListener('change', reset);
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      removeEventListener('blur', reset);
      document.documentElement.removeEventListener('pointerout', onLeave);
      policy.removeEventListener('change', reset);
    });
  }
}
