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

import type { ContactLanyardHandle } from './contact-lanyard.engine';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.enter)': 'flip($event)',
    '(keydown.space)': 'flip($event)',
    '[attr.aria-pressed]': 'flipped()',
    '[attr.data-renderer]': 'renderer()',
    '[class.is-nearby]': 'nearby()',
    '[class.is-ready]': 'ready()',
    'aria-label':
      'Credencial de Jerath Moreira: arrastra para mover; pulsa Enter o Espacio para girar',
    role: 'button',
    tabindex: '0',
  },
  selector: 'app-contact-lanyard',
  standalone: true,
  styleUrl: './contact-lanyard.component.scss',
  template: `<div class="lanyard-surface" #surface></div>
    <div class="lanyard-fallback" aria-hidden="true" (click)="fallbackFlip()">
      <span class="fallback-strap"></span>
      <span class="fallback-clip"></span>
      <img
        loading="lazy"
        decoding="async"
        [src]="
          flipped()
            ? '/static/media/contact-card-back.svg'
            : '/static/media/contact-card-front.svg'
        "
        alt=""
        width="240"
        height="338"
      />
    </div>`,
})
export class ContactLanyardComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly surface =
    viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly zone = inject(NgZone);
  private handle: ContactLanyardHandle | undefined;

  protected readonly flipped = signal(false);
  protected readonly nearby = signal(false);
  protected readonly ready = signal(false);
  protected readonly renderer = signal('static');

  constructor() {
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        const motion = matchMedia('(prefers-reduced-motion: reduce)');
        let generation = 0;
        const load = async () => {
          const token = ++generation;
          this.handle?.destroy();
          this.handle = undefined;
          this.ready.set(false);
          this.renderer.set('static');
          if (motion.matches) return;
          try {
            const { mountContactLanyard } =
              await import('./contact-lanyard.engine');
            if (this.destroyRef.destroyed || token !== generation) return;
            const handle = mountContactLanyard(
              this.surface().nativeElement,
              (value) => this.flipped.set(value),
            );
            this.handle = handle;
            if (!handle) return;
            await handle.ready;
            if (this.destroyRef.destroyed || token !== generation) return;
            this.ready.set(true);
            this.renderer.set('webgl');
          } catch {
            /* Keep the branded, keyboard-operable fallback. */
          }
        };
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) {
              this.nearby.set(true);
              observer.disconnect();
              motion.addEventListener('change', load);
              void load();
            }
          },
          { rootMargin: '100% 100%' },
        );
        observer.observe(this.element.nativeElement);
        this.destroyRef.onDestroy(() => {
          generation++;
          observer.disconnect();
          motion.removeEventListener('change', load);
          this.handle?.destroy();
        });
      }),
    );
  }

  protected flip(event: Event): void {
    event.preventDefault();
    if (this.handle) this.zone.runOutsideAngular(() => this.handle!.flip());
    else this.flipped.update((value) => !value);
  }

  protected fallbackFlip(): void {
    if (!this.ready()) this.flipped.update((value) => !value);
  }
}
