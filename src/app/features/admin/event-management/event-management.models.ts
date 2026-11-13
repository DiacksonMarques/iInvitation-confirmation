export interface InvitationDraft {
  id: number;
  label: string;
  guestIds: string[];
}
export interface EventInvitation {
  id: string;
  invitation_group_id: string;
  invitation_label: string | null;
  access_token: string;
  event_invitation_guests: Array<{
    guest_id: string;
    status: 'pending' | 'confirmed' | 'declined';
  }>;
}
