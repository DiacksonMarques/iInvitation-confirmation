import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Router } from '@angular/router';
import { AlertService } from '../../../core/services/alert.service';

@Component({
  imports: [CommonModule, ReactiveFormsModule],
  selector: 'app-login',
  styleUrl: './login.component.scss',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly alerts = inject(AlertService);

  loading: boolean = false;

  loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    try {
      const { email, password } = this.loginForm.getRawValue();

      await this.supabaseService.signIn(email, password);

      await this.router.navigate(['/admin']);
    } catch (error) {
      console.error('Erro ao realizar login:', error);
      await this.alerts.error('Verifique seu e-mail e senha.');
      this.loading = false;
    } finally {
      this.loading = false;
    }
  }
}
