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
import { colors, spacing, borderRadius, typography, shadow } from '../../theme';

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
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
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
      // Ignore aborted / failed requests
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const handleChangeText = useCallback(
    (newText: string) => {
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
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setText(lbl);
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
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

  const open = showDropdown && suggestions.length > 0;

  return (
    <View style={[styles.container, (open || focused) && styles.containerActive]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          style={[styles.input, focused && styles.inputFocused, error && styles.inputError]}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          value={text}
          onChangeText={handleChangeText}
          autoCorrect={false}
          autoCapitalize="words"
          onFocus={() => {
            setFocused(true);
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => {
            setFocused(false);
            // Delay so a suggestion tap registers before the dropdown closes.
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
        {loading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {open && (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={`${item.id}-${item.attrs.lat}-${item.attrs.lon}`}
                style={[styles.suggestion, idx === suggestions.length - 1 && styles.suggestionLast]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
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
  // Lift this field (and its overlay dropdown) above sibling fields below it.
  containerActive: {
    zIndex: 50,
  },
  label: {
    ...typography.bodyStrong,
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
  },
  inputFocused: {
    borderColor: colors.primaryLight,
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
  // Absolute overlay so the suggestions float over the form instead of
  // shoving the layout down as you type.
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: 6,
    maxHeight: 240,
    overflow: 'hidden',
    ...shadow.sheet,
    zIndex: 50,
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  suggestionLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text,
  },
});
