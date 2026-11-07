import type { Routes } from '@angular/router';

/**
 * The public portfolio, mounted at `/` by app.routes.ts. Not exposed to a
 * federation host: it is served by the Cloudflare Worker as a standalone app,
 * so it skips the Temporal polyfill import exposed entries need (it uses no
 * Temporal; the `site` build in angular.json omits that polyfill too).
 */
export const PortfolioRoutes: Routes = [
  {
    loadComponent: () =>
      import('./pages/portfolio-home/portfolio-home.page').then(
        (m) => m.PortfolioHomePage,
      ),
    path: '',
    title: 'Jerath Moreira — Diseñador gráfico',
  },
];
