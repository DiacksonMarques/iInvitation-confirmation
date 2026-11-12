import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {

  private readonly pendingRequests = signal(0);
  readonly isLoading = signal(false);

  show(): void {
    this.pendingRequests.update((count) => count + 1);
    this.isLoading.set(true);
  }

  hide(): void {
    this.pendingRequests.update((count) => Math.max(0, count - 1));
    this.isLoading.set(this.pendingRequests() > 0);
  }

  async track<T>(operation: Promise<T>): Promise<T> {
    this.show();

    try {
      return await operation;
    } finally {
      this.hide();
    }
  }
}
