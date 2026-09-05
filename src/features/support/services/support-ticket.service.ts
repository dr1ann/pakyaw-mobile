import { functions, httpsCallable } from '@/services/firebase/firebase';

export type PassengerCaseType =
  | 'lost_item'
  | 'ride_concern'
  | 'fare_concern'
  | 'safety_concern'
  | 'other';

export interface CreatePassengerTicketInput {
  readonly category: string;
  readonly subject: string;
  readonly body: string;
  readonly relatedTripId?: string | null;
  readonly caseType?: PassengerCaseType;
  readonly priority?: 'normal' | 'high';
  readonly lostItemDetails?: {
    readonly itemName: string;
    readonly description: string;
    readonly rememberedLocation: string;
  };
}

export async function createSupportTicket(
  input: CreatePassengerTicketInput
): Promise<{ readonly ticketId: string; readonly status?: string }> {
  const callable = httpsCallable<
    CreatePassengerTicketInput,
    { readonly ticketId: string; readonly status: string }
  >(functions, 'createSupportTicket');
  return callable(input).then((result) => ({
    ticketId: result.data.ticketId,
    status: result.data.status,
  }));
}
