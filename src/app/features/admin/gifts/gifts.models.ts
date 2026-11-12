export interface Gift {
  id: string;
  name: string;
  description: string | null;
}

export interface GiftInput {
  name: string;
  description: string | null;
}
