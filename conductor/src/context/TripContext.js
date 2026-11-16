import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

const TripContext = createContext(null);
const STORAGE_KEY = 'talabyahe_trip_data';
const HEARTBEAT_MS = 15000;

function normalizeTrip(trip) {
  if (!trip) return null;
  return {
    id: trip.id,
    routeId: trip.routeId,
    routeName: trip.routeName,
    busId: trip.busId,
    busPlate: trip.busPlate,
    stops: trip.stops || [],
    conductorId: trip.conductorId,
    conductorName: trip.conductorName,
  };
}

function normalizeTickets(list) {
  return (list || []).map((ticket) => ({
    id: ticket.id,
    from: ticket.from,
    to: ticket.to,
    fare: ticket.fare,
    baseFare: ticket.baseFare ?? ticket.fare,
    discountApplied: !!ticket.discountApplied,
    discountPercent: ticket.discountApplied ? 20 : 0,
    discountType: ticket.discountType || null,
    time: ticket.time,
    conductor: ticket.conductor,
    tripId: ticket.tripId,
    routeId: ticket.routeId,
  }));
}

export function TripProvider({ children }) {
  const [conductor, setConductor] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [sessionReady, setSessionReady] = useState(false);
  const appState = useRef(AppState.currentState);

  const applyServerTrip = (data) => {
    if (data?.trip?.status === 'Active') {
      setActiveTrip(normalizeTrip(data.trip));
      setTickets(normalizeTickets(data.tickets));
      return data.trip;
    }
    setActiveTrip(null);
    setTickets([]);
    return null;
  };

  const syncTripFromServer = async (employeeId) => {
    if (!employeeId) return null;
    const data = await api.trips.current(employeeId);
    return applyServerTrip(data);
  };

  const adoptConductor = async (nextConductor) => {
    setConductor(nextConductor);
    if (!nextConductor?.id) {
      setActiveTrip(null);
      setTickets([]);
      return null;
    }
    try {
      return await syncTripFromServer(nextConductor.id);
    } catch {
      // Offline — keep whatever local trip state we already have.
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const data = JSON.parse(raw);
          if (data.conductor) setConductor(data.conductor);
          if (data.activeTrip) setActiveTrip(data.activeTrip);
          if (Array.isArray(data.tickets)) setTickets(data.tickets);
        }
      } catch {
        // Corrupt session — start clean.
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reconcile with server after local hydrate / login (fixes reinstall desync).
  useEffect(() => {
    if (!sessionReady || !conductor?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.trips.current(conductor.id);
        if (!cancelled) applyServerTrip(data);
      } catch {
        // Keep local cache if API is unreachable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, conductor?.id]);

  useEffect(() => {
    if (!sessionReady || !conductor) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ conductor, activeTrip, tickets }),
    );
  }, [activeTrip, tickets, conductor, sessionReady]);

  // Keep admin "Status" Active while the conductor app is open and in the foreground.
  useEffect(() => {
    if (!conductor?.id) return undefined;

    let cancelled = false;
    let timer = null;

    const send = async (online) => {
      try {
        await api.conductorPresence(conductor.id, online);
      } catch {
        // Presence is best-effort; login/ticket flows still work offline-ish.
      }
    };

    const startHeartbeat = () => {
      if (timer) return;
      send(true);
      timer = setInterval(() => send(true), HEARTBEAT_MS);
    };

    const stopHeartbeat = (markOffline) => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (markOffline) send(false);
    };

    if (appState.current === 'active') startHeartbeat();

    const onAppState = (next) => {
      if (cancelled) return;
      const wasActive = appState.current === 'active';
      appState.current = next;
      if (next === 'active' && !wasActive) {
        startHeartbeat();
      } else if (next !== 'active' && wasActive) {
        stopHeartbeat(true);
      }
    };

    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.remove();
      stopHeartbeat(true);
    };
  }, [conductor?.id]);

  const startTrip = async ({ routeId, busId, onPending }) => {
    if (!conductor?.id) throw new Error('Sign in before starting a trip');
    const requested = await api.trips.start({
      routeId,
      busId,
      conductorId: conductor.id,
      conductorName: conductor.name,
    });
    onPending?.(requested);

    const waitMs = 2500;
    const timeoutMs = 5 * 60 * 1000;
    const started = Date.now();
    let trip = requested;

    while (trip.status === 'Pending') {
      if (Date.now() - started > timeoutMs) {
        throw new Error('Timed out waiting for admin approval');
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      trip = await api.trips.get(requested.id);
    }

    if (trip.status === 'Rejected') {
      throw new Error('Trip start was rejected by admin');
    }
    if (trip.status !== 'Active') {
      throw new Error(`Unexpected trip status: ${trip.status}`);
    }

    const normalized = {
      id: trip.id,
      routeId: trip.routeId,
      routeName: trip.routeName,
      busId: trip.busId,
      busPlate: trip.busPlate,
      stops: trip.stops,
      conductorId: trip.conductorId,
      conductorName: trip.conductorName,
    };
    setActiveTrip(normalized);
    setTickets([]);
    return normalized;
  };

  const issueTicket = async ({ from, to, fare, baseFare, discountApplied, discountType }) => {
    if (!activeTrip?.id) throw new Error('Start a trip before issuing tickets');
    const created = await api.tickets.create({
      tripId: activeTrip.id,
      from,
      to,
      fare,
      baseFare: baseFare ?? fare,
      discountApplied: !!discountApplied,
    });
    const applied = !!created.discountApplied;
    const ticket = {
      id: created.id,
      from: created.from,
      to: created.to,
      fare: created.fare,
      baseFare: created.baseFare ?? created.fare,
      discountApplied: applied,
      discountPercent: applied ? 20 : 0,
      discountType: applied ? discountType || null : null,
      time: created.time,
      conductor: created.conductor,
      tripId: created.tripId,
      routeId: created.routeId,
    };
    setTickets((prev) => [ticket, ...prev]);
    return ticket;
  };

  const endTrip = async () => {
    if (activeTrip?.id) {
      await api.trips.end(activeTrip.id);
    }
    setActiveTrip(null);
    setTickets([]);
  };

  const logout = async () => {
    if (activeTrip?.id) {
      throw new Error('Cannot sign out while on an active trip. End the trip first.');
    }
    if (conductor?.id) {
      try {
        await api.conductorPresence(conductor.id, false);
      } catch {
        // ignore
      }
    }
    setConductor(null);
    setActiveTrip(null);
    setTickets([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const totalEarnings = useMemo(() => tickets.reduce((sum, t) => sum + Number(t.fare || 0), 0), [tickets]);

  return (
    <TripContext.Provider
      value={{
        sessionReady,
        conductor,
        setConductor,
        adoptConductor,
        syncTripFromServer,
        activeTrip,
        startTrip,
        tickets,
        issueTicket,
        endTrip,
        logout,
        totalEarnings,
        isOffline: false,
      }}
    >
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used within TripProvider');
  return ctx;
}
