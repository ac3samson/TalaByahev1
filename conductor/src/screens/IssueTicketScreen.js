import { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors, spacing, fonts } from '../theme';
import { useTrip } from '../context/TripContext';
import { api } from '../api';

const DISCOUNT_PERCENT = 20;
const DISCOUNT_OPTIONS = [
  { id: 'none', label: 'No discount' },
  { id: 'Senior', label: 'Senior' },
  { id: 'PWD', label: 'PWD' },
  { id: 'Student', label: 'Student' },
];

export default function IssueTicketScreen({ navigation }) {
  const { activeTrip, issueTicket } = useTrip();
  const stops = activeTrip?.stops ?? [];
  const [from, setFrom] = useState(stops[0]);
  const [to, setTo] = useState(stops[1]);
  const [discountType, setDiscountType] = useState('none');
  const [baseFare, setBaseFare] = useState(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const discountApplied = discountType !== 'none';

  useEffect(() => {
    setFrom(stops[0]);
    setTo(stops[1]);
  }, [activeTrip?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!activeTrip?.routeId || !from || !to || from === to) {
      setBaseFare(null);
      return undefined;
    }
    setFareLoading(true);
    api.fares
      .lookup(activeTrip.routeId, from, to)
      .then((result) => {
        if (!cancelled) setBaseFare(result.fare);
      })
      .catch(() => {
        if (!cancelled) setBaseFare(null);
      })
      .finally(() => {
        if (!cancelled) setFareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTrip?.routeId, from, to]);

  const finalFare = useMemo(() => {
    if (baseFare == null) return null;
    if (!discountApplied) return baseFare;
    return Math.round(baseFare * (1 - DISCOUNT_PERCENT / 100));
  }, [baseFare, discountApplied]);

  const handleIssue = async () => {
    if (finalFare == null) return;
    setIssuing(true);
    try {
      const ticket = await issueTicket({
        from,
        to,
        fare: finalFare,
        baseFare,
        discountApplied,
        discountType: discountApplied ? discountType : null,
      });
      navigation.replace('Receipt', { ticket });
    } catch (err) {
      Alert.alert('Could not issue ticket', err.message || 'Try again');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Issue Ticket</Text>

      <Text style={styles.label}>Origin</Text>
      {stops.map((stop) => (
        <TouchableOpacity key={`from-${stop}`} style={[styles.chip, from === stop && styles.chipActive]} onPress={() => setFrom(stop)}>
          <Text style={[styles.chipText, from === stop && styles.chipTextActive]}>{stop}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Destination</Text>
      {stops.map((stop) => (
        <TouchableOpacity key={`to-${stop}`} style={[styles.chip, to === stop && styles.chipActive]} onPress={() => setTo(stop)}>
          <Text style={[styles.chipText, to === stop && styles.chipTextActive]}>{stop}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, { marginTop: spacing.lg }]}>Discount</Text>
      <View style={styles.discountGrid}>
        {DISCOUNT_OPTIONS.map((option) => {
          const active = discountType === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.discountChip, active && styles.chipActive]}
              onPress={() => setDiscountType(option.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.fareBox}>
        <Text style={styles.fareLabel}>{discountApplied ? 'Fare after discount' : 'Computed Fare'}</Text>
        {fareLoading ? (
          <ActivityIndicator color={colors.yellow500} style={{ marginTop: 8 }} />
        ) : (
          <Text style={styles.fareValue}>{finalFare != null ? `₱${finalFare}` : '—'}</Text>
        )}
        {discountApplied && baseFare != null && (
          <Text style={styles.baseFare}>Regular fare: ₱{baseFare}</Text>
        )}
        {from === to && <Text style={styles.error}>Origin and destination must differ</Text>}
        {from !== to && !fareLoading && baseFare == null && <Text style={styles.error}>No fare found for this segment</Text>}
      </View>

      <TouchableOpacity
        style={[styles.button, (finalFare == null || issuing) && styles.buttonDisabled]}
        onPress={handleIssue}
        disabled={finalFare == null || issuing}
      >
        {issuing ? (
          <ActivityIndicator color={colors.red900} />
        ) : (
          <Text style={styles.buttonText}>Generate Digital Ticket</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: spacing.lg },
  title: { fontFamily: fonts.header, fontSize: 22, color: colors.red900, marginBottom: spacing.lg },
  label: { fontFamily: fonts.header, color: colors.gray800, marginBottom: spacing.sm },
  discountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  discountChip: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  chipActive: { borderColor: colors.red700, backgroundColor: '#FFF8E1' },
  chipText: { fontFamily: fonts.bodyMedium, color: colors.gray800, textAlign: 'center' },
  chipTextActive: { fontFamily: fonts.bodyBold, color: colors.red900 },
  fareBox: {
    backgroundColor: colors.red900,
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  fareLabel: { fontFamily: fonts.bodySemi, color: colors.yellow500 },
  fareValue: { fontFamily: fonts.header, color: colors.white, fontSize: 40, marginTop: 4 },
  baseFare: {
    fontFamily: fonts.body,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 6,
    textDecorationLine: 'line-through',
  },
  error: { fontFamily: fonts.body, color: '#FFB4A2', fontSize: 13, marginTop: 8 },
  button: {
    backgroundColor: colors.yellow500,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bodyBold, color: colors.red900, fontSize: 16 },
});
