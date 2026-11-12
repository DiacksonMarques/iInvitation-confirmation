import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { GroupRow, GroupView } from './guests.models';

@Injectable({ providedIn: 'root' })
export class InvitationGroupService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findAll(): Promise<GroupView[]> {
    const query = this.supabase.client
      .from('invitation_groups')
      .select(`
        id,
        name,
        guests (
          id,
          name,
          phone,
          email,
          is_primary_contact
        )
      `)
      .order('name');

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return ((data ?? []) as unknown as GroupRow[]).map((group) => ({
      id: group.id,
      name: group.name,
      guests: (group.guests ?? []).map((guest) => ({
        ...guest,
        phone: guest.phone ?? '',
        email: guest.email ?? '',
      })),
    }));
  }

  async create(name: string): Promise<GroupView> {
    const query = this.supabase.client
      .from('invitation_groups')
      .insert({ name })
      .select('id, name')
      .single();

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return {
      ...(data as { id: string; name: string }),
      guests: [],
    };
  }

  async update(id: string, name: string): Promise<void> {
    const query = this.supabase.client
      .from('invitation_groups')
      .update({ name })
      .eq('id', id);

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const query = this.supabase.client
      .from('invitation_groups')
      .delete()
      .eq('id', id);

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }
}
