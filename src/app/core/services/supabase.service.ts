import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { LoadingService } from './loading.service';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {

  readonly client: SupabaseClient;

  constructor(private readonly loadingService: LoadingService) {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.loadingService.track(
      this.client.auth.signInWithPassword({ email, password })
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async signOut() {
    const { error } = await this.loadingService.track(this.client.auth.signOut({scope: 'local'}));

    if (error) {
      throw error;
    }
  }

  async getCurrentUser() {
     const {
      data: { session },
      error: sessionError,
    } = await this.client.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    // Usuário não está logado.
    // Isso não é um erro.
    if (!session) {
      return null;
    }


    const { data, error } = await this.loadingService.track(this.client.auth.getUser());

    if (error) {
      throw error;
    }

    return data.user;
  }

  async isAdmin(): Promise<boolean> {
    const user = await this.loadingService.track(this.getCurrentUser());

    if (!user) {
      return false;
    }

    const { data, error } = await this.client
      .from('admin_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar administrador:', error);
      return false;
    }

    return !!data;
  }
}
