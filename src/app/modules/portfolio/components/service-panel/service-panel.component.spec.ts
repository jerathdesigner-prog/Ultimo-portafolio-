import { TestBed } from '@angular/core/testing';

import type {
  PortfolioServiceItem,
  PublicPortfolio,
} from '../../interfaces/portfolio.interface';
import { ServicePanelComponent } from './service-panel.component';

const DESIGN: PortfolioServiceItem = {
  coverMediaId: 'cover',
  id: 'srv_diseno',
  slug: 'diseno',
  subtitle: 'Texto anterior del servicio',
  title: 'Identidad visual desde el admin',
};

function render(projectCount = 2) {
  const fixture = TestBed.createComponent(ServicePanelComponent);
  const content: PublicPortfolio = {
    media: [{ id: 'cover', kind: 'image', url: '/uploads/old-cover.png' }],
    projects: [
      ...Array.from({ length: projectCount }, (_, index) => ({
        id: `work_${index + 1}`,
        serviceId: DESIGN.id,
        title: `Trabajo ${index + 1}`,
      })),
      { id: 'other', serviceId: 'other-service', title: 'Otro servicio' },
    ],
    services: [DESIGN],
  };
  fixture.componentRef.setInput('content', content);
  fixture.componentRef.setInput('service', DESIGN);
  fixture.detectChanges();
  return { element: fixture.nativeElement as HTMLElement, fixture };
}

describe('ServicePanelComponent folders', () => {
  it('keeps touch items available when the finger lifts without focusing a button', () => {
    const { element, fixture } = render();
    const folder = element.querySelector<HTMLElement>('app-service-folder')!;
    const trigger = folder.querySelector<HTMLButtonElement>(
      '.folder-float__trigger',
    )!;
    trigger.click();
    fixture.detectChanges();
    const lift = new Event('pointerleave');
    Object.defineProperty(lift, 'pointerType', { value: 'touch' });
    folder.dispatchEvent(lift);
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(
      folder.querySelector('.folder-float__items')?.hasAttribute('inert'),
    ).toBe(false);
    folder.querySelector<HTMLButtonElement>('[data-service="work_1"]')!.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps the admin title and replaces the old cover, number and subtitle', () => {
    const { element } = render();
    expect(element.querySelector('h3')?.textContent).toBe(DESIGN.title);
    expect(element.querySelector('.folder-float')).not.toBeNull();
    expect(element.querySelector('.panel-number')).toBeNull();
    expect(element.querySelector('.sample-button')).toBeNull();
    expect(element.querySelector('.service-list')).toBeNull();
    expect(element.querySelector('header p')).toBeNull();
    expect(element.querySelector('img, video')).toBeNull();
    expect(element.textContent).not.toContain('Otro servicio');
  });

  it('opens and closes the folder accessibly, retaining each project id', () => {
    const { element, fixture } = render();
    const trigger = element.querySelector<HTMLButtonElement>(
      '.folder-float__trigger',
    )!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const project = element.querySelector<HTMLButtonElement>(
      '[data-service="work_2"]',
    )!;
    expect(project.textContent?.trim()).toBe('Trabajo 2');
    project.click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('paginates beyond six projects without dropping any admin content', () => {
    const { element, fixture } = render(8);
    element.querySelector<HTMLButtonElement>('.folder-float__trigger')!.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('[data-service]')).toHaveLength(6);
    element
      .querySelector<HTMLButtonElement>('[aria-label="Siguientes trabajos"]')!
      .click();
    fixture.detectChanges();
    expect(
      [...element.querySelectorAll('[data-service]')].map((button) =>
        button.getAttribute('data-service'),
      ),
    ).toEqual(['work_7', 'work_8']);
    element
      .querySelector<HTMLButtonElement>('[aria-label="Trabajos anteriores"]')!
      .click();
    fixture.detectChanges();
    expect(element.querySelectorAll('[data-service]')).toHaveLength(6);
  });

  it('keeps an empty service understandable without a broken cover', () => {
    const { element } = render(0);
    expect(element.querySelector('h3')?.textContent).toBe(DESIGN.title);
    expect(
      element.querySelector<HTMLButtonElement>('.folder-float__trigger')
        ?.disabled,
    ).toBe(true);
    expect(element.textContent).toContain('Próximamente');
    expect(element.querySelectorAll('[data-service]')).toHaveLength(0);
  });
});
