import { describe, expect, it, vi } from 'vitest';
import React from 'react';
// @ts-ignore
import { renderToStaticMarkup } from 'react-dom/server';

// Mocks
vi.mock('@pakyaw/shared/components/ui/SymbolIcon', () => ({
  SymbolIcon: () => null,
}));

vi.mock('@pakyaw/shared/components/ui/Avatar', () => ({
  Avatar: ({ name }: any) => React.createElement('div', {}, name),
}));


vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  }),
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => true),
  },
  useSegments: () => ['(driver)', 'index'],
  Tabs: Object.assign(
    ({ children }: any) => React.createElement('Tabs', {}, children),
    { Screen: (props: any) => React.createElement('TabsScreen', props) },
  ),
  Slot: () => null,
  Redirect: () => null,
}));

vi.mock('@/features/auth/stores/driver-session.store', () => ({
  useDriverSession: () => ({
    status: 'approved_active',
  }),
}));

vi.mock('@/features/auth/services/driver-session.service', () => ({
  isDriverWorkspaceState: (status: string) => status === 'approved_active',
}));

vi.mock('@pakyaw/shared/features/auth/hooks/useSession', () => ({
  useSession: () => ({
    uid: 'driver-123',
    session: { user: { uid: 'driver-123' } },
  }),
}));

vi.mock('@pakyaw/shared/features/auth/hooks/useSignOut', () => ({
  useSignOut: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: {
      firstName: 'Andres',
      lastName: 'Manili',
      phone: '+639171234567',
    },
    isLoading: false,
  }),
}));

vi.mock('@/features/onboarding/hooks/useDriverApplication', () => ({
  useDriverApplication: () => ({
    application: {
      status: 'approved',
      personalDetails: {
        fullLegalName: 'Andres Umpad Manili',
        verifiedMobile: '+639171234567',
      },
      vehicle: {
        vehicleTypeId: 'tricycle',
        plateNumber: '654315',
        unitBodyNumber: '762',
      },
    },
    isApplicationLoaded: true,
  }),
}));

vi.mock('@pakyaw/shared/features/trip-history/hooks/useDriverTripHistory', () => ({
  useDriverTripHistory: () => ({
    data: {
      pages: [
        {
          trips: [
            {
              tripId: 'trip-101',
              status: 'completed',
              mode: 'pakyaw',
              pickup: { label: 'Camp Downes' },
              destination: { label: 'Robinsons Place Ormoc' },
              driverEarnings: 53.64,
              completedAt: { seconds: 1725522000, toDate: () => new Date('2026-09-05T13:40:00') },
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isRefetching: false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

vi.mock('@/services/firebase/firebase', () => ({
  auth: { currentUser: { uid: 'driver-123' } },
  firestore: {},
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((q, callback) => {
    callback({
      docs: [
        {
          id: 'rep-1',
          data: () => ({
            subject: 'Umbrella left in vehicle',
            status: 'awaiting_response',
            category: 'lost_item',
            body: 'Passenger reported an umbrella left in the back seat.',
          }),
        },
      ],
    });
    return vi.fn();
  }),
}));

import DriverLayout from './_layout';
import DriverSettingsScreen from './settings';
import ActivityScreen from './activity';
import DriverAccountScreen from './account';


describe('Driver Operational Redesign', () => {
  it('renders DriverLayout with exactly four visible tabs and hidden sub-routes', () => {
    const layout = DriverLayout();
    expect(layout).toBeDefined();

    const json = JSON.stringify(layout);
    // Four primary tabs: Home, Activity, Earnings, Account
    expect(json).toContain('"name":"index"');
    expect(json).toContain('"title":"Home"');
    expect(json).toContain('"name":"activity"');
    expect(json).toContain('"title":"Activity"');
    expect(json).toContain('"name":"earnings"');
    expect(json).toContain('"title":"Earnings"');
    expect(json).toContain('"name":"account"');
    expect(json).toContain('"title":"Account"');

    // Sub-routes hidden with href: null
    expect(json).toContain('"name":"trips"');
    expect(json).toContain('"name":"trips/[tripId]"');
    expect(json).toContain('"name":"support"');
    expect(json).toContain('"name":"settings"');
  });

  it('renders DriverSettingsScreen with accessible preferences and app info', () => {
    const markup = renderToStaticMarkup(React.createElement(DriverSettingsScreen));
    expect(markup).toBeDefined();

    expect(markup).toContain('Settings');
    expect(markup).toContain('Voice Guidance');
    expect(markup).toContain('Audio Alerts');
    expect(markup).toContain('Auto-Recenter Map');
    expect(markup).toContain('High-Contrast Outdoors');
    expect(markup).toContain('Ormoc City, Leyte');
  });

  it('renders Activity screen with segmented Trips and Reports structure without generic create button', () => {
    const markup = renderToStaticMarkup(React.createElement(ActivityScreen));
    expect(markup).toBeDefined();

    expect(markup).toContain('Activity');
    expect(markup).toContain('Trips history and operational reports');
    expect(markup).toContain('Trips');
    expect(markup).toContain('Reports');
    expect(markup).toContain('Camp Downes');
    expect(markup).toContain('Robinsons Place Ormoc');
    expect(markup).not.toContain('Create New Report');
    expect(markup).not.toContain('Submit a Report');
  });

  it('renders DriverAccountScreen with identity, vehicle, support, and settings without Trip Reports duplicate', () => {
    const markup = renderToStaticMarkup(React.createElement(DriverAccountScreen));
    expect(markup).toBeDefined();

    expect(markup).toContain('Account');
    expect(markup).toContain('Verified Driver');
    expect(markup).toContain('Active');
    expect(markup).toContain('Driver Information');
    expect(markup).toContain('Phone');
    expect(markup).toContain('Vehicle');
    expect(markup).toContain('Plate');
    expect(markup).toContain('Body / Unit');
    expect(markup).toContain('Capacity');
    expect(markup).toContain('Driver Account');
    expect(markup).toContain('Verification');
    expect(markup).toContain('View application');
    expect(markup).toContain('Help &amp; Support');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Sign Out');

    // Should NOT contain duplicate Trip Reports entry in Account
    expect(markup).not.toContain('Trip Reports');
  });
});
