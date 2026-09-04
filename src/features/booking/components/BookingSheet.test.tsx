import { describe, expect, it, vi } from 'vitest';
import { BookingSheet } from './BookingSheet';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

vi.mock('@/features/booking/hooks/useCreateBooking', () => ({
  useCreateBooking: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/features/booking/hooks/useQuote', () => ({
  useQuote: () => ({
    quote: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    canQuote: false,
  }),
}));

describe('BookingSheet component', () => {
  it('instantiates correctly with search handlers', () => {
    const onSearchPickup = vi.fn();
    const onSearchDestination = vi.fn();
    const element = (
      <BookingSheet
        onSearchPickup={onSearchPickup}
        onSearchDestination={onSearchDestination}
        isMinimized={false}
      />
    );

    expect(element).toBeDefined();
    expect(element.props.isMinimized).toBe(false);
    expect(element.props.onSearchPickup).toBe(onSearchPickup);
    expect(element.props.onSearchDestination).toBe(onSearchDestination);
  });

  it('instantiates in minimized state', () => {
    const onToggleMinimize = vi.fn();
    const element = (
      <BookingSheet
        isMinimized={true}
        onToggleMinimize={onToggleMinimize}
      />
    );

    expect(element.props.isMinimized).toBe(true);
  });
});
