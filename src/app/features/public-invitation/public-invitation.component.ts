import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../../core/services/alert.service';
import { PublicInvitationService } from './public-invitation.service';
import { PublicInvitation, PublicGuestStatus, PublicGiftSelectionInput } from './public-invitation.models';

@Component({
  selector: 'app-public-invitation',
  imports: [DatePipe],
  styleUrl: './public-invitation.component.scss',
  templateUrl: './public-invitation.component.html',
})
export class PublicInvitationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly invitationService = inject(PublicInvitationService);
  private readonly alerts = inject(AlertService);

  protected invitation = signal<PublicInvitation | null>(null);
  protected isLoading = signal(true);
  protected loadError = signal(false);
  protected savingGuestId = signal<string | null>(null);
  protected selectedGiftQuantities = signal<Record<string, number>>({});
  protected isSavingGifts = signal(false);

  private accessToken = '';

  async ngOnInit(): Promise<void> {
    this.accessToken =
      this.route.snapshot.paramMap.get('accessToken') ?? '';

    await this.loadInvitation();
  }

  protected async loadInvitation(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      const loadedInvitation = this.accessToken
        ? await this.invitationService.findByToken(this.accessToken)
        : null;

      this.invitation.set(loadedInvitation);

      this.selectedGiftQuantities.set(
        Object.fromEntries(
          (loadedInvitation?.gifts ?? [])
            .filter((gift) => gift.selected_quantity > 0)
            .map((gift) => [gift.event_gift_id, gift.selected_quantity]),
        ),
      );
    } catch (error) {
      console.error('Erro ao carregar convite público:', error);
      this.loadError.set(true);
      await this.alerts.error('Não foi possível carregar este convite.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async respond(
    invitationGuestId: string,
    status: 'confirmed' | 'declined',
  ): Promise<void> {
    if (this.savingGuestId() || !this.invitation()?.event.can_confirm) {
      return;
    }

    this.savingGuestId.set(invitationGuestId);

    try {
      await this.invitationService.respond(
        this.accessToken,
        invitationGuestId,
        status,
      );

      await this.loadInvitation();
    } catch (error) {
      console.error('Erro ao registrar resposta:', error);
      await this.alerts.error(
        'Não foi possível registrar sua resposta. Confira se o prazo ainda está aberto.',
      );
    } finally {
      this.savingGuestId.set(null);
    }
  }

  protected statusLabel(status: PublicGuestStatus): string {
    const labels: Record<PublicGuestStatus, string> = {
      pending: 'Aguardando resposta',
      confirmed: 'Presença confirmada',
      declined: 'Não poderá comparecer',
    };

    return labels[status];
  }

  protected hasConfirmedGuest(): boolean {
    return this.invitation()?.guests.some(
      (guest) => guest.status === 'confirmed',
    ) ?? false;
  }

  protected isGiftSelected(eventGiftId: string): boolean {
    return Object.prototype.hasOwnProperty.call(
      this.selectedGiftQuantities(),
      eventGiftId,
    );
  }

  protected toggleGift(eventGiftId: string, checked: boolean): void {
    this.selectedGiftQuantities.update((quantities) => {
      const next = { ...quantities };

      if (checked) {
        next[eventGiftId] = 1;
      } else {
        delete next[eventGiftId];
      }

      return next;
    });
  }

  protected setGiftQuantity(eventGiftId: string, quantity: number): void {
    this.selectedGiftQuantities.update((quantities) => ({
      ...quantities,
      [eventGiftId]: quantity,
    }));
  }

  protected giftSelectionInputs(): PublicGiftSelectionInput[] {
    return Object.entries(this.selectedGiftQuantities()).map(
      ([event_gift_id, quantity]) => ({
        event_gift_id,
        quantity,
      }),
    );
  }

  protected canSaveGiftSelections(): boolean {
    const invitation = this.invitation();
    const selections = this.giftSelectionInputs();

    if (!invitation?.event.can_select_gifts) return false;

    const hasChanges = invitation.gifts.some(
      (gift) =>
        (this.selectedGiftQuantities()[gift.event_gift_id] ?? 0) !==
        gift.selected_quantity,
    );

    const validQuantities = selections.every((selection) => {
      const gift = invitation.gifts.find(
        (item) => item.event_gift_id === selection.event_gift_id,
      );

      return (
        gift !== undefined &&
        Number.isInteger(selection.quantity) &&
        selection.quantity > 0 &&
        selection.quantity <= gift.available_quantity
      );
    });

    return hasChanges && validQuantities;
  }

  protected async saveGiftSelections(): Promise<void> {
    if (!this.canSaveGiftSelections() || this.isSavingGifts()) return;

    this.isSavingGifts.set(true);

    try {
      await this.invitationService.saveGiftSelections(
        this.accessToken,
        this.giftSelectionInputs(),
      );

      await this.loadInvitation();
      await this.alerts.success('Suas escolhas de presentes foram salvas.');
    } catch (error) {
      console.error('Erro ao salvar escolhas de presentes:', error);
      await this.alerts.error(
        'Não foi possível salvar. Confira se ainda há unidades disponíveis.',
      );
    } finally {
      this.isSavingGifts.set(false);
    }
  }

  protected giftQuantity(eventGiftId: string): number {
    return this.selectedGiftQuantities()[eventGiftId] ?? 1;
  }

  protected adjustGiftQuantity(
    eventGiftId: string,
    change: number,
    availableQuantity: number,
  ): void {
    if (availableQuantity < 1) return;

    const current = this.giftQuantity(eventGiftId);
    const next = Math.max(
      1,
      Math.min(availableQuantity, current + change),
    );

    this.setGiftQuantity(eventGiftId, next);
  }

  protected visibleGifts(
    gifts: PublicInvitation['gifts'],
  ): PublicInvitation['gifts'] {
    return gifts.filter(
      (gift) =>
        gift.selected_quantity > 0 ||
        gift.available_quantity - gift.selected_quantity > 0,
    );
  }
}
