import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { Place } from '@/features/booking/types';
import { useOrmocPlacesAutocomplete } from '@/features/maps/hooks/useOrmocPlacesAutocomplete';
import { getPlaceDetails, reverseGeocode } from '@/features/maps/services/placesService';
import { isInServiceArea } from '@/lib/serviceArea';
import { logger } from '@/lib/logger';

type StaticPlace = {
  readonly label: string;
  readonly address: string;
  readonly coords: { readonly lat: number; readonly lng: number };
};

type SavedPlace = StaticPlace & {
  readonly id: string;
  readonly icon: string;
};

const SUGGESTED_PLACES: readonly StaticPlace[] = [
  {
    label: 'Robinsons Place Ormoc',
    address: 'Brgy. Cogon, Ormoc City, Leyte',
    coords: { lat: 11.0051, lng: 124.6218 },
  },
  {
    label: 'Ormoc Superdome',
    address: 'Larrazabal Blvd, Ormoc City, Leyte',
    coords: { lat: 11.0076, lng: 124.6042 },
  },
  {
    label: 'SM Center Ormoc',
    address: 'Real St, Brgy. District 14, Ormoc City, Leyte',
    coords: { lat: 11.0028, lng: 124.6083 },
  },
  {
    label: 'Ormoc City Hall',
    address: 'Avelino St, Ormoc City, Leyte',
    coords: { lat: 11.0044, lng: 124.6074 },
  },
];

const SAVED_PLACES: readonly SavedPlace[] = [
  {
    id: 'home',
    icon: 'house.fill',
    label: 'Home',
    address: 'Brgy. Linao, Ormoc City',
    coords: { lat: 11.0250, lng: 124.6010 },
  },
  {
    id: 'work',
    icon: 'briefcase.fill',
    label: 'Work',
    address: 'Ormoc Doctors Hospital, Ormoc City',
    coords: { lat: 11.0120, lng: 124.6095 },
  },
];

type SetDestinationSheetProps = {
  readonly onClose: () => void;
  readonly onSelect: (place: Place) => void;
  readonly mode?: 'pickup' | 'destination';
};

export function SetDestinationSheet({ onClose, onSelect, mode = 'destination' }: SetDestinationSheetProps) {
  const [query, setQuery] = useState('');
  
  const { data: predictions = [], isLoading } = useOrmocPlacesAutocomplete(query);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  async function handleUseCurrentLocation() {
    setDetectingLocation(true);
    try {
      logger.info('[SetDestinationSheet] Checking location permission status...');
      const currentPerm = await Location.getForegroundPermissionsAsync();
      
      const canPrompt = currentPerm.status === 'undetermined' || currentPerm.canAskAgain;

      if (canPrompt) {
        logger.info('[SetDestinationSheet] Requesting location permission...');
        const requestPerm = await Location.requestForegroundPermissionsAsync();
        if (requestPerm.status !== 'granted') {
          logger.warn('[SetDestinationSheet] Location permission denied by user prompt');
          return;
        }
      } else {
        logger.warn('[SetDestinationSheet] Location permission permanently denied, showing settings alert');
        Alert.alert(
          'Location Permission',
          'Location permission is required to use your current location. Please enable it in your device settings.'
        );
        return;
      }

      logger.info('[SetDestinationSheet] Getting current position...');
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      logger.info('[SetDestinationSheet] Reverse-geocoding current position...', loc.coords);
      const place = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      
      if (place && place.coords && isInServiceArea(place.coords)) {
        logger.info('[SetDestinationSheet] Selected current location:', place);
        onSelect(place);
      } else {
        logger.warn('[SetDestinationSheet] Current location outside service area', place);
        Alert.alert(
          'Service Area',
          'Service is currently available only within Ormoc City.'
        );
      }
    } catch (err) {
      logger.error('[SetDestinationSheet] Failed to resolve current location', err);
      Alert.alert(
        'Location Error',
        'Could not resolve your current location. Please try again or search for a location.'
      );
    } finally {
      setDetectingLocation(false);
    }
  }

  async function handleSelectPrediction(placeId: string, label: string) {
    setResolvingPlace(true);
    try {
      logger.info('[SetDestinationSheet] Resolving place ID', { placeId, label });
      const details = await getPlaceDetails(placeId);
      if (details && details.coords && isInServiceArea(details.coords)) {
        onSelect(details);
      } else {
        logger.warn('[SetDestinationSheet] Resolved place outside service area or details missing', { details });
        Alert.alert(
          'Service Area',
          'Service is currently available only within Ormoc City.'
        );
      }
    } catch (err) {
      logger.error('[SetDestinationSheet] Failed to resolve place details', { err });
    } finally {
      setResolvingPlace(false);
    }
  }

  function handleSelectStatic(place: StaticPlace) {
    logger.info('[SetDestinationSheet] Selected static place', { label: place.label });
    if (place.coords && isInServiceArea(place.coords)) {
      onSelect({
        label: place.label,
        address: place.address,
        coords: place.coords,
      });
    } else {
      logger.warn('[SetDestinationSheet] Static place outside service area', place);
      Alert.alert(
        'Service Area',
        'Service is currently available only within Ormoc City.'
      );
    }
  }

  const validSavedPlaces = SAVED_PLACES.filter((p) => isInServiceArea(p.coords));
  const validSuggestedPlaces = SUGGESTED_PLACES.filter((p) => isInServiceArea(p.coords));

  const showSearchResults = query.trim().length >= 3;

  return (
    <View style={styles.container} testID="set-destination-sheet">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{mode === 'pickup' ? 'Where from?' : 'Where to?'}</Text>
        <Pressable onPress={onClose} style={styles.closeButton} accessibilityLabel="Close search">
          <SymbolIcon name="xmark" size={20} tintColor={colors.ink[500]} />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <SymbolIcon name="magnifyingglass" size={20} tintColor={colors.blue.primary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'pickup' ? 'Search pickup...' : 'Search destination...'}
          placeholderTextColor={colors.ink[400]}
          style={styles.input}
          autoFocus
          clearButtonMode="while-editing"
          accessibilityLabel={mode === 'pickup' ? 'Search pickup input' : 'Search destination input'}
        />
        {(isLoading || resolvingPlace) && (
          <ActivityIndicator color={colors.blue.primary} style={styles.loader} />
        )}
      </View>

      {/* Search Results / Lists */}
      {showSearchResults ? (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.placeId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectPrediction(item.placeId, item.mainText)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.iconContainer}>
                <SymbolIcon name="mappin.circle.fill" size={22} tintColor={colors.ink[500]} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {item.mainText}
                </Text>
                {item.secondaryText ? (
                  <Text style={styles.rowSublabel} numberOfLines={1}>
                    {item.secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.emptyText}>No locations found in Ormoc City.</Text>
            ) : null
          }
        />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        >
          {mode === 'pickup' && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Current Location</Text>
              <Pressable
                onPress={handleUseCurrentLocation}
                disabled={detectingLocation}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.iconContainer}>
                  <SymbolIcon name="location.fill" size={20} tintColor={colors.blue.primary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.rowLabel}>Use Current Location</Text>
                  <Text style={styles.rowSublabel}>Detect via GPS</Text>
                </View>
                {detectingLocation && (
                  <ActivityIndicator size="small" color={colors.blue.primary} style={styles.loader} />
                )}
              </Pressable>
            </View>
          )}

          {validSavedPlaces.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Saved Places</Text>
              {validSavedPlaces.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => handleSelectStatic(place)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.iconContainer}>
                    <SymbolIcon name={place.icon} size={20} tintColor={colors.blue.primary} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.rowLabel}>{place.label}</Text>
                    <Text style={styles.rowSublabel}>{place.address}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {validSuggestedPlaces.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Suggested Places</Text>
              {validSuggestedPlaces.map((place) => (
                <Pressable
                  key={place.label}
                  onPress={() => handleSelectStatic(place)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <View style={styles.iconContainer}>
                    <SymbolIcon name="star.fill" size={20} tintColor={colors.amber.primary} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.rowLabel}>{place.label}</Text>
                    <Text style={styles.rowSublabel}>{place.address}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.card,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  closeButton: {
    padding: spacing[1],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    height: 52,
    marginBottom: spacing[4],
  },
  searchIcon: {
    marginRight: spacing[2],
  },
  input: {
    flex: 1,
    fontSize: typography.size.body,
    fontWeight: typography.weight.medium,
    color: colors.ink[900],
    height: '100%',
  },
  loader: {
    marginLeft: spacing[2],
  },
  listContent: {
    paddingBottom: spacing[6],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: colors.ink[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowPressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 36,
    alignItems: 'flex-start',
  },
  textContainer: {
    flex: 1,
  },
  rowLabel: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
    color: colors.ink[900],
  },
  rowSublabel: {
    fontSize: typography.size.bodySmall,
    color: colors.ink[500],
    marginTop: 2,
  },
  emptyText: {
    fontSize: typography.size.body,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: spacing[6],
  },
});
