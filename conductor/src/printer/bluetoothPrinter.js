import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Buffer } from 'buffer';
import { buildTicketReceipt } from './receiptLayout';

const SAVED_PRINTER_KEY = 'talabyahe.preferredPrinter';

function getBluetooth() {
  try {
    // Native module — only available in a custom / EAS build (not Expo Go).
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    return require('react-native-bluetooth-classic').default;
  } catch {
    return null;
  }
}

export function isPrinterBuildAvailable() {
  if (Constants.appOwnership === 'expo') return false;
  return Boolean(getBluetooth());
}

export async function ensureBluetoothReady() {
  const BT = getBluetooth();
  if (!BT) {
    throw new Error(
      'Printer needs a custom app build. Install the TalaByahe APK (EAS development build), not Expo Go.',
    );
  }

  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ]);
      const denied = Object.values(result).some(
        (status) => status !== PermissionsAndroid.RESULTS.GRANTED,
      );
      if (denied) {
        throw new Error('Bluetooth permission is required to print.');
      }
    } else {
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Location permission is required for Bluetooth on this Android version.');
      }
    }
  }

  const enabled = await BT.isBluetoothEnabled();
  if (!enabled) {
    await BT.requestBluetoothEnabled();
  }

  return BT;
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

export async function listBondedPrinters() {
  const BT = await withTimeout(
    ensureBluetoothReady(),
    15000,
    'Bluetooth took too long to respond. Check that Bluetooth is on, then try Refresh.',
  );
  const devices = await withTimeout(
    BT.getBondedDevices(),
    10000,
    'Could not list paired printers in time. Pair the PT-210 in phone Bluetooth settings, then Refresh.',
  );
  return (devices || []).map((device) => ({
    id: device.address || device.id,
    name: device.name || device.address || 'Unknown printer',
    address: device.address,
  }));
}

export async function getSavedPrinter() {
  try {
    const raw = await AsyncStorage.getItem(SAVED_PRINTER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePrinter(printer) {
  await AsyncStorage.setItem(SAVED_PRINTER_KEY, JSON.stringify(printer));
}

export async function clearSavedPrinter() {
  await AsyncStorage.removeItem(SAVED_PRINTER_KEY);
}

export async function connectAndSavePrinter(printer) {
  const BT = await ensureBluetoothReady();
  const address = printer?.address;
  if (!address) {
    throw new Error('No printer selected.');
  }

  const connected = await BT.isDeviceConnected(address).catch(() => false);
  if (!connected) {
    await withTimeout(
      BT.connectToDevice(address),
      15000,
      'Could not connect to that device. Please select an appropriate printer.',
    );
  }

  await savePrinter({
    id: printer.id || address,
    name: printer.name || address,
    address,
  });
  return true;
}

export async function printTicket(ticket, printer) {
  const BT = await ensureBluetoothReady();
  const address = printer?.address;
  if (!address) {
    throw new Error('No printer selected.');
  }

  const payload = buildTicketReceipt(ticket);
  const connected = await BT.isDeviceConnected(address).catch(() => false);
  if (!connected) {
    await BT.connectToDevice(address);
  }

  await BT.writeToDevice(address, Buffer.from(payload), 'base64');
  return true;
}
