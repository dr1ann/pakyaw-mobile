import { SymbolIcon } from '@pakyaw/shared/components/ui/SymbolIcon';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { Place } from '@pakyaw/shared/types/place';
import { useOrmocPlacesAutocomplete } from '@/features/maps/hooks/useOrmocPlacesAutocomplete';
import { getPlaceDetails, reverseGeocode } from '@pakyaw/shared/features/maps/services/placesService';
import { logger } from '@pakyaw/shared/lib/logger';
import { isInServiceArea } from '@/lib/serviceArea';
import { useLocationStore } from '@/stores/locationStore';
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

type StaticPlace = {
  readonly label: string;
  readonly address: string;
  readonly coords: { readonly lat: number; readonly lng: number };
};

const ORMOC_LANDMARKS: readonly StaticPlace[] = [
  {
    label: 'Robinsons Place Ormoc',
    address: 'Brgy. Cogon, Ormoc City, Leyte',
    coords: { lat: 11.025467127451368, lng: 124.60509243084043 },
  },
  {
    label: 'Ormoc Superdome',
    address: 'Larrazabal Blvd, Ormoc City, Leyte',
    coords: { lat: 11.004196339986503, lng: 124.60958545198201 },
  },
  {
    label: 'SM Center Ormoc',
    address: 'Real St, Brgy. District 14, Ormoc City, Leyte',
    coords: { lat: 11.010894765109262, lng: 124.60771518229937 },
  },
  {
    label: 'Ormoc City Hall',
    address: 'Avelino St, Ormoc City, Leyte',
    coords: { lat: 11.01338557648569, lng: 124.60477265161069 },
  },
];

type SetDestinationSheetProps = {
  readonly mode: 'pickup' | 'destination';
  readonly onClose: () => void;
  readonly onSelect: (place: Place) => void;
  readonly onChooseOnMap: (coords: { lat: number; lng: number }) => void;
};

export function SetDestinationSheet({
  onClose,
  onSelect,
  onChooseOnMap,
  mode = 'destination',
}: SetDestinationSheetProps) {
  const [query, setQuery] = useState('');

  const { data: predictions = [], isLoading } = useOrmocPlacesAutocomplete(query);
  const [resolvingPlace, setResolvingPlace] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

  async function handleUseCurrentLocation() {
    setDetectingLocation(true);
    try {
      const state = useLocationStore.getState();
      if (state.permissionStatus !== 'granted') {
        logger.warn('[SetDestinationSheet] Location permission not granted');
        Alert.alert(
          'Location Permission',
          'Location permission is required to use your current location. Please enable it in device settings or choose a point on the map.'
        );
        return;
      }

      const loc = state.location;
      if (!loc) {
        logger.warn('[SetDestinationSheet] Current location not available yet');
        Alert.alert(
          'Location Unavailable',
          'Could not determine your current location yet. Please try again or choose a point on the map.'
        );
        return;
      }

      logger.info('[SetDestinationSheet] Reverse-geocoding current position...', loc);
      const place = await reverseGeocode(loc.latitude, loc.longitude);

      if (place && place.coords && isInServiceArea(place.coords)) {
        logger.info('[SetDestinationSheet] Selected current location:', place);
        onSelect(place);
      } else {
        logger.warn('[SetDestinationSheet] Current location outside service area', place);
        Alert.alert(
          'Service Area',
          'Pakyaw currently serves locations within Ormoc City.'
        );
      }
    } catch (err) {
      logger.error('[SetDestinationSheet] Failed to resolve current location', err);
      Alert.alert(
        'Location Error',
        'Could not resolve your current location. Please choose a point on the map or search for a place.'
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
          'Pakyaw currently serves locations within Ormoc City.'
        );
      }
    } catch (err) {
      logger.error('[SetDestinationSheet] Failed to resolve place details', { err });
      Alert.alert(
        'Search Error',
        'Unable to load details for this place. Please try another search or choose on the map.'
      );
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
        'Pakyaw currently serves locations within Ormoc City.'
      );
    }
  }

  function handleChooseOnMap() {
    logger.info('[SetDestinationSheet] Choose on Map selected');
    const state = useLocationStore.getState();
    const loc = state.location;
    const coords = loc
      ? { lat: loc.latitude, lng: loc.longitude }
      : { lat: 11.005074, lng: 124.61175 };
    onChooseOnMap(coords);
  }

  const validLandmarks = ORMOC_LANDMARKS.filter((p) => isInServiceArea(p.coords));
  const showSearchResults = query.trim().length >= 3;

  return (
    <View style={styles.container} testID="set-destination-sheet">
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{mode === 'pickup' ? 'Where from?' : 'Where to?'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'pickup' ? 'Set your pickup point' : 'Choose your destination in Ormoc'}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.rowPressed]}
          accessibilityLabel="Close search"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <SymbolIcon name="xmark" size={20} tintColor={colors.ink[500]} />
        </Pressable>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <SymbolIcon name="magnifyingglass" size={20} tintColor={colors.blue.primary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'pickup' ? 'Search pickup location…' : 'Search destination in Ormoc…'}
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
              accessibilityRole="button"
              accessibilityLabel={`${item.mainText}, ${item.secondaryText || ''}`}
            >
              <View style={styles.iconContainer}>
                <SymbolIcon name="mappin.circle.fill" size={22} tintColor={colors.blue.primary} />
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
              <View style={styles.emptyContainer}>
                <SymbolIcon name="magnifyingglass" size={28} tintColor={colors.ink[400]} />
                <Text style={styles.emptyTitle}>No locations found</Text>
                <Text style={styles.emptySubtitle}>
                  We could not find matches in Ormoc City. Try searching with a barangay name or choose on the map.
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Map Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Map Options</Text>

            <Pressable
              onPress={handleChooseOnMap}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel="Choose on map"
            >
              <View style={styles.iconContainer}>
                <SymbolIcon name="map.fill" size={20} tintColor={colors.blue.primary} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.rowLabel}>Choose on Map</Text>
                <Text style={styles.rowSublabel}>Drag pin to exact location</Text>
              </View>
            </Pressable>

            {mode === 'pickup' && (
              <Pressable
                onPress={handleUseCurrentLocation}
                disabled={detectingLocation}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Use current location"
              >
                <View style={styles.iconContainer}>
                  <SymbolIcon name="location.fill" size={20} tintColor={colors.green.primary} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.rowLabel}>Use Current Location</Text>
                  <Text style={styles.rowSublabel}>Detect via GPS</Text>
                </View>
                {detectingLocation && (
                  <ActivityIndicator size="small" color={colors.blue.primary} style={styles.loader} />
                )}
              </Pressable>
            )}
          </View>

          {/* Static Ormoc Landmarks */}
          {validLandmarks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>Popular destinations in Ormoc</Text>
              {validLandmarks.map((place) => (
                <Pressable
                  key={place.label}
                  onPress={() => handleSelectStatic(place)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${place.label}, ${place.address}`}
                >
                  <View style={styles.iconContainer}>
                    <SymbolIcon name="building.2.fill" size={20} tintColor={colors.ink[500]} />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.rowLabel}>{place.label}</Text>
                    <Text style={styles.rowSublabel} numberOfLines={1}>
                      {place.address}
                    </Text>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.size.h3,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
  },
  subtitle: {
    fontSize: typography.size.caption,
    color: colors.ink[500],
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
    height: 52,
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
    fontSize: typography.size.caption,
    fontWeight: typography.weight.bold,
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
    minHeight: 52,
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
    fontSize: typography.size.caption,
    color: colors.ink[500],
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  emptyTitle: {
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    color: colors.ink[900],
    marginTop: spacing[2],
  },
  emptySubtitle: {
    fontSize: typography.size.caption,
    color: colors.ink[500],
    textAlign: 'center',
    lineHeight: 18,
  },
});
