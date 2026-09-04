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

export interface GoogleAddressComponent {
  readonly long_name: string;
  readonly short_name: string;
  readonly types: readonly string[];
}

export interface GoogleGeocodingResult {
  readonly formatted_address: string;
  readonly address_components: readonly GoogleAddressComponent[];
  readonly types: readonly string[];
  readonly geometry?: {
    readonly location?: {
      readonly lat: number;
      readonly lng: number;
    };
  };
}

export interface ResolvedPickupDisplayLabel {
  readonly primary: string;
  readonly secondary?: string;
  readonly fullAddress: string;
}

export interface NearbyLandmarkResult {
  readonly name: string;
  readonly vicinity?: string;
}

interface Coordinate {
  readonly lat: number;
  readonly lng: number;
}

const NEARBY_LANDMARK_RADIUS_METERS = 150;
const POLITICAL_RESULT_MAX_DISTANCE_METERS = 1_000;

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lng - a.lng);
  const latitudeA = toRadians(a.lat);
  const latitudeB = toRadians(b.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

const FORBIDDEN_PRIMARY_EXACT = new Set([
  'eastern visayas',
  'region viii',
  'region 8',
  'leyte',
  'southern leyte',
  'philippines',
  'ph',
  'ormoc city',
  'ormoc',
  'unnamed road',
]);

/**
 * Checks if a string candidate is valid as a primary pickup label.
 * Primary labels must represent a specific usable place, never a broad region, province, country, or plus code.
 */
export function isValidPrimaryPickupLabel(text: string | undefined | null): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Plus codes
  if (trimmed.match(/^[A-Z0-9]{4,}\+[A-Z0-9]+/i)) return false;
  // Postal codes / numbers only
  if (trimmed.match(/^\d{4,5}$/)) return false;
  // Forbidden broad entities
  if (FORBIDDEN_PRIMARY_EXACT.has(trimmed.toLowerCase())) return false;
  return true;
}

/**
 * Supplementary Nearby Places lookup to find recognizable landmarks within 150m of the selected coordinate.
 * Note: Supplementary only. This must NEVER move or overwrite the authoritative pickup coordinates.
 */
export async function getNearbyLandmark(lat: number, lng: number): Promise<NearbyLandmarkResult | null> {
  // Distance ranking matches the nearby labels visible on Google Maps more closely
  // than the default prominence ranking. The local distance filter below still
  // enforces our strict maximum so a recognizable but far-away POI cannot win.
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&rankby=distance&type=point_of_interest&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[placesService] Fetching nearby landmarks', { lat, lng });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      logger.warn('[placesService] Nearby Places API error', { status: data.status });
      return null;
    }

    const results = (data.results || []) as readonly {
      readonly name?: string;
      readonly vicinity?: string;
      readonly types?: readonly string[];
      readonly geometry?: { readonly location?: Coordinate };
    }[];

    const pin = { lat, lng };
    const validLandmark = results
      .filter((r) => {
        if (!r.name || !isValidPrimaryPickupLabel(r.name)) return false;
        const types = r.types || [];
        // Avoid broad political / locality entities returned in nearby search.
        if (
          types.includes('locality') ||
          types.includes('administrative_area_level_1') ||
          types.includes('administrative_area_level_2') ||
          types.includes('country') ||
          types.includes('political')
        ) {
          return false;
        }
        const location = r.geometry?.location;
        return !location || distanceMeters(pin, location) <= NEARBY_LANDMARK_RADIUS_METERS;
      })
      .sort((a, b) => {
        const distanceA = a.geometry?.location ? distanceMeters(pin, a.geometry.location) : Number.POSITIVE_INFINITY;
        const distanceB = b.geometry?.location ? distanceMeters(pin, b.geometry.location) : Number.POSITIVE_INFINITY;
        return distanceA - distanceB;
      })[0];

    if (validLandmark?.name) {
      return {
        name: validLandmark.name,
        vicinity: validLandmark.vicinity,
      };
    }

    return null;
  } catch (err) {
    logger.warn('[placesService] getNearbyLandmark request failed', { err });
    return null;
  }
}

/**
 * Centralized resolver for reverse-geocoding results into a clean primary and secondary pickup label.
 * Preferred specificity:
 * 1. establishment / point_of_interest / premise
 * 2. route + sublocality / barangay
 * 3. street_address
 * 4. sublocality / barangay (explicitly returned by Google)
 * 5. route
 * 6. Safe fallback ("Pinned location")
 */
export function resolvePickupDisplayLabel(
  results: readonly GoogleGeocodingResult[],
  pin?: Coordinate
): ResolvedPickupDisplayLabel {
  if (!results || results.length === 0) {
    return {
      primary: 'Pinned location',
      secondary: 'Ormoc City, Leyte',
      fullAddress: 'Ormoc City, Leyte, Philippines',
    };
  }

  // Preprocess results to remove plus codes from formatted_address and address_components
  const cleanedResults: readonly GoogleGeocodingResult[] = results.map((r) => {
    let formattedAddress = r.formatted_address || '';
    let addressComponents = r.address_components || [];

    addressComponents = addressComponents.filter((c) => {
      const types = c.types || [];
      return (
        !types.includes('plus_code') &&
        !c.long_name.includes('+') &&
        !c.short_name.includes('+')
      );
    });

    formattedAddress = formattedAddress
      .replace(/^[A-Z0-9]{4,}\+[A-Z0-9]+(,\s*|\s+)?/i, '')
      .trim();

    return {
      ...r,
      formatted_address: formattedAddress,
      address_components: addressComponents,
    };
  });

  // Extract locality & province for secondary context
  let localityName = '';
  let provinceName = '';

  for (const r of cleanedResults) {
    for (const c of r.address_components || []) {
      const types = c.types || [];
      if (!localityName && types.includes('locality')) {
        localityName = c.long_name;
      }
      if (
        !provinceName &&
        (types.includes('administrative_area_level_2') ||
          types.includes('administrative_area_level_1'))
      ) {
        if (
          c.long_name !== 'Philippines' &&
          !c.long_name.startsWith('Region') &&
          c.long_name !== 'Eastern Visayas'
        ) {
          provinceName = c.long_name;
        }
      }
    }
  }

  const defaultSecondary = localityName
    ? provinceName && provinceName !== localityName
      ? `${localityName}, ${provinceName}`
      : `${localityName}, Leyte`
    : 'Ormoc City, Leyte';

  let primary: string | null = null;
  let secondary: string | undefined = undefined;

  const isResultNearPin = (result: GoogleGeocodingResult): boolean => {
    if (!pin || !result.geometry?.location) return true;
    return distanceMeters(pin, result.geometry.location) <= POLITICAL_RESULT_MAX_DISTANCE_METERS;
  };

  // 1. POI / Establishment / Premise
  const poiResult = cleanedResults.find((r) => {
    const types = r.types || [];
    return (
      types.some((t) => ['point_of_interest', 'establishment', 'premise'].includes(t)) &&
      !types.includes('plus_code') &&
      Boolean(r.formatted_address)
    );
  });

  if (poiResult) {
    const firstSegment = poiResult.formatted_address.split(',')[0]?.trim();
    if (isValidPrimaryPickupLabel(firstSegment)) {
      primary = firstSegment;
      const remaining = poiResult.formatted_address
        .substring(firstSegment.length)
        .replace(/^,\s*/, '')
        .trim();
      secondary = remaining || defaultSecondary;
    } else {
      const poiComp = poiResult.address_components?.find((c) =>
        c.types.some((t) => ['point_of_interest', 'establishment', 'premise'].includes(t))
      );
      if (poiComp && isValidPrimaryPickupLabel(poiComp.long_name)) {
        primary = poiComp.long_name;
        secondary = poiResult.formatted_address || defaultSecondary;
      }
    }
  }

  // 2. Route + Sublocality / Barangay (e.g. "Real St, Linao")
  if (!primary) {
    let foundRoute: GoogleAddressComponent | undefined;
    let foundSublocality: GoogleAddressComponent | undefined;

    for (const r of cleanedResults) {
      for (const c of r.address_components || []) {
        const types = c.types || [];
        if (!foundRoute && types.includes('route') && isValidPrimaryPickupLabel(c.long_name)) {
          foundRoute = c;
        }
        if (
          !foundSublocality &&
          (types.includes('sublocality') ||
            types.includes('sublocality_level_1') ||
            types.includes('sublocality_level_2') ||
            types.includes('neighborhood') ||
            types.includes('administrative_area_level_5')) &&
          isValidPrimaryPickupLabel(c.long_name)
        ) {
          foundSublocality = c;
        }
      }
    }

    if (foundRoute && foundSublocality) {
      primary = `${foundRoute.short_name || foundRoute.long_name}, ${
        foundSublocality.short_name || foundSublocality.long_name
      }`;
      secondary = defaultSecondary;
    }
  }

  // 3. Street Address (e.g. "123 Real St")
  if (!primary) {
    const streetAddressResult = cleanedResults.find((r) =>
      (r.types || []).includes('street_address') && Boolean(r.formatted_address)
    );
    if (streetAddressResult) {
      const firstSegment = streetAddressResult.formatted_address.split(',')[0]?.trim();
      if (isValidPrimaryPickupLabel(firstSegment)) {
        primary = firstSegment;
        const remaining = streetAddressResult.formatted_address
          .substring(firstSegment.length)
          .replace(/^,\s*/, '')
          .trim();
        secondary = remaining || defaultSecondary;
      }
    }
  }

  // 4. Sublocality / Barangay only (e.g. "Camp Downes"). Political results often
  // use the area's centroid, so reject a label whose geometry is far from the pin.
  if (!primary) {
    let foundSublocality: GoogleAddressComponent | undefined;
    for (const r of cleanedResults) {
      if (!isResultNearPin(r)) continue;
      for (const c of r.address_components || []) {
        const types = c.types || [];
        if (
          !foundSublocality &&
          (types.includes('sublocality') ||
            types.includes('sublocality_level_1') ||
            types.includes('sublocality_level_2') ||
            types.includes('neighborhood') ||
            types.includes('administrative_area_level_5')) &&
          isValidPrimaryPickupLabel(c.long_name)
        ) {
          foundSublocality = c;
        }
      }
    }
    if (foundSublocality) {
      primary = foundSublocality.long_name;
      secondary = defaultSecondary;
    }
  }

  // 5. Route only (e.g. "Camp Downes Road")
  if (!primary) {
    let foundRoute: GoogleAddressComponent | undefined;
    for (const r of cleanedResults) {
      for (const c of r.address_components || []) {
        const types = c.types || [];
        if (!foundRoute && types.includes('route') && isValidPrimaryPickupLabel(c.long_name)) {
          foundRoute = c;
        }
      }
    }
    if (foundRoute) {
      primary = foundRoute.long_name;
      secondary = defaultSecondary;
    }
  }

  // 6. Safe fallback: Pinned location
  if (!primary) {
    primary = 'Pinned location';
    secondary = defaultSecondary;
  }

  const firstCleanedAddress = cleanedResults.find((r) => Boolean(r.formatted_address))?.formatted_address;
  const fullAddress = firstCleanedAddress || (secondary ? `${primary}, ${secondary}` : primary);

  return {
    primary,
    secondary,
    fullAddress,
  };
}

/**
 * Reverse geocode a latitude/longitude pair into a Place description (Phase 12).
 * Strictly retains the exact { lat, lng } as authoritative coordinates.
 * Supplementary Nearby Places enrichment is used only for recognizable landmark labeling.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    logger.info('[placesService] Reverse geocoding', { lat, lng });

    // Concurrently fetch geocoding and supplementary nearby landmarks
    const [geocodeRes, nearbyLandmark] = await Promise.all([
      fetch(geocodeUrl),
      getNearbyLandmark(lat, lng).catch(() => null),
    ]);

    if (!geocodeRes.ok) {
      throw new Error(`HTTP error: ${geocodeRes.status}`);
    }

    const data = await geocodeRes.json();
    if (data.status && data.status !== 'OK') {
      logger.error('[placesService] Geocoding API error', { status: data.status });
      return {
        label: nearbyLandmark?.name || 'Pinned location',
        address: nearbyLandmark?.vicinity || 'Ormoc City, Leyte',
        coords: { lat, lng },
      };
    }

    const results = (data.results || []) as readonly GoogleGeocodingResult[];
    if (results.length === 0) {
      return {
        label: nearbyLandmark?.name || 'Pinned location',
        address: nearbyLandmark?.vicinity || 'Ormoc City, Leyte',
        coords: { lat, lng },
      };
    }

    const resolved = resolvePickupDisplayLabel(results, { lat, lng });
    let finalLabel = resolved.primary;
    let finalAddress = resolved.secondary || resolved.fullAddress;

    // If reverse-geocoding did not resolve a specific POI directly on the point, but a nearby landmark is found within 150m:
    // Present as "Near <Landmark>" while strictly keeping exact pin coordinates
    if (
      nearbyLandmark?.name &&
      (finalLabel === 'Pinned location' ||
        !results.some((r) =>
          (r.types || []).some((t) => ['point_of_interest', 'establishment', 'premise'].includes(t))
        ))
    ) {
      finalLabel = `Near ${nearbyLandmark.name}`;
      if (resolved.primary !== 'Pinned location') {
        finalAddress = `${resolved.primary}, Ormoc City`;
      } else if (nearbyLandmark.vicinity) {
        finalAddress = nearbyLandmark.vicinity;
      }
    }

    return {
      label: finalLabel,
      address: finalAddress,
      coords: { lat, lng },
    };
  } catch (err) {
    logger.error('[placesService] reverseGeocode failed', { err });
    return {
      label: 'Pinned location',
      address: 'Ormoc City, Leyte',
      coords: { lat, lng },
    };
  }
}
