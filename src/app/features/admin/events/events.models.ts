import { Gift } from "../gifts/gifts.models";

export interface Event {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  confirmation_deadline: string | null;
  location: string | null;
  invitation_message: string | null;
  status: 'draft' | 'active' | 'closed';
  archived_at: string | null;
}

export type EventInput = Pick<
  Event,
  | 'name'
  | 'description'
  | 'event_date'
  | 'confirmation_deadline'
  | 'location'
  | 'invitation_message'
  | 'status'
>;

export interface EventGiftInput {
  gift_id: string;
  total_quantity: number;
}

export interface EventGift {
  id: string;
  gift_id: string;
  total_quantity: number;
  selected_quantity: number;
  gift: Gift;
}
