import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../core/services/alert.service';
import { ModalComponent } from '../../../shared/ui/modal.component/modal.component';
import { Gift, GiftInput } from './gifts.models';
import { GiftService } from './gifts.service';

@Component({
  imports: [FormsModule, ModalComponent],
  selector: 'app-gifts',
  styleUrl: './gifts.component.scss',
  templateUrl: './gifts.component.html',
})
export class GiftsComponent implements OnInit {
  private readonly giftService = inject(GiftService);
  private readonly alerts = inject(AlertService);

  protected readonly gifts = signal<Gift[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly isGiftModalOpen = signal(false);
  protected readonly editingGift = signal<Gift | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected giftName = '';
  protected giftDescription = '';

  protected readonly filteredGifts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();

    if (!term) return this.gifts();

    return this.gifts().filter((gift) =>
      `${gift.name} ${gift.description ?? ''}`.toLowerCase().includes(term),
    );
  });

  ngOnInit(): void {
    void this.loadGifts();
  }

  protected async loadGifts(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      this.gifts.set(await this.giftService.findAll());
    } catch (error) {
      console.error('Erro ao carregar presentes:', error);
      this.loadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected openCreateGift(): void {
    this.editingGift.set(null);
    this.giftName = '';
    this.giftDescription = '';
    this.formError.set(null);
    this.isGiftModalOpen.set(true);
  }

  protected openEditGift(gift: Gift): void {
    this.editingGift.set(gift);
    this.giftName = gift.name;
    this.giftDescription = gift.description ?? '';
    this.formError.set(null);
    this.isGiftModalOpen.set(true);
  }

  protected closeGiftModal(): void {
    this.isGiftModalOpen.set(false);
    this.editingGift.set(null);
    this.giftName = '';
    this.giftDescription = '';
    this.formError.set(null);
  }

  protected async saveGift(): Promise<void> {
    const input: GiftInput = {
      name: this.giftName.trim(),
      description: this.giftDescription.trim() || null,
    };

    if (!input.name) {
      this.formError.set('Informe o nome do presente.');
      return;
    }

    if (this.isSaving()) return;

    this.isSaving.set(true);
    this.formError.set(null);

    try {
      const currentGift = this.editingGift();

      if (currentGift) {
        const updatedGift = await this.giftService.update(currentGift.id, input);

        this.gifts.update((gifts) =>
          gifts.map((gift) =>
            gift.id === updatedGift.id ? updatedGift : gift,
          ),
        );
      } else {
        const createdGift = await this.giftService.create(input);
        this.gifts.update((gifts) => [...gifts, createdGift]);
      }

      this.closeGiftModal();
      await this.alerts.success(
        currentGift
          ? 'Presente atualizado com sucesso.'
          : 'Presente criado com sucesso.',
      );
    } catch (error) {
      console.error('Erro ao salvar presente:', error);
      this.formError.set('Não foi possível salvar. Verifique os dados e tente novamente.');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async deleteGift(gift: Gift): Promise<void> {
    const confirmation = await this.alerts.confirm(
      `Deseja excluir "${gift.name}" do catálogo?`,
      false,
      'Excluir presente?',
    );

    if (!confirmation.isConfirmed) return;

    try {
      await this.giftService.remove(gift.id);

      this.gifts.update((gifts) =>
        gifts.filter((item) => item.id !== gift.id),
      );

      await this.alerts.success('Presente excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir presente:', error);

      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : '';

      await this.alerts.error(
        code === '23503'
          ? 'Este presente está vinculado a um evento e não pode ser excluído.'
          : 'Não foi possível excluir o presente.',
      );
    }
  }
}
