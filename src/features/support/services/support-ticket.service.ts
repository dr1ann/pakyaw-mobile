import { functions, httpsCallable } from '@/services/firebase/firebase';

export async function createSupportTicket(input: { readonly category: string; readonly subject: string; readonly body: string; readonly relatedTripId?: string | null }): Promise<{ readonly ticketId: string }> {
  const callable = httpsCallable<typeof input, { readonly ticketId: string; readonly status: 'open' }>(functions, 'createSupportTicket');
  return callable(input).then((result) => ({ ticketId: result.data.ticketId }));
}
