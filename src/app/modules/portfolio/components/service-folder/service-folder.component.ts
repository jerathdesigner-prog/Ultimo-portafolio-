import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import type {
  PortfolioProject,
  PortfolioServiceItem,
} from '../../interfaces/portfolio.interface';
import {
  type FolderMotionHandle,
  mountFolderMotion,
} from './service-folder.engine';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'outside($event)',
    '(focusout)': 'focusOut($event)',
    '(keydown)': 'keyDown($event)',
    '(pointerenter)': 'enter($event)',
    '(pointerleave)': 'leave($event)',
    '[attr.data-open]': 'opened() ? "" : null',
    class: 'folder-float',
  },
  selector: 'app-service-folder',
  standalone: true,
  styleUrl: './service-folder.component.scss',
  templateUrl: './service-folder.component.html',
})
export class ServiceFolderComponent {
  readonly projects = input.required<PortfolioProject[]>();
  readonly service = input.required<PortfolioServiceItem>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly trigger =
    viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private motion: FolderMotionHandle | undefined;
  private readonly page = signal(0);

  protected readonly opened = signal(false);
  protected readonly pageCount = computed(() =>
    Math.ceil(this.projects().length / 6),
  );
  protected readonly pageIndex = computed(() =>
    Math.min(this.page(), Math.max(0, this.pageCount() - 1)),
  );
  protected readonly visibleProjects = computed(() =>
    this.projects().slice(this.pageIndex() * 6, (this.pageIndex() + 1) * 6),
  );
  protected readonly itemsId = computed(
    () => `folder-projects-${this.service().id}`,
  );
  protected readonly countLabel = computed(() => {
    const count = this.projects().length;
    return count
      ? `${count} ${count === 1 ? 'trabajo' : 'trabajos'}`
      : 'Próximamente';
  });

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      this.zone.runOutsideAngular(() => {
        this.motion = mountFolderMotion(this.element.nativeElement, () =>
          this.zone.run(() => this.opened.set(false)),
        );
      });
    });
    this.destroyRef.onDestroy(() => this.motion?.destroy());
  }

  protected toggle(): void {
    if (this.projects().length) this.opened.update((open) => !open);
  }

  protected select(): void {
    this.opened.set(false);
  }

  protected changePage(direction: number): void {
    this.page.set(
      Math.max(0, Math.min(this.pageCount() - 1, this.pageIndex() + direction)),
    );
    requestAnimationFrame(() => {
      if (this.destroyRef.destroyed || !this.opened()) return;
      this.element.nativeElement
        .querySelector<HTMLButtonElement>('.folder-float__item')
        ?.focus({ preventScroll: true });
    });
  }

  protected enter(event: PointerEvent): void {
    if (
      event.pointerType === 'mouse' &&
      globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches &&
      this.projects().length
    )
      this.opened.set(true);
  }

  protected leave(event: PointerEvent): void {
    // Touch sends pointerleave on finger lift, before click on some browsers.
    // Only a genuine hover-capable mouse should close the folder this way.
    if (
      event.pointerType !== 'mouse' ||
      !globalThis.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    )
      return;
    if (
      this.motion?.isDragging() ||
      this.element.nativeElement.contains(document.activeElement)
    )
      return;
    this.opened.set(false);
  }

  protected outside(event: PointerEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node))
      this.opened.set(false);
  }

  protected focusOut(event: FocusEvent): void {
    // Disabling the focused page arrow produces a temporary blur without a
    // related target. Keep the new page open and focus its first project.
    if (
      event.relatedTarget &&
      !this.element.nativeElement.contains(event.relatedTarget as Node)
    )
      this.opened.set(false);
  }

  protected keyDown(event: KeyboardEvent): void {
    const buttons = () => [
      ...this.element.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.folder-float__item',
      ),
    ];
    if (event.key === 'Escape' && this.opened()) {
      event.preventDefault();
      event.stopPropagation();
      this.opened.set(false);
      this.trigger().nativeElement.focus({ preventScroll: true });
    } else if (
      event.key === 'ArrowDown' &&
      event.target === this.trigger().nativeElement &&
      this.projects().length
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.opened.set(true);
      requestAnimationFrame(() => buttons()[0]?.focus({ preventScroll: true }));
    } else if (
      this.opened() &&
      [
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
      ].includes(event.key)
    ) {
      const list = buttons();
      const index = list.indexOf(event.target as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      event.stopPropagation();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? list.length - 1
            : (index +
                (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) +
                list.length) %
              list.length;
      list[next]?.focus({ preventScroll: true });
    }
  }
}
