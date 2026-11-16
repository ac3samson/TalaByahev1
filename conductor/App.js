import { useEffect, useState } from 'react';
import { useFonts, Barlow_600SemiBold, Barlow_700Bold, Barlow_800ExtraBold } from '@expo-google-fonts/barlow';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { TripProvider, useTrip } from './src/context/TripContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import StartTripScreen from './src/screens/StartTripScreen';
import IssueTicketScreen from './src/screens/IssueTicketScreen';
import ReceiptScreen from './src/screens/ReceiptScreen';
import PassengerListScreen from './src/screens/PassengerListScreen';
import TripSummaryScreen from './src/screens/TripSummaryScreen';
import ReportScreen from './src/screens/ReportScreen';
import { colors, fonts } from './src/theme';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { sessionReady, conductor } = useTrip();

  if (!sessionReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red900 }}>
        <ActivityIndicator size="large" color={colors.yellow500} />
        <Text style={{ color: colors.white, marginTop: 16 }}>Loading TalaByahe…</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={conductor ? 'Home' : 'Login'}
      screenOptions={{
        headerStyle: { backgroundColor: colors.red900 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: fonts.header },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'TalaByahe',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="StartTrip"
        component={StartTripScreen}
        options={{ title: 'Start Trip', gestureEnabled: true }}
      />
      <Stack.Screen
        name="IssueTicket"
        component={IssueTicketScreen}
        options={{ title: 'Issue Ticket', gestureEnabled: true }}
      />
      <Stack.Screen
        name="Receipt"
        component={ReceiptScreen}
        options={{
          title: 'Digital Receipt',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="PassengerList"
        component={PassengerListScreen}
        options={{ title: 'Passengers', gestureEnabled: true }}
      />
      <Stack.Screen
        name="TripSummary"
        component={TripSummaryScreen}
        options={{ title: 'Trip Summary', gestureEnabled: true }}
      />
      <Stack.Screen
        name="Report"
        component={ReportScreen}
        options={{ title: 'Issue Report', gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Barlow_600SemiBold,
    Barlow_700Bold,
    Barlow_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontWaitTimedOut, setFontWaitTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontWaitTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!fontsLoaded && !fontWaitTimedOut) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.red900 }}>
        <ActivityIndicator size="large" color={colors.yellow500} />
        <Text style={{ color: colors.white, marginTop: 16 }}>Loading TalaByahe…</Text>
      </View>
    );
  }

  return (
    <TripProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </TripProvider>
  );
}
