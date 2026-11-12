import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-admin-layout',
  styleUrl: './admin-layout.component.scss',
  templateUrl: './admin-layout.component.html',
})
export class AdminLayoutComponent {

  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  async logout(): Promise<void> {
    try {
      await this.supabase.signOut();

      await this.router.navigate(['/admin/login']);
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
    }
  }
}
