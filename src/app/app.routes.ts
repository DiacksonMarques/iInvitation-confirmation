import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    loadComponent: () => import('./features/admin/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./features/admin/admin-layout.component/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'eventos',
        loadComponent: () => import('./features/admin/events/events.component').then((m) => m.EventsComponent),
      },
      {
        path: 'eventos/:eventId',
        loadComponent: () => import('./features/admin/event-management/event-management.component').then((m) => m.EventManagementComponent),
      },
      {
        path: 'convidados',
        loadComponent: () => import('./features/admin/guests/guests.component').then((m) => m.GuestsComponent),
      },
      {
        path: 'presentes',
        loadComponent: () => import('./features/admin/gifts/gifts.component').then((m) => m.GiftsComponent),
      },
    ]
  },
  {
    path: 'convite/:accessToken',
    loadComponent: () => import('./features/public-invitation/public-invitation.component').then((m) => m.PublicInvitationComponent),
  },
];
