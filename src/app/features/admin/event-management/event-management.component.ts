import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { AlertService } from '../../../core/services/alert.service';
import { EventService } from '../events/events.service';
import { Event } from '../events/events.models';
import { GroupView } from '../guests/guests.models';
import { InvitationGroupService } from '../guests/invitation-group.service';
import { EventInvitationService } from './event-invitation.service';
import { ModalComponent } from '../../../shared/ui/modal.component/modal.component';
import { Gift } from '../gifts/gifts.models';
import { GiftService } from '../gifts/gifts.service';
import { EventGiftService } from './event-gift.service';
import { EventGift, EventGiftInput } from '../events/events.models';
import { EventInvitation, InvitationDraft } from './event-management.models';

type ManagementTab = 'overview' | 'guests' | 'gifts';

@Component({
  selector: 'app-event-management',
  imports: [DatePipe, RouterLink, ModalComponent],
  styleUrl: './event-management.component.scss',
  templateUrl: './event-management.component.html',
})
export class EventManagementComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly eventService = inject(EventService);
  private readonly alerts = inject(AlertService);
  private readonly groupService = inject(InvitationGroupService);
  private readonly eventInvitationService = inject(EventInvitationService);
  private readonly giftService = inject(GiftService);
  private readonly eventGiftService = inject(EventGiftService);
  private readonly router = inject(Router);

  protected event = signal<Event | null>(null);
  protected isLoading = signal(true);
  protected loadError = signal(false);
  protected activeTab = signal<ManagementTab>('overview');

  protected groups = signal<GroupView[]>([]);
  protected eventInvitations = signal<EventInvitation[]>([]);
  protected isLoadingGuests = signal(false);
  protected guestsLoadError = signal(false);
  protected isGroupModalOpen = signal(false);
  protected isAddingGroups = signal(false);
  protected editingInvitationId = signal<string | null>(null);
  protected draftGuestIds = signal<string[]>([]);
  protected groupSearch = signal('');
  protected sharingInvitationId = signal<string | null>(null);
  protected selectedGroupId = signal<string | null>(null);
  protected invitationDrafts = signal<InvitationDraft[]>([]);
  protected isSplitInvitationModalOpen = signal(false);
  protected splitSourceInvitation = signal<EventInvitation | null>(null);
  protected splitGuestIds = signal<string[]>([]);
  protected splitInvitationLabel = signal('');
  protected isSplittingInvitation = signal(false);
  protected splitGuestSearch = signal('');

  private nextInvitationDraftId = 0;
  private guestDataLoaded = false;

  protected gifts = signal<Gift[]>([]);
  protected eventGifts = signal<EventGift[]>([]);
  protected isLoadingGifts = signal(false);
  protected giftsLoadError = signal(false);
  protected isGiftModalOpen = signal(false);
  protected giftSearch = signal('');
  protected selectedGiftQuantities = signal<Record<string, number>>({});
  protected isAddingGifts = signal(false);
  protected editingEventGiftId = signal<string | null>(null);
  protected draftEventGiftQuantity = signal<number | null>(null);
  protected savingEventGiftId = signal<string | null>(null);

  private giftDataLoaded = false;

  async ngOnInit(): Promise<void> {
    await this.loadEvent();
  }

  protected async loadEvent(): Promise<void> {
    const eventId = this.route.snapshot.paramMap.get('eventId');

    if (!eventId) {
      this.loadError.set(true);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(false);

    try {
      this.event.set(await this.eventService.findById(eventId));
    } catch (error) {
      console.error('Erro ao carregar evento:', error);
      this.loadError.set(true);
      await this.alerts.error('Não foi possível carregar este evento.');
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async selectTab(tab: ManagementTab): Promise<void> {
    this.activeTab.set(tab);

    if (tab === 'guests' && !this.guestDataLoaded) {
      await this.loadGuestAssociations();
    }

    if (tab === 'gifts' && !this.giftDataLoaded) {
      await this.loadEventGifts();
    }
  }

  protected statusLabel(status: Event['status']): string {
    const labels: Record<Event['status'], string> = {
      draft: 'Rascunho',
      active: 'Ativo',
      closed: 'Encerrado',
    };

    return labels[status];
  }

  private getEventId(): string | null {
    return this.route.snapshot.paramMap.get('eventId');
  }

  protected async loadGuestAssociations(): Promise<void> {
    const eventId = this.getEventId();

    if (!eventId) {
      this.guestsLoadError.set(true);
      return;
    }

    this.isLoadingGuests.set(true);
    this.guestsLoadError.set(false);

    try {
      const [groups, invitations] = await Promise.all([
        this.groupService.findAll(),
        this.eventInvitationService.findByEvent(eventId),
      ]);

      this.groups.set(groups);
      this.eventInvitations.set(invitations);
      this.guestDataLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar convidados do evento:', error);
      this.guestsLoadError.set(true);
      await this.alerts.error(
        'Não foi possível carregar os grupos e convidados.',
      );
    } finally {
      this.isLoadingGuests.set(false);
    }
  }

  protected availableGroups(): GroupView[] {
    const associatedGroupIds = new Set(
      this.eventInvitations().map((invitation) => invitation.invitation_group_id),
    );

    return this.groups().filter((group) => !associatedGroupIds.has(group.id));
  }

  protected groupForInvitation(invitation: EventInvitation): GroupView | undefined {
    return this.groups().find(
      (group) => group.id === invitation.invitation_group_id,
    );
  }

  protected guestStatus(invitation: EventInvitation, guestId: string): string | null {
    return invitation.event_invitation_guests.find(
      (item) => item.guest_id === guestId,
    )?.status ?? null;
  }

  protected openGroupModal(): void {
    this.selectedGroupId.set(null);
    this.invitationDrafts.set([]);
    this.groupSearch.set('');
    this.isGroupModalOpen.set(true);
  }

  protected closeGroupModal(): void {
    this.isGroupModalOpen.set(false);
    this.selectedGroupId.set(null);
    this.invitationDrafts.set([]);
  }

  protected selectInvitationGroup(group: GroupView): void {
    this.selectedGroupId.set(group.id);
    this.invitationDrafts.set([
      {
        id: ++this.nextInvitationDraftId,
        label: '',
        guestIds: group.guests.map((guest) => guest.id),
      },
    ]);
  }

  protected selectedGroupForInvitations(): GroupView | undefined {
    const groupId = this.selectedGroupId();
    return this.groups().find((group) => group.id === groupId);
  }

  protected clearSelectedInvitationGroup(): void {
    this.selectedGroupId.set(null);
    this.invitationDrafts.set([]);
  }

  protected addInvitationDraft(): void {
    this.invitationDrafts.update((drafts) => [
      ...drafts,
      {
        id: ++this.nextInvitationDraftId,
        label: '',
        guestIds: [],
      },
    ]);
  }

  protected setInvitationLabel(draftId: number, label: string): void {
    this.invitationDrafts.update((drafts) =>
      drafts.map((draft) =>
        draft.id === draftId ? { ...draft, label } : draft,
      ),
    );
  }

  protected isGuestAssignedToDraft(
    draftId: number,
    guestId: string,
  ): boolean {
    return (
      this.invitationDrafts()
        .find((draft) => draft.id === draftId)
        ?.guestIds.includes(guestId) ?? false
    );
  }

  protected toggleGuestAssignment(
    draftId: number,
    guestId: string,
    checked: boolean,
  ): void {
    this.invitationDrafts.update((drafts) =>
      drafts.map((draft) => {
        if (checked) {
          return {
            ...draft,
            guestIds:
              draft.id === draftId
                ? [...new Set([...draft.guestIds, guestId])]
                : draft.guestIds.filter((id) => id !== guestId),
          };
        }

        return draft.id === draftId
          ? {
              ...draft,
              guestIds: draft.guestIds.filter((id) => id !== guestId),
            }
          : draft;
      }),
    );
  }

  protected invitationPartitions(): Array<{
    label: string | null;
    guest_ids: string[];
  }> {
    const group = this.selectedGroupForInvitations();

    if (!group) return [];

    return this.invitationDrafts()
      .filter((draft) => draft.guestIds.length > 0)
      .map((draft) => {
        const names = group.guests
          .filter((guest) => draft.guestIds.includes(guest.id))
          .map((guest) => guest.name);

        const defaultLabel =
          names.length <= 2
            ? names.join(' e ')
            : `${names[0]} e mais ${names.length - 1}`;

        return {
          label: draft.label.trim() || defaultLabel,
          guest_ids: draft.guestIds,
        };
      });
  }

  protected canCreateInvitations(): boolean {
    return (
      this.selectedGroupId() !== null &&
      this.invitationPartitions().length > 0 &&
      !this.isAddingGroups()
    );
  }

  protected async createGroupInvitations(): Promise<void> {
    const eventId = this.getEventId();
    const groupId = this.selectedGroupId();
    const partitions = this.invitationPartitions();

    if (!eventId || !groupId || !partitions.length || this.isAddingGroups()) {
      return;
    }

    this.isAddingGroups.set(true);

    try {
      await this.eventInvitationService.createPartitions(
        eventId,
        groupId,
        partitions,
      );

      this.closeGroupModal();
      this.guestDataLoaded = false;
      await this.loadGuestAssociations();
      await this.alerts.success('Convites criados para o grupo.');
    } catch (error) {
      console.error('Erro ao criar convites para o grupo:', error);
      await this.alerts.error('Não foi possível criar os convites.');
    } finally {
      this.isAddingGroups.set(false);
    }
  }

  protected beginEditGuests(invitation: EventInvitation): void {
    this.editingInvitationId.set(invitation.id);
    this.draftGuestIds.set(
      invitation.event_invitation_guests.map((item) => item.guest_id),
    );
  }

  protected cancelEditGuests(): void {
    this.editingInvitationId.set(null);
    this.draftGuestIds.set([]);
  }

  protected isDraftGuestSelected(guestId: string): boolean {
    return this.draftGuestIds().includes(guestId);
  }

  protected toggleDraftGuest(guestId: string, checked: boolean): void {
    this.draftGuestIds.update((ids) =>
      checked
        ? [...new Set([...ids, guestId])]
        : ids.filter((id) => id !== guestId),
    );
  }

  protected async saveGuestChanges(
    invitation: EventInvitation,
  ): Promise<void> {
    const previousIds = invitation.event_invitation_guests.map(
      (item) => item.guest_id,
    );
    const nextIds = this.draftGuestIds();
    const removedCount = previousIds.filter((id) => !nextIds.includes(id)).length;

    if (removedCount > 0) {
      const confirmation = await this.alerts.confirm(
        `Serão removidos ${removedCount} participante(s) deste evento. Se isso remover a última confirmação do grupo, as escolhas de presentes desse convite também serão liberadas.`,
        false,
        'Salvar alterações?',
      );

      if (!confirmation.isConfirmed) return;
    }

    try {
      await this.eventInvitationService.syncGuests(invitation.id, nextIds);
      this.cancelEditGuests();
      this.guestDataLoaded = false;
      await this.loadGuestAssociations();
      await this.alerts.success('Participantes atualizados.');
    } catch (error) {
      console.error('Erro ao editar participantes:', error);
      await this.alerts.error('Não foi possível atualizar os participantes.');
    }
  }

  protected async removeGroupFromEvent(
    invitation: EventInvitation,
    groupName: string,
  ): Promise<void> {
    const confirmation = await this.alerts.confirm(
      `A associação de "${groupName}" será removida deste evento, junto com os participantes, as confirmações e as escolhas de presentes vinculadas a este convite.`,
      false,
      'Remover grupo do evento?',
    );

    if (!confirmation.isConfirmed) return;

    try {
      await this.eventInvitationService.removeInvitation(invitation.id);
      this.guestDataLoaded = false;
      await this.loadGuestAssociations();
      await this.alerts.success('Grupo removido deste evento.');
    } catch (error) {
      console.error('Erro ao remover grupo do evento:', error);
      await this.alerts.error('Não foi possível remover o grupo deste evento.');
    }
  }

  protected filteredAvailableGroups(): GroupView[] {
    const term = this.normalizeSearch(this.groupSearch().trim());

    if (!term) return this.availableGroups();

    return this.availableGroups().filter((group) => {
      const groupMatches = this.normalizeSearch(group.name).includes(term);
      const guestMatches = group.guests.some((guest) =>
        this.normalizeSearch(guest.name).includes(term),
      );

      return groupMatches || guestMatches;
    });
  }

  private normalizeSearch(value: string): string {
    return value
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  protected async loadEventGifts(): Promise<void> {
    const eventId = this.getEventId();

    if (!eventId) {
      this.giftsLoadError.set(true);
      return;
    }

    this.isLoadingGifts.set(true);
    this.giftsLoadError.set(false);

    try {
      const [catalog, associated] = await Promise.all([ this.giftService.findAll(), this.eventGiftService.findByEvent(eventId) ]);

      this.gifts.set(catalog);
      this.eventGifts.set(associated);
      this.giftDataLoaded = true;
    } catch (error) {
      console.error('Erro ao carregar presentes do evento:', error);
      this.giftsLoadError.set(true);
      await this.alerts.error('Não foi possível carregar os presentes.');
    } finally {
      this.isLoadingGifts.set(false);
    }
  }

  protected availableGifts(): Gift[] {
    const associatedGiftIds = new Set(this.eventGifts().map((eventGift) => eventGift.gift_id));

    return this.gifts().filter((gift) => !associatedGiftIds.has(gift.id));
  }

  protected filteredAvailableGifts(): Gift[] {
    const term = this.normalizeSearch(this.giftSearch().trim());

    if (!term) return this.availableGifts();

    return this.availableGifts().filter((gift) =>
      this.normalizeSearch(`${gift.name} ${gift.description ?? ''}`).includes(term),
    );
  }

  protected openGiftModal(): void {
    this.giftSearch.set('');
    this.selectedGiftQuantities.set({});
    this.isGiftModalOpen.set(true);
  }

  protected closeGiftModal(): void {
    this.isGiftModalOpen.set(false);
    this.selectedGiftQuantities.set({});
    this.giftSearch.set('');
  }

  protected isGiftSelected(giftId: string): boolean {
    return Object.hasOwn(this.selectedGiftQuantities(), giftId);
  }

  protected toggleGift(giftId: string, checked: boolean): void {
    this.selectedGiftQuantities.update((quantities) => {
      const next = { ...quantities };

      if (checked) {
        next[giftId] = 1;
      } else {
        delete next[giftId];
      }

      return next;
    });
  }

  protected setGiftQuantity(giftId: string, quantity: number): void {
    this.selectedGiftQuantities.update((quantities) => ({ ...quantities, [giftId]: quantity }));
  }

  protected selectedGiftInputs(): EventGiftInput[] {
    return Object.entries(this.selectedGiftQuantities()).map(([gift_id, total_quantity]) => ({ gift_id, total_quantity }));
  }

  protected canAddSelectedGifts(): boolean {
    const items = this.selectedGiftInputs();

    return (
      items.length > 0 &&
      items.every(
        (item) =>
          Number.isInteger(item.total_quantity) &&
          item.total_quantity >= 1,
      )
    );
  }

  protected async addSelectedGifts(): Promise<void> {
    const eventId = this.getEventId();
    const items = this.selectedGiftInputs();

    if (!eventId || !this.canAddSelectedGifts() || this.isAddingGifts()) {
      return;
    }

    this.isAddingGifts.set(true);

    try {
      await this.eventGiftService.addMany(eventId, items);
      this.closeGiftModal();
      this.giftDataLoaded = false;
      await this.loadEventGifts();
      await this.alerts.success('Presentes adicionados ao evento.');
    } catch (error) {
      console.error('Erro ao associar presentes ao evento:', error);
      await this.alerts.error(
        'Não foi possível adicionar os presentes selecionados.',
      );
    } finally {
      this.isAddingGifts.set(false);
    }
  }

  protected closeActiveModal(): void {
    if (this.isSplitInvitationModalOpen()) {
      this.closeSplitInvitationModal();
    } else if (this.isGroupModalOpen()) {
      this.closeGroupModal();
    } else if (this.isGiftModalOpen()) {
      this.closeGiftModal();
    }
  }

  protected beginEditEventGift(eventGift: EventGift): void {
    this.editingEventGiftId.set(eventGift.id);
    this.draftEventGiftQuantity.set(eventGift.total_quantity);
  }

  protected cancelEditEventGift(): void {
    this.editingEventGiftId.set(null);
    this.draftEventGiftQuantity.set(null);
  }

  protected async saveEventGiftQuantity(eventGift: EventGift): Promise<void> {
    const quantity = this.draftEventGiftQuantity();

    if (!Number.isInteger(quantity) || quantity === null || quantity < 1) {
      await this.alerts.error('Informe uma quantidade inteira maior que zero.');
      return;
    }

    if (quantity < eventGift.selected_quantity) {
      await this.alerts.error(
        `Já existem ${eventGift.selected_quantity} unidade(s) escolhida(s). A quantidade total não pode ser menor que esse valor.`,
      );
      return;
    }

    if (this.savingEventGiftId()) return;

    this.savingEventGiftId.set(eventGift.id);

    try {
      await this.eventGiftService.updateQuantity(eventGift.id, quantity);

      this.eventGifts.update((items) =>
        items.map((item) =>
          item.id === eventGift.id
            ? { ...item, total_quantity: quantity }
            : item,
        ),
      );

      this.cancelEditEventGift();
      await this.alerts.success('Quantidade atualizada.');
    } catch (error) {
      console.error('Erro ao atualizar quantidade do presente:', error);
      await this.alerts.error(
        'Não foi possível atualizar. Confira se a quantidade não está abaixo das unidades já escolhidas.',
      );
    } finally {
      this.savingEventGiftId.set(null);
    }
  }

  protected async removeEventGift(eventGift: EventGift): Promise<void> {
    if (eventGift.selected_quantity > 0) {
      await this.alerts.error(
        'Este presente já foi escolhido por convidados e não pode ser removido.',
      );
      return;
    }

    const confirmation = await this.alerts.confirm(
      `Deseja remover "${eventGift.gift.name}" deste evento?`,
      false,
      'Remover presente?',
    );

    if (!confirmation.isConfirmed || this.savingEventGiftId()) return;

    this.savingEventGiftId.set(eventGift.id);

    try {
      await this.eventGiftService.remove(eventGift.id);

      this.eventGifts.update((items) =>
        items.filter((item) => item.id !== eventGift.id),
      );

      await this.alerts.success('Presente removido do evento.');
    } catch (error) {
      console.error('Erro ao remover presente do evento:', error);
      await this.alerts.error(
        'Não foi possível remover o presente. Ele pode ter sido escolhido por algum convidado.',
      );
    } finally {
      this.savingEventGiftId.set(null);
    }
  }

  protected async shareInvitation(invitation: EventInvitation, groupName: string): Promise<void> {
    const currentEvent = this.event();

    if (!currentEvent || this.sharingInvitationId()) return;

    const url = new URL(document.baseURI);
    url.hash = this.router.serializeUrl(this.router.createUrlTree(['/convite', invitation.access_token]));
    const shareUrl = url.toString();

    this.sharingInvitationId.set(invitation.id);

    try {
        await navigator.clipboard.writeText(shareUrl);
        await this.alerts.success('Link do convite copiado.');
      } catch (clipboardError) {
        console.error('Erro ao compartilhar convite:', clipboardError);
        await this.alerts.error(
          'Não foi possível compartilhar ou copiar o link do convite.',
        );
      } finally {
      this.sharingInvitationId.set(null);
    }
  }

  protected async resetInvitationResponses(
    invitation: EventInvitation,
    groupName: string,
  ): Promise<void> {
    const confirmation = await this.alerts.confirm(
      `As respostas de todos os convidados de "${groupName}" voltarão para pendente e as escolhas de presentes desse grupo serão removidas.`,
      false,
      'Resetar respostas?',
    );

    if (!confirmation.isConfirmed) return;

    try {
      await this.eventInvitationService.resetResponses(invitation.id);

      this.guestDataLoaded = false;
      this.giftDataLoaded = false;

      await this.loadGuestAssociations();

      if (this.activeTab() === 'gifts') {
        await this.loadEventGifts();
      }

      await this.alerts.success(
        'Respostas e escolhas de presentes resetadas.',
      );
    } catch (error) {
      console.error('Erro ao resetar respostas do grupo:', error);
      await this.alerts.error(
        'Não foi possível resetar as respostas deste grupo.',
      );
    }
  }

  protected openSplitInvitationModal(invitation: EventInvitation): void {
    if (invitation.event_invitation_guests.length < 2) return;

    if (
      invitation.event_invitation_guests.some(
        (guest) => guest.status !== 'pending',
      )
    ) {
      this.alerts.info(
        'Resete as respostas antes de dividir este convite.',
      );
      return;
    }

    this.splitGuestSearch.set('');

    this.splitSourceInvitation.set(invitation);
    this.splitGuestIds.set([]);
    this.splitInvitationLabel.set('');
    this.isSplitInvitationModalOpen.set(true);
  }

  protected closeSplitInvitationModal(): void {
    this.isSplitInvitationModalOpen.set(false);
    this.splitSourceInvitation.set(null);
    this.splitGuestIds.set([]);
    this.splitInvitationLabel.set('');
    this.splitGuestSearch.set('');
  }

  protected guestsInInvitation(invitation: EventInvitation): GroupView['guests'] {
    const group = this.groupForInvitation(invitation);
    const invitedGuestIds = new Set(
      invitation.event_invitation_guests.map((guest) => guest.guest_id),
    );

    return group?.guests.filter((guest) => invitedGuestIds.has(guest.id)) ?? [];
  }

  protected isGuestSelectedForSplit(guestId: string): boolean {
    return this.splitGuestIds().includes(guestId);
  }

  protected toggleGuestForSplit(guestId: string, checked: boolean): void {
    this.splitGuestIds.update((ids) =>
      checked
        ? [...new Set([...ids, guestId])]
        : ids.filter((id) => id !== guestId),
    );
  }

  protected canSplitInvitation(): boolean {
    const source = this.splitSourceInvitation();

    return !!source &&
      this.splitGuestIds().length > 0 &&
      this.splitGuestIds().length < source.event_invitation_guests.length &&
      !this.isSplittingInvitation();
  }

  protected async splitInvitation(): Promise<void> {
    const source = this.splitSourceInvitation();
    const selectedIds = this.splitGuestIds();

    if (!source || !this.canSplitInvitation()) return;

    const group = this.groupForInvitation(source);
    const names = group?.guests
      .filter((guest) => selectedIds.includes(guest.id))
      .map((guest) => guest.name) ?? [];

    const defaultLabel =
      names.length <= 2
        ? names.join(' e ')
        : `${names[0]} e mais ${names.length - 1}`;

    this.isSplittingInvitation.set(true);

    try {
      await this.eventInvitationService.splitInvitation(
        source.id,
        this.splitInvitationLabel().trim() || defaultLabel,
        selectedIds,
      );

      this.closeSplitInvitationModal();
      this.guestDataLoaded = false;
      await this.loadGuestAssociations();
      await this.alerts.success('Novo convite criado.');
    } catch (error) {
      console.error('Erro ao separar convidados:', error);
      await this.alerts.error(
        'Não foi possível separar os convidados. Confira as respostas e tente novamente.',
      );
    } finally {
      this.isSplittingInvitation.set(false);
    }
  }

  protected filteredGuestsInSplitInvitation(
    invitation: EventInvitation,
  ): GroupView['guests'] {
    const term = this.normalizeSearch(this.splitGuestSearch().trim());
    const guests = this.guestsInInvitation(invitation);

    if (!term) return guests;

    return guests.filter((guest) =>
      this.normalizeSearch(guest.name).includes(term),
    );
  }
}
