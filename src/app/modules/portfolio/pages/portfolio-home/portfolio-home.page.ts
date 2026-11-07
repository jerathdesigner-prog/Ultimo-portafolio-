import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';

import { ContactLanyardComponent } from '../../components/contact-lanyard/contact-lanyard.component';
import { HeroCharacterComponent } from '../../components/hero-character/hero-character.component';
import { PortfolioTechTextComponent } from '../../components/portfolio-tech-text/portfolio-tech-text.component';
import { ServicePanelComponent } from '../../components/service-panel/service-panel.component';
import { ContactSpecularDirective } from '../../directives/contact-specular.directive';
import { RecognitionSwapDirective } from '../../directives/recognition-swap.directive';
import type { PublicPortfolio } from '../../interfaces/portfolio.interface';
import { startPortfolioMotion } from '../../legacy/portfolio-motion';
import { PortfolioService } from '../../services/portfolio.service';

/**
 * The whole one-page portfolio. Renders the markup once the content is
 * available, then starts the legacy motion script exactly once over it.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HeroCharacterComponent,
    ContactLanyardComponent,
    PortfolioTechTextComponent,
    ServicePanelComponent,
    ContactSpecularDirective,
    RecognitionSwapDirective,
  ],
  selector: 'app-portfolio-home-page',
  standalone: true,
  styleUrl: './portfolio-home.page.scss',
  templateUrl: './portfolio-home.page.html',
})
export class PortfolioHomePage {
  private readonly injector = inject(Injector);
  private started = false;

  // Not toSignal(): federation does not share `@angular/core/rxjs-interop`
  // (front-template shares @angular/core without secondary entry points).
  protected readonly content = signal<PublicPortfolio | undefined>(undefined);

  constructor() {
    const subscription = inject(PortfolioService)
      .load()
      .subscribe((content) => this.content.set(content));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    effect(() => {
      const content = this.content();
      if (!content || this.started) {
        return;
      }
      this.started = true;
      afterNextRender(() => startPortfolioMotion(content), {
        injector: this.injector,
      });
    });
  }
}
