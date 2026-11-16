import { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../theme';
import { useTrip } from '../context/TripContext';
import { api } from '../api';

export default function StartTripScreen({ navigation }) {
  const { startTrip } = useTrip();
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [pendingTripId, setPendingTripId] = useState('');
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.routes.list(), api.buses.list()])
      .then(([routeRows, busRows]) => {
        if (cancelled) return;
        const activeRoutes = routeRows.filter((r) => r.status === 'Active');
        const availableBuses = busRows.filter((b) => b.status === 'Available');
        setRoutes(activeRoutes);
        setBuses(availableBuses);
        setSelectedRoute(activeRoutes[0]?.id ?? null);
        setSelectedBus(availableBuses[0]?.id ?? null);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load routes and buses');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = async () => {
    if (!selectedRoute || !selectedBus) {
      Alert.alert('Missing selection', 'Select a route and an available bus.');
      return;
    }
    setStarting(true);
    setWaitingApproval(false);
    setPendingTripId('');
    try {
      await startTrip({
        routeId: selectedRoute,
        busId: selectedBus,
        onPending: (trip) => {
          setWaitingApproval(true);
          setPendingTripId(trip.id);
        },
      });
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      Alert.alert('Could not start trip', err.message || 'Try again');
    } finally {
      setStarting(false);
      setWaitingApproval(false);
      setPendingTripId('');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.red700} />
        <Text style={styles.loadingText}>Loading routes…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Start New Trip</Text>
        <Text style={styles.subtitle}>Select route and bus assignment</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Route</Text>
        {routes.length === 0 && <Text style={styles.empty}>No active routes available.</Text>}
        {routes.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.option, selectedRoute === r.id && styles.optionSelected]}
            onPress={() => setSelectedRoute(r.id)}
          >
            <Text style={[styles.optionTitle, selectedRoute === r.id && styles.optionTitleSelected]}>{r.name}</Text>
            <Text style={styles.optionSub}>{r.stops.join(' → ')}</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Bus</Text>
        {buses.length === 0 && <Text style={styles.empty}>No available buses right now.</Text>}
        {buses.map((b) => (
          <TouchableOpacity
            key={b.id}
            style={[styles.option, selectedBus === b.id && styles.optionSelected]}
            onPress={() => setSelectedBus(b.id)}
          >
            <Text style={[styles.optionTitle, selectedBus === b.id && styles.optionTitleSelected]}>
              {b.id} — {b.plate}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {waitingApproval ? (
          <View style={styles.waitingBox}>
            <ActivityIndicator color={colors.red700} />
            <Text style={styles.waitingTitle}>Waiting for admin approval</Text>
            <Text style={styles.waitingSub}>
              {pendingTripId ? `Request ${pendingTripId}` : 'Your start request was sent to dispatch.'}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.button, (starting || !selectedRoute || !selectedBus) && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={starting || !selectedRoute || !selectedBus}
        >
          {starting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Start</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.gray50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray50 },
  loadingText: { marginTop: spacing.md, fontFamily: fonts.body, color: colors.gray600 },
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontFamily: fonts.header, fontSize: 22, color: colors.red900 },
  subtitle: { fontFamily: fonts.body, color: colors.gray600, marginBottom: spacing.lg },
  label: { fontFamily: fonts.header, color: colors.gray800, marginBottom: spacing.sm },
  empty: { fontFamily: fonts.body, color: colors.gray600, marginBottom: spacing.sm },
  error: { fontFamily: fonts.bodySemi, color: colors.red700, marginBottom: spacing.md },
  option: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  optionSelected: { borderColor: colors.red700, backgroundColor: '#FFF8E1' },
  optionTitle: { fontFamily: fonts.header, color: colors.gray800 },
  optionTitleSelected: { color: colors.red900 },
  optionSub: { fontFamily: fonts.body, fontSize: 12, color: colors.gray600, marginTop: 4 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.gray50,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  button: {
    backgroundColor: colors.red700,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 16 },
  waitingBox: {
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 6,
  },
  waitingTitle: { fontFamily: fonts.bodyBold, color: colors.red900, marginTop: 4 },
  waitingSub: { fontFamily: fonts.body, color: colors.gray600, fontSize: 13, textAlign: 'center' },
});
