import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';

export type GuestInvitationStatus = 'pending' | 'confirmed' | 'declined';

export interface RecentGuestStatus {
  id: string;
  guest_name: string;
  status: GuestInvitationStatus;
  updated_at: string;
}

export interface EventDashboardSummary {
  total: number;
  confirmed: number;
  pending: number;
  declined: number;
  recent: RecentGuestStatus[];
}

interface RecentGuestRow {
  id: string;
  status: GuestInvitationStatus;
  updated_at: string;
  guest: { name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async getEventSummary(eventId: string): Promise<EventDashboardSummary> {
    const invitationsQuery = this.supabase.client
      .from('event_invitations')
      .select('id')
      .eq('event_id', eventId);

    const { data: invitations, error: invitationsError } =
      await this.loading.track(Promise.resolve(invitationsQuery));

    if (invitationsError) throw invitationsError;

    const invitationIds = (invitations ?? []).map((item) => item.id);

    if (invitationIds.length === 0) {
      return {
        total: 0,
        confirmed: 0,
        pending: 0,
        declined: 0,
        recent: [],
      };
    }

    const [confirmed, pending, declined, recentResult] = await Promise.all([
      this.countByStatus(invitationIds, 'confirmed'),
      this.countByStatus(invitationIds, 'pending'),
      this.countByStatus(invitationIds, 'declined'),
      this.findRecent(invitationIds),
    ]);

    return {
      total: confirmed + pending + declined,
      confirmed,
      pending,
      declined,
      recent: recentResult,
    };
  }

  private async countByStatus(
    invitationIds: string[],
    status: GuestInvitationStatus,
  ): Promise<number> {
    const query = this.supabase.client
      .from('event_invitation_guests')
      .select('id', { count: 'exact', head: true })
      .in('event_invitation_id', invitationIds)
      .eq('status', status);

    const { count, error } = await this.loading.track(
      Promise.resolve(query),
    );

    if (error) throw error;

    return count ?? 0;
  }

  private async findRecent(
    invitationIds: string[],
  ): Promise<RecentGuestStatus[]> {
    const query = this.supabase.client
      .from('event_invitation_guests')
      .select(`
        id,
        status,
        updated_at,
        guest:guests ( name )
      `)
      .in('event_invitation_id', invitationIds)
      .order('updated_at', { ascending: false })
      .limit(5);

    const { data, error } = await this.loading.track(
      Promise.resolve(query),
    );

    if (error) throw error;

    return ((data ?? []) as unknown as RecentGuestRow[]).map((row) => ({
      id: row.id,
      guest_name: row.guest?.name ?? 'Convidado',
      status: row.status,
      updated_at: row.updated_at,
    }));
  }
}
