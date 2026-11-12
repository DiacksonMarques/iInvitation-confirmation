export interface GuestView {
  id: string;
  name: string;
  phone: string;
  email: string;
  is_primary_contact: boolean;
}

export interface GroupView {
  id: string;
  name: string;
  guests: GuestView[];
}

export interface GuestInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  is_primary_contact?: boolean;
}

export interface GroupInput {
  name: string;
}

export interface GroupRow {
  id: string;
  name: string;
  guests: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    is_primary_contact: boolean;
  }> | null;
}
