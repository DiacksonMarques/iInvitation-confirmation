import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { EventInvitation, InvitationDraft  } from './event-management.models';


@Injectable({ providedIn: 'root' })
export class EventInvitationService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findByEvent(eventId: string): Promise<EventInvitation[]> {
    const query = this.supabase.client
      .from('event_invitations')
      .select(`
        id,
        invitation_group_id,
        invitation_label,
        access_token,
        event_invitation_guests (
          guest_id,
          status
        )
      `)
      .eq('event_id', eventId);

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return (data ?? []) as unknown as EventInvitation[];
  }

  async attachGroup(eventId: string, groupId: string): Promise<void> {
    const query = this.supabase.client
      .from('event_invitations')
      .insert({
        event_id: eventId,
        invitation_group_id: groupId,
      });

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async createPartitions(
    eventId: string,
    groupId: string,
    partitions: Array<{ label: string | null; guest_ids: string[] }>,
  ): Promise<void> {
    const query = this.supabase.client.rpc(
      'create_event_invitation_partitions',
      {
        p_event_id: eventId,
        p_invitation_group_id: groupId,
        p_partitions: partitions,
      },
    );

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async syncGuests(eventInvitationId: string, guestIds: string[]): Promise<void> {
    const query = this.supabase.client.rpc(
      'sync_event_invitation_guests',
      {
        p_event_invitation_id: eventInvitationId,
        p_guest_ids: guestIds,
      },
    );

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async removeInvitation(eventInvitationId: string): Promise<void> {
    const query = this.supabase.client.rpc('remove_event_invitation', {
      p_event_invitation_id: eventInvitationId,
    });

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }


  async resetResponses(eventInvitationId: string): Promise<void> {
    const query = this.supabase.client.rpc(
      'reset_event_invitation_responses',
      {
        p_event_invitation_id: eventInvitationId,
      },
    );

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async splitInvitation(
    invitationId: string,
    label: string,
    guestIds: string[],
  ): Promise<void> {
    const query = this.supabase.client.rpc('split_event_invitation', {
      p_event_invitation_id: invitationId,
      p_invitation_label: label,
      p_guest_ids: guestIds,
    });

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }
}
