import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  BackHandler,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../theme';
import { useTrip } from '../context/TripContext';
import HomeSidebar from '../components/HomeSidebar';
import PrinterPickerModal from '../components/PrinterPickerModal';
import {
  isPrinterBuildAvailable,
  listBondedPrinters,
} from '../printer/bluetoothPrinter';

export default function HomeScreen({ navigation, route }) {
  const { conductor, setConductor, activeTrip, tickets, totalEarnings, logout } = useTrip();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (route.params?.conductor) {
      setConductor(route.params.conductor);
    }
  }, [route.params, setConductor]);

  const handleLogout = useCallback(async () => {
    if (activeTrip) {
      Alert.alert(
        'Cannot Sign Out',
        'You cannot sign out while on an active trip. End the trip first.',
      );
      return;
    }
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      Alert.alert('Cannot Sign Out', err.message || 'End the trip before signing out.');
    }
  }, [activeTrip, logout, navigation]);

  const openPrinterSetup = async () => {
    if (!isPrinterBuildAvailable()) {
      Alert.alert(
        'Custom build required',
        'Bluetooth printing does not work in Expo Go. Use the TalaByahe development APK.',
      );
      return;
    }

    setPickerOpen(true);
    setPickerError('');
    setLoadingPrinters(true);
    try {
      const devices = await listBondedPrinters();
      setPrinters(devices);
      if (!devices.length) {
        setPickerError(
          'No paired printers found. Pair your thermal printer in phone Bluetooth settings, then tap Refresh.',
        );
      }
    } catch {
      setPrinters([]);
      setPickerError('Could not load printers. Turn on Bluetooth, then tap Refresh.');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const closePrinterSetup = () => {
    setPickerOpen(false);
    setLoadingPrinters(false);
    setPickerError('');
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => null,
      headerRightContainerStyle: { paddingRight: 4 },
      headerRight: () => (
        <Pressable
          onPress={() => setSidebarOpen(true)}
          style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
          hitSlop={8}
        >
          <Text style={styles.menuBtnText}>☰</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      // Only while Home is focused — don't block back on Issue Ticket / Report / etc.
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, activeTrip && styles.contentWithFooter]}
      >
        <Text style={styles.greeting}>Hello, {conductor?.name ?? 'Conductor'}!</Text>
        <Text style={styles.sub}>{conductor?.id ?? 'EMP-001'}</Text>

        {activeTrip ? (
          <View style={styles.tripCard}>
            <Text style={styles.tripLabel}>Active Trip</Text>
            <Text style={styles.tripName}>{activeTrip.routeName}</Text>
            <Text style={styles.tripDetail}>Bus {activeTrip.busPlate}</Text>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{tickets.length}</Text>
                <Text style={styles.statLabel}>Passengers</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>₱{totalEarnings}</Text>
                <Text style={styles.statLabel}>Earnings</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active trip</Text>
            <Text style={styles.emptyText}>Start a trip to begin issuing digital tickets</Text>
          </View>
        )}

        {activeTrip && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigation.navigate('PassengerList')}>
              <Text style={styles.secondaryBtnText}>View Passengers ({tickets.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.summaryBtn} onPress={() => navigation.navigate('TripSummary')}>
              <Text style={styles.summaryBtnText}>End Trip</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {activeTrip ? (
        <TouchableOpacity
          style={styles.setupLinkWrap}
          onPress={openPrinterSetup}
          disabled={loadingPrinters}
          hitSlop={8}
        >
          <View style={styles.setupLinkInner}>
            <Text style={styles.setupLink}>PRINTER SETUP</Text>
            <View style={styles.setupLinkLine} />
          </View>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => (activeTrip ? navigation.navigate('IssueTicket') : navigation.navigate('StartTrip'))}
        >
          <Text style={styles.primaryBtnText}>{activeTrip ? 'Issue Ticket' : 'Start Trip'}</Text>
        </TouchableOpacity>
      </View>

      <HomeSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conductor={conductor}
        activeTrip={activeTrip}
        ticketCount={tickets.length}
        navigation={navigation}
        onLogout={handleLogout}
      />

      <PrinterPickerModal
        visible={pickerOpen}
        loading={loadingPrinters}
        printers={printers}
        error={pickerError}
        title="Paired Devices"
        closeLabel="Back"
        selectable={false}
        onRefresh={openPrinterSetup}
        onClose={closePrinterSetup}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    marginRight: 0,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  menuBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  menuBtnText: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
    fontSize: 20,
  },
  screen: { flex: 1, backgroundColor: colors.gray50 },
  container: { flex: 1 },
  content: { padding: spacing.lg, flexGrow: 1 },
  contentWithFooter: { paddingBottom: spacing.sm },
  greeting: { fontFamily: fonts.header, fontSize: 24, color: colors.red900 },
  sub: { fontFamily: fonts.body, color: colors.gray600, marginBottom: spacing.lg },
  tripCard: {
    backgroundColor: colors.red900,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  tripLabel: { fontFamily: fonts.bodySemi, color: colors.yellow500, fontSize: 13 },
  tripName: { fontFamily: fonts.header, color: colors.white, fontSize: 20, marginTop: 4 },
  tripDetail: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.8)', marginTop: 4, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: spacing.md },
  statValue: { fontFamily: fonts.header, color: colors.white, fontSize: 22 },
  statLabel: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyTitle: { fontFamily: fonts.header, fontSize: 18, color: colors.red900 },
  emptyText: { fontFamily: fonts.body, color: colors.gray600, textAlign: 'center', marginTop: 8 },
  setupLinkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.gray50,
  },
  setupLinkInner: {
    alignItems: 'center',
  },
  setupLink: {
    fontFamily: fonts.body,
    color: colors.gray600,
    textAlign: 'center',
  },
  setupLinkLine: {
    marginTop: 0,
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.gray600,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.gray50,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  primaryBtn: {
    backgroundColor: colors.red700,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 16 },
  secondaryBtn: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.red700,
    marginBottom: spacing.sm,
  },
  secondaryBtnText: { fontFamily: fonts.bodyBold, color: colors.red700, fontSize: 16 },
  summaryBtn: {
    backgroundColor: colors.yellow500,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryBtnText: { fontFamily: fonts.bodyBold, color: colors.red900, fontSize: 16 },
});
