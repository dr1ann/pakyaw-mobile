import Constants from 'expo-constants';
import { env } from '@/services/env';
import { ORMOC_SERVICE_AREA } from '@pakyaw/shared/constants/serviceArea';
import { logger } from '@pakyaw/shared/lib/logger';
import type { Place } from '@pakyaw/shared/types/place';

const GOOGLE_MAPS_API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export type AutocompletePrediction = {
  readonly placeId: string;
  readonly description: string;
  readonly mainText: string;
  readonly secondaryText: string;
};

interface GoogleAutocompletePrediction {
  readonly place_id: string;
  readonly description: string;
  readonly structured_formatting?: {
    readonly main_text?: string;
    readonly secondary_text?: string;
  };
}

/**
 * Fetch autocomplete predictions for a query, biased and restricted to Ormoc City (Phase 12).
 */
export async function getPredictions(query: string): Promise<readonly AutocompletePrediction[]> {
  if (query.trim().length < 3) return [];

  const { center, searchBiasRadiusMeters } = ORMOC_SERVICE_AREA;
  
  // Strict country PH + location bias to Ormoc center with strictbounds=true
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
    query
  )}&location=${center.latitude},${center.longitude}&radius=${searchBiasRadiusMeters}&strictbounds=true&components=country:ph&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[placesService] Fetching predictions', { query });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.error('[placesService] Autocomplete API error', { status: data.status });
      return [];
    }

    const predictions = (data.predictions || []) as readonly GoogleAutocompletePrediction[];
    return predictions.map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));
  } catch (err) {
    logger.error('[placesService] getPredictions failed', { err });
    return [];
  }
}

/**
 * Resolve a Place ID into coordinates and address details (Phase 12).
 */
export async function getPlaceDetails(placeId: string): Promise<Place | null> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[placesService] Fetching place details', { placeId });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.status && data.status !== 'OK') {
      logger.error('[placesService] Place Details API error', { status: data.status });
      return null;
    }

    const result = data.result;
    if (!result || !result.geometry?.location) {
      return null;
    }

    return {
      label: result.name || 'Selected Location',
      address: result.formatted_address || '',
      coords: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
    };
  } catch (err) {
    logger.error('[placesService] getPlaceDetails failed', { err });
    return null;
  }
}

interface GoogleAddressComponent {
  readonly long_name: string;
  readonly short_name: string;
  readonly types: readonly string[];
}

interface GoogleGeocodingResult {
  readonly formatted_address: string;
  readonly address_components: readonly GoogleAddressComponent[];
  readonly types: readonly string[];
}

/**
 * Reverse geocode a latitude/longitude pair into a Place description (Phase 12).
 */
export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[placesService] Reverse geocoding', { lat, lng });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.status && data.status !== 'OK') {
      logger.error('[placesService] Geocoding API error', { status: data.status });
      return null;
    }

    const results = (data.results || []) as readonly GoogleGeocodingResult[];
    if (results.length === 0) {
      return null;
    }

    // Preprocess results to remove plus codes from the start of formatted_address and remove plus_code components
    const cleanedResults: readonly GoogleGeocodingResult[] = results.map((r) => {
      let formattedAddress = r.formatted_address || '';
      let addressComponents = r.address_components || [];

      // 1. Remove plus_code from address_components
      addressComponents = addressComponents.filter((c) => {
        const types = c.types || [];
        return !types.includes('plus_code') && !c.long_name.includes('+') && !c.short_name.includes('+');
      });

      // 2. Remove leading plus code plus any optional trailing comma/space
      formattedAddress = formattedAddress.replace(/^[A-Z0-9]{4,}\+[A-Z0-9]+(,\s*|\s+)?/i, '').trim();

      return {
        ...r,
        formatted_address: formattedAddress,
        address_components: addressComponents,
      };
    });

    // Find the first result that is not a plus code and has a valid formatted address
    const topResult = cleanedResults.find((r) => {
      const types = r.types || [];
      if (types.includes('plus_code')) return false;
      if (!r.formatted_address) return false;
      return true;
    }) || cleanedResults[0];
    
    // Find the most specific named feature or street number/name
    const poiResult = cleanedResults.find((r) => {
      const types = r.types || [];
      return (
        (types.includes('point_of_interest') ||
          types.includes('establishment') ||
          types.includes('premise')) &&
        !types.includes('plus_code') &&
        !!r.formatted_address
      );
    });

    const targetResult = poiResult || topResult;
    const addressComponents = (targetResult.address_components || []) as readonly GoogleAddressComponent[];
    let label = 'Pinned location';

    const routeComponent = addressComponents.find((c) => c.types.includes('route'));
    const sublocalityComponent = addressComponents.find((c) =>
      c.types.includes('sublocality') ||
      c.types.includes('sublocality_level_1') ||
      c.types.includes('neighborhood') ||
      c.types.includes('administrative_area_level_5') // Usually Barangay in PH
    );

    if (routeComponent && sublocalityComponent) {
      label = `${routeComponent.short_name}, ${sublocalityComponent.short_name}`;
    } else if (sublocalityComponent) {
      label = sublocalityComponent.long_name;
    } else if (routeComponent) {
      label = routeComponent.long_name;
    } else {
      const nonPlusCode = addressComponents.find(
        (c) =>
          !c.types.includes('plus_code') &&
          !c.long_name.includes('+') &&
          c.long_name !== 'Ormoc City' &&
          c.long_name !== 'Ormoc' &&
          c.long_name !== 'Leyte' &&
          c.long_name !== 'Philippines'
      );
      if (nonPlusCode) {
        label = nonPlusCode.long_name;
      } else if (targetResult.formatted_address) {
        const firstSegment = targetResult.formatted_address.split(',')[0]?.trim();
        if (
          firstSegment &&
          !firstSegment.match(/^[A-Z0-9]{4,}\+[A-Z0-9]+/i) &&
          firstSegment !== 'Ormoc City' &&
          firstSegment !== 'Ormoc'
        ) {
          label = firstSegment;
        } else {
          label = 'Pinned location, Ormoc City';
        }
      } else {
        label = 'Pinned location, Ormoc City';
      }
    }

    // Fallback if we accidentally grabbed a Plus Code
    if (label.match(/^[A-Z0-9]{4,}\+[A-Z0-9]+/i)) {
      const fallbackComponent = addressComponents.find((c) =>
        c.types.includes('administrative_area_level_5') ||
        c.types.includes('sublocality') ||
        c.types.includes('neighborhood') ||
        c.types.includes('locality')
      );
      label = fallbackComponent ? fallbackComponent.long_name : 'Pinned location, Ormoc City';
    }

    return {
      label,
      address: targetResult.formatted_address || '',
      coords: { lat, lng },
    };
  } catch (err) {
    logger.error('[placesService] reverseGeocode failed', { err });
    return null;
  }
}
