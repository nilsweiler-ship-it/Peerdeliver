import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface GeoAdminResult {
  id: number;
  attrs: {
    label: string;
    lat: number;
    lon: number;
    detail: string;
  };
}

export interface AddressSelection {
  label: string;
  point: { lat: number; lng: number };
}

interface AddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  error?: string;
  onSelect: (address: AddressSelection | null) => void;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function AddressAutocomplete({
  label,
  placeholder,
  error,
  onSelect,
}: AddressAutocompleteProps) {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<GeoAdminResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectedRef = useRef(false);

  const search = useCallback(async (query: string) => {
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        searchText: query,
        type: 'locations',
        limit: '8',
        sr: '4326',
      });
      const res = await fetch(
        `https://api3.geo.admin.ch/rest/services/api/SearchServer?${params}`,
        { signal: controller.signal },
      );
      const data = await res.json();
      const results: GeoAdminResult[] = data.results || [];
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      }
    } catch {
      // Ignore aborted requests
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleChangeText = useCallback(
    (newText: string) => {
      if (selectedRef.current) {
        selectedRef.current = false;
        return;
      }
      setText(newText);
      onSelect(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => search(newText), DEBOUNCE_MS);
    },
    [onSelect, search],
  );

  const handleSelect = useCallback(
    (item: GeoAdminResult) => {
      const lbl = stripHtml(item.attrs.label);
      selectedRef.current = true;
      setShowDropdown(false);
      setSuggestions([]);
      setText(lbl);
      onSelect({
        label: lbl,
        point: { lat: item.attrs.lat, lng: item.attrs.lon },
      });
    },
    [onSelect],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          value={text}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            setTimeout(() => setShowDropdown(false), 250);
          }}
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.spinner}
          />
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {showDropdown && (
        <View style={styles.dropdown}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={`${item.id}-${item.attrs.lat}-${item.attrs.lon}`}
                style={styles.suggestion}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {stripHtml(item.attrs.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  spinner: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -8,
  },
  dropdown: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    maxHeight: 220,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
});
