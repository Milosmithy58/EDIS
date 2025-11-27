import { useEffect, RefObject } from 'react';
import { GoogleMapsNamespace } from './useGoogleMapsApi';

export type ParsedPlaceResult = {
  description: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
};

type AutocompleteHandler = (place: ParsedPlaceResult) => void;

type AutocompleteOptions = {
  googleMaps: GoogleMapsNamespace | null;
  inputRef: RefObject<HTMLInputElement>;
  onPlaceSelect?: AutocompleteHandler;
  options?: google.maps.places.AutocompleteOptions;
};

function getComponent(components: google.maps.GeocoderAddressComponent[], type: string) {
  return components.find((component) => component.types.includes(type));
}

export function parsePlaceResult(place: google.maps.places.PlaceResult): ParsedPlaceResult | null {
  const description = place.formatted_address || place.name;
  if (!description) {
    return null;
  }

  const components = place.address_components ?? [];
  const city =
    getComponent(components, 'locality')?.long_name ||
    getComponent(components, 'postal_town')?.long_name ||
    getComponent(components, 'administrative_area_level_2')?.long_name;
  const region =
    getComponent(components, 'administrative_area_level_1')?.long_name ||
    getComponent(components, 'administrative_area_level_3')?.long_name;
  const countryComponent = getComponent(components, 'country');
  const postalCode = getComponent(components, 'postal_code')?.long_name;

  const location = place.geometry?.location;
  const lat = location?.lat();
  const lng = location?.lng();

  return {
    description,
    city: city || undefined,
    region: region || undefined,
    country: countryComponent?.long_name,
    countryCode: countryComponent?.short_name,
    postalCode: postalCode || undefined,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
  };
}

export function usePlacesAutocomplete({ googleMaps, inputRef, onPlaceSelect, options }: AutocompleteOptions) {
  useEffect(() => {
    if (!googleMaps || !inputRef.current) {
      return;
    }

    const autocomplete = new googleMaps.maps.places.Autocomplete(inputRef.current, {
      fields: ['address_components', 'geometry', 'formatted_address', 'name'],
      types: ['geocode'],
      ...options,
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const parsed = parsePlaceResult(place);
      if (parsed) {
        onPlaceSelect?.(parsed);
      }
    });

    return () => listener.remove();
  }, [googleMaps, inputRef, onPlaceSelect, options]);
}
