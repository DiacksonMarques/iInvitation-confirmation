import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const adminGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const isAdmin = await supabase.isAdmin();

  if (isAdmin) {
    return true;
  }

  return router.createUrlTree(['/admin/login']);
};
