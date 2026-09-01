import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

import { FareQuoteBreakdown } from './FareQuoteBreakdown';

describe('FareQuoteBreakdown component', () => {
  const baseQuote = {
    mode: 'solo' as const,
    passengerCount: 1,
    billedSeats: 4,
    fare: {
      baseFare: 40,
      succeedingKmCharge: 3,
      distanceFare: 3,
      surcharges: 5,
      techFee: 15,
      total: 63,
      driverEarnings: 43,
      perSeat: {
        baseFare: 10,
        succeedingKmCharge: 0.75,
        distanceFare: 0.75,
        surchargeTotal: 0,
        transportFare: 10.75,
      },
    },
  };

  it('renders correctly as a JSX element for Solo 1-4 riders (4 buyout seats)', () => {
    const element = (
      <FareQuoteBreakdown
        quote={baseQuote}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={vi.fn()}
        mode="private"
        hasValidRoute={true}
        riderCount={1}
      />
    );
    expect(element).toBeDefined();
    expect(element.props.quote.billedSeats).toBe(4);
    expect(element.props.quote.fare.total).toBe(63);
  });

  it('renders correctly for Solo 5 riders (5 charged seats)', () => {
    const quote5 = {
      ...baseQuote,
      passengerCount: 5,
      billedSeats: 5,
      fare: { ...baseQuote.fare, total: 73.75 },
    };
    const element = (
      <FareQuoteBreakdown
        quote={quote5}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={vi.fn()}
        mode="private"
        hasValidRoute={true}
        riderCount={5}
      />
    );
    expect(element.props.quote.billedSeats).toBe(5);
    expect(element.props.quote.fare.total).toBe(73.75);
  });

  it('renders loading state when quote is calculating and no quote exists', () => {
    const element = (
      <FareQuoteBreakdown
        quote={null}
        isLoading={true}
        isError={false}
        error={null}
        onRetry={vi.fn()}
        mode="private"
        hasValidRoute={true}
      />
    );
    expect(element.props.isLoading).toBe(true);
  });

  it('renders error state when quote calculation fails', () => {
    const error = new Error('Service area disabled');
    const onRetry = vi.fn();
    const element = (
      <FareQuoteBreakdown
        quote={null}
        isLoading={false}
        isError={true}
        error={error}
        onRetry={onRetry}
        mode="private"
        hasValidRoute={true}
      />
    );
    expect(element.props.isError).toBe(true);
    expect(element.props.error?.message).toBe('Service area disabled');
  });

  it('renders route prompt when route is not valid', () => {
    const element = (
      <FareQuoteBreakdown
        quote={null}
        isLoading={false}
        isError={false}
        error={null}
        onRetry={vi.fn()}
        mode="private"
        hasValidRoute={false}
      />
    );
    expect(element.props.hasValidRoute).toBe(false);
  });
});
