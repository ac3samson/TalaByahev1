import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, fonts } from '../theme';
import PrinterPickerModal from '../components/PrinterPickerModal';
import {
  getSavedPrinter,
  isPrinterBuildAvailable,
  listBondedPrinters,
  printTicket,
  savePrinter,
} from '../printer/bluetoothPrinter';

function friendlyPrintMessage() {
  return 'Please select an appropriate printer and try again.';
}

export default function ReceiptScreen({ route, navigation }) {
  const { ticket } = route.params;
  const [printing, setPrinting] = useState(false);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const allowLeaveRef = useRef(false);
  const canLeave = hasPrinted && !printing;

  useEffect(() => {
    navigation.setOptions({
      headerBackVisible: false,
      gestureEnabled: false,
      headerLeft: () => null,
    });

    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current) return;
      // Block Android back / gesture — only in-app buttons may leave this screen.
      e.preventDefault();
    });

    return unsub;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const backSub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => backSub.remove();
    }, []),
  );

  const leaveToHome = () => {
    if (!canLeave) return;
    allowLeaveRef.current = true;
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const leaveToIssueTicket = () => {
    if (!canLeave) return;
    allowLeaveRef.current = true;
    navigation.replace('IssueTicket');
  };

  const openPrinterPicker = async () => {
    setPickerOpen(true);
    setPickerError('');
    setLoadingPrinters(true);
    try {
      const devices = await listBondedPrinters();
      setPrinters(devices);
      if (!devices.length) {
        setPickerError('No paired printers found. Pair your thermal printer in phone Bluetooth settings, then tap Refresh.');
      }
    } catch {
      setPrinters([]);
      setPickerError('Could not load printers. Turn on Bluetooth, then tap Refresh.');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const closePrinterPicker = () => {
    setPickerOpen(false);
    setLoadingPrinters(false);
    setPickerError('');
  };

  const runPrint = async (printer) => {
    setPrinting(true);
    try {
      await printTicket(ticket, printer);
      await savePrinter(printer);
      setHasPrinted(true);
      Alert.alert('Ticket Sent', 'Receipt successfully printed.');
    } catch {
      Alert.alert('Print Error', friendlyPrintMessage(), [
        { text: 'Select Printer', onPress: () => openPrinterPicker() },
        { text: 'OK', style: 'cancel' },
      ]);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = async () => {
    if (!isPrinterBuildAvailable()) {
      Alert.alert(
        'Custom build required',
        'Bluetooth printing does not work in Expo Go.\n\nBuild and install the development APK, then open that app instead of Expo Go.\n\nRun in conductor/:\neas build -p android --profile development',
      );
      return;
    }

    try {
      const saved = await getSavedPrinter();
      if (saved?.address) {
        Alert.alert('Print ticket', `Use ${saved.name || saved.address}?`, [
          { text: 'Change printer', onPress: () => openPrinterPicker() },
          { text: 'Cancel', style: 'cancel' },
          { text: 'Print', onPress: () => runPrint(saved) },
        ]);
        return;
      }
      await openPrinterPicker();
    } catch {
      Alert.alert('Print Error', 'Please select an appropriate printer and try again.');
    }
  };

  const handleSelectPrinter = async (printer) => {
    setPickerOpen(false);
    await runPrint(printer);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.receipt}>
          <Text style={styles.header}>H.M. TRANSPORT, INC.</Text>
          <Text style={styles.address}>Jam Compound Tubigan 4024</Text>
          <Text style={styles.address}>City of Biñan Laguna Philippines</Text>
          <Text style={styles.tin}>Non-VAT Reg. TIN: 005-748-554-000</Text>
          <Text style={styles.company}>Provincial Bus Ticket Invoice</Text>
          <View style={styles.divider} />
          <Text style={styles.ticketId}>{ticket.id}</Text>
          <Text style={styles.date}>{new Date().toLocaleDateString('en-PH')}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>From</Text>
            <Text style={styles.rowValue}>{ticket.from}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>To</Text>
            <Text style={styles.rowValue}>{ticket.to}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Time</Text>
            <Text style={styles.rowValue}>{ticket.time}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Conductor</Text>
            <Text style={styles.rowValue}>{ticket.conductor}</Text>
          </View>
          {ticket.discountApplied && (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Regular fare</Text>
                <Text style={styles.rowValue}>₱{ticket.baseFare}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Discount</Text>
                <Text style={styles.discountValue}>
                  {ticket.discountPercent}%{ticket.discountType ? ` (${ticket.discountType})` : ''}
                </Text>
              </View>
            </>
          )}
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>TOTAL FARE</Text>
            <Text style={styles.fareValue}>₱{ticket.fare}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.printButton, printing && styles.printButtonDisabled]}
          onPress={handlePrint}
          disabled={printing}
        >
          {printing ? (
            <ActivityIndicator color={colors.red900} />
          ) : (
            <Text style={styles.printButtonText}>Print</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, !canLeave && styles.buttonDisabled]}
          onPress={leaveToHome}
          disabled={!canLeave}
        >
          <Text style={[styles.buttonText, !canLeave && styles.buttonTextDisabled]}>Back to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondary}
          onPress={leaveToIssueTicket}
          disabled={!canLeave}
        >
          <Text style={[styles.secondaryText, !canLeave && styles.secondaryTextDisabled]}>
            Issue Another Ticket
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PrinterPickerModal
        visible={pickerOpen}
        loading={loadingPrinters}
        printers={printers}
        error={pickerError}
        onRefresh={openPrinterPicker}
        onSelect={handleSelectPrinter}
        onClose={closePrinterPicker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  receipt: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.red900,
    borderStyle: 'dashed',
    marginBottom: spacing.lg,
  },
  header: { fontFamily: fonts.headerExtra, textAlign: 'center', letterSpacing: 2, color: colors.red900 },
  address: {
    fontFamily: fonts.body,
    textAlign: 'center',
    alignSelf: 'center',
    width: '100%',
    color: colors.gray800,
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  tin: {
    fontFamily: fonts.bodySemi,
    textAlign: 'center',
    color: colors.gray800,
    marginTop: 4,
    fontSize: 12,
  },
  company: { fontFamily: fonts.body, textAlign: 'center', color: colors.gray600, marginTop: 4, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: spacing.md },
  ticketId: { fontFamily: fonts.header, textAlign: 'center', fontSize: 20, color: colors.red900 },
  date: { fontFamily: fonts.body, textAlign: 'center', color: colors.gray600, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  rowLabel: { fontFamily: fonts.body, color: colors.gray600 },
  rowValue: { fontFamily: fonts.bodySemi, color: colors.gray800 },
  discountValue: { fontFamily: fonts.bodySemi, color: colors.red700, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  fareRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: { fontFamily: fonts.header, color: colors.red900 },
  fareValue: { fontFamily: fonts.headerExtra, fontSize: 28, color: colors.yellow600 },
  printButton: {
    backgroundColor: colors.yellow500,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  printButtonDisabled: { opacity: 0.6 },
  printButtonText: { fontFamily: fonts.bodyBold, color: colors.red900, fontSize: 16 },
  button: {
    backgroundColor: colors.red700,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontFamily: fonts.bodyBold, color: colors.white, fontSize: 16 },
  buttonTextDisabled: { color: 'rgba(255,255,255,0.85)' },
  secondary: { padding: spacing.md, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.bodyBold, color: colors.red700 },
  secondaryTextDisabled: { color: colors.gray600 },
});
