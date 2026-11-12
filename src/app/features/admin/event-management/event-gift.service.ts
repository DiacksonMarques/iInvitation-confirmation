import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { EventGift, EventGiftInput } from '../events/events.models';

@Injectable({ providedIn: 'root' })
export class EventGiftService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findByEvent(eventId: string): Promise<EventGift[]> {
    const query = this.supabase.client
      .from('event_gifts')
      .select(`
        id,
        gift_id,
        total_quantity,
        gift:gifts (
          id,
          name,
          description
        ),
        gift_selections (
          quantity
        )
      `)
      .eq('event_id', eventId)
      .order('created_at');

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    const rows = (data ?? []) as unknown as Array<
      Omit<EventGift, 'selected_quantity'> & {
        gift_selections: Array<{ quantity: number }>;
      }
    >;

    return rows.map(({ gift_selections, ...eventGift }) => ({
      ...eventGift,
      selected_quantity: (gift_selections ?? []).reduce(
        (total, selection) => total + selection.quantity,
        0,
      ),
    }));
  }

  async addMany(eventId: string, items: EventGiftInput[]): Promise<void> {
    if (items.length === 0) return;

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.total_quantity) ||
          item.total_quantity < 1,
      )
    ) {
      throw new Error('A quantidade deve ser um número inteiro maior que zero.');
    }

    const query = this.supabase.client
      .from('event_gifts')
      .insert(
        items.map((item) => ({
          event_id: eventId,
          gift_id: item.gift_id,
          total_quantity: item.total_quantity,
        })),
      );

    const { error } = await this.loading.track(
      Promise.resolve(query),
    );

    if (error) throw error;
  }

  async updateQuantity(id: string, quantity: number): Promise<void> {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('A quantidade deve ser um número inteiro maior que zero.');
    }

    const query = this.supabase.client
      .from('event_gifts')
      .update({ total_quantity: quantity })
      .eq('id', id)
      .select('id')
      .single();

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const query = this.supabase.client
      .from('event_gifts')
      .delete()
      .eq('id', id)
      .select('id')
      .single();

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }
}
