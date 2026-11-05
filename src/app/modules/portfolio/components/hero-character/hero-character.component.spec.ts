import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HeroEyesComponent } from '../hero-eyes/hero-eyes.component';
import { HeroCharacterComponent } from './hero-character.component';

@Component({ selector: 'app-hero-eyes', standalone: true, template: '' })
class EyesStub {}

describe('original character head layer', () => {
  let frames: FrameRequestCallback[];
  let policy: {
    addEventListener: ReturnType<typeof vi.fn>;
    matches: boolean;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    frames = [];
    policy = {
      addEventListener: vi.fn<() => void>(),
      matches: true,
      removeEventListener: vi.fn<() => void>(),
    };
    vi.stubGlobal('matchMedia', () => policy);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    TestBed.configureTestingModule({ imports: [HeroCharacterComponent] });
    TestBed.overrideComponent(HeroCharacterComponent, {
      add: { imports: [EyesStub] },
      remove: { imports: [HeroEyesComponent] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function create() {
    const fixture = TestBed.createComponent(HeroCharacterComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.spyOn(fixture.nativeElement, 'getBoundingClientRect').mockReturnValue({
      height: 1500,
      left: 0,
      top: 0,
      width: 1000,
    } as DOMRect);
    return fixture;
  }

  function settle() {
    for (let i = 0; frames.length && i < 100; i++) {
      const next = frames;
      frames = [];
      next.forEach((callback) => callback(0));
    }
  }

  it('uses only the original illustration and moves the head independently', async () => {
    const fixture = await create();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('canvas')).toBeNull();
    expect(element.querySelector('filter')).toBeNull();
    expect(element.querySelectorAll('img')).toHaveLength(2);
    expect(
      [...element.querySelectorAll('img')].every(
        (img) => img.getAttribute('src') === '/static/media/a0ea6851412f.webp',
      ),
    ).toBe(true);
    const event = new MouseEvent('pointermove', { clientX: 1000, clientY: 0 });
    dispatchEvent(event);
    settle();
    expect(
      element.querySelector<HTMLElement>('.hero-character__head')?.style
        .transform,
    ).toContain('skewX(');
    expect(
      element.querySelector<HTMLElement>('.hero-character__body')?.style
        .transform,
    ).toBe('');
    dispatchEvent(new Event('blur'));
    settle();
    expect(
      element.querySelector<HTMLElement>('.hero-character__head')?.style
        .transform,
    ).toBe('none');
    fixture.destroy();
  });

  it('keeps the original pose for reduced motion or touch and removes listeners', async () => {
    policy.matches = false;
    const fixture = await create();
    dispatchEvent(new MouseEvent('pointermove', { clientX: 1000, clientY: 0 }));
    settle();
    expect(
      fixture.nativeElement.querySelector('.hero-character__head').style
        .transform,
    ).not.toContain('skewX(');
    fixture.destroy();
    expect(policy.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});
