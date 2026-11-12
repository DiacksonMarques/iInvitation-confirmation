import { Event, EventInput } from './events.models';
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { LoadingService } from '../../../core/services/loading.service';

@Injectable({
  providedIn: 'root',
})
export class EventService {
  private readonly supabase = inject(SupabaseService);
  private readonly loadingService = inject(LoadingService);

  async findAll(): Promise<Event[]> {
    const { data, error } = await this.supabase.client
      .from('events')
      .select(`
        id,
        name,
        description,
        event_date,
        confirmation_deadline,
        location,
        invitation_message,
        status,
        archived_at
      `)
      .order('event_date', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Event[];
  }

  async create(input: EventInput): Promise<Event> {
    const query = this.supabase.client
      .from('events')
      .insert(input)
      .select()
      .single();

    const { data, error } = await this.loadingService.track(Promise.resolve(query));

    if (error) throw error;

    return data as Event;
  }

  async update(id: string, input: EventInput): Promise<Event> {
    const query = this.supabase.client
      .from('events')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    const { data, error } = await this.loadingService.track(Promise.resolve(query));

    if (error) throw error;

    return data as Event;
  }

  async remove(id: string): Promise<'deleted' | 'archived'> {
    const query = this.supabase.client.rpc(
      'delete_or_archive_event',
      {
        p_event_id: id,
      },
    );

    const { data, error } = await this.loadingService.track(Promise.resolve(query));

    if (error) {
      throw error;
    }

    return data as 'deleted' | 'archived';
  }

  async findById(id: string): Promise<Event> {
    const query = this.supabase.client
      .from('events')
      .select(`
        id,
        name,
        description,
        event_date,
        confirmation_deadline,
        location,
        invitation_message,
        status,
        archived_at
      `)
      .eq('id', id)
      .maybeSingle();

    const { data, error } = await this.loadingService.track(Promise.resolve(query));

    if (error) throw error;

    if (!data) {
      throw new Error('Evento não encontrado.');
    }

    return data as Event;
  }
}
