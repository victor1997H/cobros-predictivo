import { Routes } from '@angular/router';

import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { DashboardHome } from './features/dashboard/pages/dashboard-home/dashboard-home';
import { ClientesList } from './features/clientes/pages/clientes-list/clientes-list';
import { CobrosList } from './features/cobros/pages/cobros-list/cobros-list';
import { PagosList } from './features/pagos/pages/pagos-list/pagos-list';
import { ReportesHome } from './features/reportes/pages/reportes-home/reportes-home';
import { ConfiguracionHome } from './features/configuracion/pages/configuracion-home/configuracion-home';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { MainLayout } from './layouts/main-layout/main-layout';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        component: Login,
      },
      {
        path: 'register',
        component: Register,
      },
    ],
  },

  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: 'dashboard',
        component: DashboardHome,
      },
      {
        path: 'clientes',
        component: ClientesList,
      },
      {
        path: 'cobros',
        component: CobrosList,
      },
      {
        path: 'pagos',
        component: PagosList,
      },
      {
        path: 'reportes',
        component: ReportesHome,
      },
      {
        path: 'configuracion',
        component: ConfiguracionHome,
      },
    ],
  },
];
