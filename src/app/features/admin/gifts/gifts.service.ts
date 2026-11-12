import { Injectable, inject } from '@angular/core';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Gift, GiftInput } from './gifts.models';

const GIFT_FIELDS = 'id, name, description';

@Injectable({ providedIn: 'root' })
export class GiftService {
  private readonly supabase = inject(SupabaseService);
  private readonly loading = inject(LoadingService);

  async findAll(): Promise<Gift[]> {
    const query = this.supabase.client
      .from('gifts')
      .select(GIFT_FIELDS)
      .order('name');

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return (data ?? []) as Gift[];
  }

  async create(input: GiftInput): Promise<Gift> {
    const normalized = this.normalize(input);

    const query = this.supabase.client
      .from('gifts')
      .insert(normalized)
      .select(GIFT_FIELDS)
      .single();

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return data as Gift;
  }

  async update(id: string, input: GiftInput): Promise<Gift> {
    const normalized = this.normalize(input);

    const query = this.supabase.client
      .from('gifts')
      .update(normalized)
      .eq('id', id)
      .select(GIFT_FIELDS)
      .single();

    const { data, error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;

    return data as Gift;
  }

  async remove(id: string): Promise<void> {
    const query = this.supabase.client
      .from('gifts')
      .delete()
      .eq('id', id);

    const { error } = await this.loading.track(Promise.resolve(query));

    if (error) throw error;
  }

  private normalize(input: GiftInput): GiftInput {
    const name = input.name.trim();

    if (!name) {
      throw new Error('Informe o nome do presente.');
    }

    return {
      name,
      description: input.description?.trim() || null,
    };
  }
}
