export type PublicGuestStatus = 'pending' | 'confirmed' | 'declined';

export interface PublicInvitationGuest {
  invitation_guest_id: string;
  name: string;
  status: PublicGuestStatus;
}

export interface PublicInvitation {
  event: {
    name: string;
    description: string | null;
    event_date: string;
    confirmation_deadline: string | null;
    location: string | null;
    invitation_message: string | null;
    status: 'active' | 'closed';
    can_confirm: boolean;
    can_select_gifts: boolean;
  };
  guests: PublicInvitationGuest[];
  gifts: PublicInvitationGift[];
}

export interface PublicInvitationGift {
  event_gift_id: string;
  name: string;
  description: string | null;
  total_quantity: number;
  selected_quantity: number;
  available_quantity: number;
}

export interface PublicGiftSelectionInput {
  event_gift_id: string;
  quantity: number;
}
