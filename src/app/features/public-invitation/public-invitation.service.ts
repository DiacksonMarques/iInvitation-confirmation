import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../core/services/loading.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PublicGiftSelectionInput, PublicInvitation } from './public-invitation.models';

@Injectable({ providedIn: 'root' })
export class PublicInvitationService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findByToken(token: string): Promise<PublicInvitation | null> {
    const query = this.supabase.client.rpc('get_public_invitation', {
      p_access_token: token,
    });

    const { data, error } = await this.loading.track(
      Promise.resolve(query),
    );

    if (error) throw error;

    return data as PublicInvitation | null;
  }

  async respond(
    token: string,
    invitationGuestId: string,
    status: 'confirmed' | 'declined',
  ): Promise<void> {
    const query = this.supabase.client.rpc(
      'respond_to_public_invitation',
      {
        p_access_token: token,
        p_invitation_guest_id: invitationGuestId,
        p_status: status,
      },
    );

    const { error } = await this.loading.track(
      Promise.resolve(query),
    );

    if (error) throw error;
  }

  async saveGiftSelections(
    token: string,
    selections: PublicGiftSelectionInput[],
  ): Promise<void> {
    const query = this.supabase.client.rpc(
      'save_public_gift_selections',
      {
        p_access_token: token,
        p_selections: selections,
      },
    );

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }
}
