import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ModalComponent } from '../../../shared/ui/modal.component/modal.component';
import { FormsModule } from '@angular/forms';
import { GroupView, GuestInput, GuestView } from './guests.models';
import { AlertService } from '../../../core/services/alert.service';
import { InvitationGroupService } from './invitation-group.service';
import { GuestService } from './guests.service';

@Component({
  imports: [FormsModule, ModalComponent],
  selector: 'app-guests',
  styleUrl: './guests.component.scss',
  templateUrl: './guests.component.html',
})
export class GuestsComponent implements OnInit{
  private readonly alerts = inject(AlertService);
  private readonly groupService = inject(InvitationGroupService);
  private readonly guestService = inject(GuestService);

  protected readonly groups = signal<GroupView[]>([]);
  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly selectedGroup = computed(() => {
    const id = this.selectedGroupId();
    return this.groups().find((group) => group.id === id) ?? null;
  });

  protected readonly isGroupModalOpen = signal(false);
  protected readonly isGroupCreated = signal(false);
  protected readonly deletingGuestId = signal<string | null>(null);
  protected readonly expandedGuestId = signal<string | null>(null);
  protected readonly guestDraft = signal<GuestView | null>(null);
  protected readonly isLoadingGroups = signal(true);
  protected readonly groupsLoadError = signal(false);

  protected groupName = '';
  protected newGuestName = '';

  private editingGroupId: string | null = null;

  ngOnInit(): void {
    void this.loadGroups();
  }

  protected async loadGroups(): Promise<void> {
    this.isLoadingGroups.set(true);
    this.groupsLoadError.set(false);

    try {
      this.groups.set(await this.groupService.findAll());
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
      this.groupsLoadError.set(true);
    } finally {
      this.isLoadingGroups.set(false);
    }
  }

  protected openCreateGroup(): void {
    this.editingGroupId = null;
    this.groupName = '';
    this.newGuestName = '';
    this.isGroupCreated.set(false);
    this.isGroupModalOpen.set(true);
  }

  protected openManageGroup(group: GroupView): void {
    this.editingGroupId = group.id;
    this.selectedGroupId.set(group.id);
    this.groupName = group.name;
    this.newGuestName = '';
    this.isGroupCreated.set(true);
    this.expandedGuestId.set(null);
    this.deletingGuestId.set(null);
    this.isGroupModalOpen.set(true);
  }

  protected async saveGroup(): Promise<void> {
    const name = this.groupName.trim();

    if (!name) return;

    try {
      if (this.editingGroupId) {
        await this.groupService.update(this.editingGroupId, name);

        this.groups.update((groups) =>
          groups.map((group) =>
            group.id === this.editingGroupId ? { ...group, name } : group,
          ),
        );
      } else {
        const group = await this.groupService.create(name);

        this.groups.update((groups) => [...groups, group]);
        this.editingGroupId = group.id;
        this.selectedGroupId.set(group.id);
        this.isGroupCreated.set(true);
      }
    } catch (error) {
      console.error('Erro ao salvar grupo:', error);
      await this.alerts.error('Não foi possível salvar o grupo.');
    }
  }

  protected async addGuest(): Promise<void> {
    const name = this.newGuestName.trim();
    const groupId = this.selectedGroupId();

    if (!name || !groupId) return;

    try {
      const guest = await this.guestService.create(groupId, { name });

      this.groups.update((groups) =>
        groups.map((group) =>
          group.id === groupId
            ? { ...group, guests: [...group.guests, guest] }
            : group,
        ),
      );

      this.newGuestName = '';
    } catch (error) {
      console.error('Erro ao adicionar convidado:', error);
      await this.alerts.error('Não foi possível adicionar o convidado.');
    }
  }

  protected toggleGuestDetails(guest: GuestView): void {
    if (this.expandedGuestId() === guest.id) {
      this.expandedGuestId.set(null);
      this.guestDraft.set(null);
      return;
    }

    this.expandedGuestId.set(guest.id);
    this.guestDraft.set({ ...guest });
    this.deletingGuestId.set(null);
  }

  protected confirmDeleteGuest(guestId: string): void {
    this.deletingGuestId.set(guestId);
    this.expandedGuestId.set(null);
    this.guestDraft.set(null);
  }
  protected cancelDeleteGuest(): void {
    this.deletingGuestId.set(null);
  }

  protected async deleteGuest(guestId: string): Promise<void> {
    const groupId = this.selectedGroupId();

    if (!groupId) return;

    try {
      await this.guestService.remove(guestId);

      this.groups.update((groups) =>
        groups.map((group) =>
          group.id === groupId
            ? {
                ...group,
                guests: group.guests.filter((guest) => guest.id !== guestId),
              }
            : group,
        ),
      );

      this.deletingGuestId.set(null);
      this.expandedGuestId.set(null);
    } catch (error) {
      console.error('Erro ao excluir convidado:', error);
      await this.alerts.error('Não foi possível excluir o convidado.');
    }
  }

  protected closeGroupModal(): void {
    this.isGroupModalOpen.set(false);
    this.isGroupCreated.set(false);
    this.editingGroupId = null;
    this.groupName = '';
    this.newGuestName = '';
    this.deletingGuestId.set(null);
    this.expandedGuestId.set(null);
    this.guestDraft.set(null);
  }

  protected async saveGuest(guestId: string): Promise<void> {
    const groupId = this.selectedGroupId();
    const draft = this.guestDraft();

    if (!groupId || !draft) return;

    const input: GuestInput = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      is_primary_contact: draft.is_primary_contact,
    };

    if (!input.name) {
      await this.alerts.error('Informe o nome do convidado.', true);
      return;
    }

    try {
      await this.guestService.update(groupId, guestId, input);

      const updatedGuest: GuestView = {
        id: guestId,
        name: input.name,
        phone: input.phone ?? '',
        email: input.email ?? '',
        is_primary_contact: input.is_primary_contact ?? false,
      };

      this.groups.update((groups) =>
        groups.map((group) => ({
          ...group,
          guests: group.guests.map((guest) => {
            if (guest.id === guestId) return updatedGuest;

            // Reflete na tela que o contato anterior foi desmarcado.
            if (
              updatedGuest.is_primary_contact &&
              group.id === groupId &&
              guest.is_primary_contact
            ) {
              return { ...guest, is_primary_contact: false };
            }

            return guest;
          }),
        })),
      );

      this.expandedGuestId.set(null);
      this.guestDraft.set(null);
      await this.alerts.success('Convidado atualizado.', true);
    } catch (error) {
      console.error('Erro ao atualizar convidado:', error);
      await this.alerts.error(
        'Não foi possível atualizar o convidado. As alterações não foram aplicadas.',
        true,
      );
    }
  }

  protected async confirmDeleteGroup(id: string): Promise<void> {
    const group = this.groups().find((item) => item.id === id);

    if (!group) return;

    if (group.guests.length > 0) {
      await this.alerts.error(
        'Remova os convidados deste grupo antes de excluí-lo.',
      );
      return;
    }

    const confirmation = await this.alerts.confirm(
      `Tem certeza que deseja excluir o grupo "${group.name}"?`,
      false,
      'Excluir grupo?',
    );

    if (!confirmation.isConfirmed) return;

    try {
      await this.groupService.remove(group.id);

      this.groups.update((groups) =>
        groups.filter((item) => item.id !== group.id),
      );

      if (this.selectedGroupId() === group.id) {
        this.selectedGroupId.set(null);
      }

      await this.alerts.success('Grupo excluído com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir grupo:', error);
      await this.alerts.error(
        'Não foi possível excluir o grupo. Ele pode estar vinculado a um evento.',
      );
    }
  }
}
