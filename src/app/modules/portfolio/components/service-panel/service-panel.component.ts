import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type {
  PortfolioServiceItem,
  PublicPortfolio,
} from '../../interfaces/portfolio.interface';
import { ServiceFolderComponent } from '../service-folder/service-folder.component';

/**
 * One service of the horizontal "works" track. Attribute selector so the
 * `<article class="service-panel">` stays a direct child of the track, with
 * the exact markup the legacy motion script and styles expect.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'service-panel--folder' },
  imports: [ServiceFolderComponent],
  selector: 'article[appServicePanel]',
  standalone: true,
  styleUrl: './service-panel.component.scss',
  templateUrl: './service-panel.component.html',
})
export class ServicePanelComponent {
  readonly content = input.required<PublicPortfolio>();
  readonly service = input.required<PortfolioServiceItem>();

  protected readonly projects = computed(() =>
    this.content().projects.filter((p) => p.serviceId === this.service().id),
  );
}
