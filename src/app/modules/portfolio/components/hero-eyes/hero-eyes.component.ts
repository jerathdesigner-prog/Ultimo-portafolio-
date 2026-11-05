import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  inject,
  viewChildren,
} from '@angular/core';

import {
  HERO_EYES,
  HERO_EYES_PATCH,
  HERO_IMAGE_SIZE,
  type Point,
  imagePercentBox,
  pupilBox,
  pupilTarget,
} from './hero-eyes.geometry';

/** Fraction of the remaining distance covered per frame (eased follow). */
const FOLLOW = 0.18;
/** Pointer distance, in illustration widths, at which the pupils hit the lids. */
const REACH = 0.35;

/**
 * Pupils of the hero illustration that follow the mouse. Overlays the eye
 * region with the pupil-less patch and moves CSS pupils inside each eye.
 * Touch screens and reduced motion keep the original pose (no listeners).
 * Runs outside Angular: only `style` writes per frame, no change detection.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hero-eyes',
  standalone: true,
  styleUrl: './hero-eyes.component.scss',
  templateUrl: './hero-eyes.component.html',
})
export class HeroEyesComponent {
  protected readonly patch = HERO_EYES_PATCH;
  protected readonly patchBox = imagePercentBox(HERO_EYES_PATCH);
  protected readonly eyes = HERO_EYES.map((eye) => ({
    box: imagePercentBox({
      height: eye.height,
      width: eye.width,
      x: eye.center.x - eye.width / 2,
      y: eye.center.y - eye.height / 2,
    }),
    rest: pupilBox(eye, eye.rest),
  }));

  private readonly pupils = viewChildren<ElementRef<HTMLElement>>('pupil');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const zone = inject(NgZone);
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const policy = matchMedia(
        '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
      );
      zone.runOutsideAngular(() => this.follow(destroyRef, policy));
    });
  }

  private follow(destroyRef: DestroyRef, policy: MediaQueryList): void {
    const current: Point[] = HERO_EYES.map((eye) => ({ ...eye.rest }));
    let pointer: Point | null = null;
    let frame = 0;

    const render = () => {
      frame = 0;
      const rect = this.host.nativeElement.getBoundingClientRect();
      const scale = rect.width / HERO_IMAGE_SIZE.width;
      let moving = false;
      HERO_EYES.forEach((eye, index) => {
        const onScreen = {
          x: rect.left + eye.center.x * scale,
          y: rect.top + eye.center.y * scale,
        };
        const target = pointer
          ? pupilTarget(eye, onScreen, pointer, rect.width * REACH)
          : eye.rest;
        const pupil = current[index];
        pupil.x += (target.x - pupil.x) * FOLLOW;
        pupil.y += (target.y - pupil.y) * FOLLOW;
        moving ||= Math.hypot(target.x - pupil.x, target.y - pupil.y) > 0.05;
        const box = pupilBox(eye, pupil);
        const style = this.pupils()[index]?.nativeElement.style;
        if (style) {
          style.left = `${box.left}%`;
          style.top = `${box.top}%`;
        }
      });
      if (moving) {
        schedule();
      }
    };
    const schedule = () => {
      if (!policy.matches || document.hidden) return;
      frame ||= requestAnimationFrame(render);
    };
    const onMove = (event: PointerEvent) => {
      if (!policy.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onLeave = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        pointer = null;
        schedule();
      }
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      HERO_EYES.forEach((eye, index) => {
        current[index] = { ...eye.rest };
        const style = this.pupils()[index]?.nativeElement.style;
        const box = pupilBox(eye, eye.rest);
        if (style) {
          style.left = `${box.left}%`;
          style.top = `${box.top}%`;
        }
      });
    };
    policy.addEventListener('change', reset);
    document.addEventListener('visibilitychange', reset);
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('scroll', schedule, { passive: true });
    document.documentElement.addEventListener('pointerout', onLeave);
    destroyRef.onDestroy(() => {
      cancelAnimationFrame(frame);
      policy.removeEventListener('change', reset);
      document.removeEventListener('visibilitychange', reset);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', schedule);
      document.documentElement.removeEventListener('pointerout', onLeave);
    });
  }
}
