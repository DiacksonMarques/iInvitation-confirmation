import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { GuestInput, GuestView } from './guests.models';

const GUEST_FIELDS = `
  id,
  name,
  phone,
  email,
  is_primary_contact
`;

@Injectable({ providedIn: 'root' })
export class GuestService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findByGroup(groupId: string): Promise<GuestView[]> {
    const query = this.supabase.client
      .from('guests')
      .select(GUEST_FIELDS)
      .eq('invitation_group_id', groupId)
      .order('name');

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return (data ?? []).map((guest) => ({
      ...guest,
      phone: guest.phone ?? '',
      email: guest.email ?? '',
    })) as GuestView[];
  }

  async create(groupId: string, input: GuestInput): Promise<GuestView> {
    const query = this.supabase.client
      .from('guests')
      .insert({
        invitation_group_id: groupId,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        is_primary_contact: input.is_primary_contact ?? false,
      })
      .select(GUEST_FIELDS)
      .single();

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return {
      ...data,
      phone: data.phone ?? '',
      email: data.email ?? '',
    } as GuestView;
  }

  async update(groupId: string, guestId: string, input: GuestInput): Promise<void> {
    const query = this.supabase.client.rpc('update_group_guest', {
      p_group_id: groupId,
      p_guest_id: guestId,
      p_name: input.name,
      p_phone: input.phone ?? null,
      p_email: input.email ?? null,
      p_is_primary_contact: input.is_primary_contact ?? false,
    });

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const query = this.supabase.client
      .from('guests')
      .delete()
      .eq('id', id);

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }
}
