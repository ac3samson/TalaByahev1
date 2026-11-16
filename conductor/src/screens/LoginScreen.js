import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, fonts } from '../theme';
import { api } from '../api';
import { useTrip } from '../context/TripContext';

export default function LoginScreen({ navigation }) {
  const { adoptConductor } = useTrip();
  const [employeeId, setEmployeeId] = useState('EMP-');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = Boolean(employeeId.trim() && password);

  const handleLogin = async () => {
    const id = employeeId.trim().toUpperCase();
    if (!id || !password) {
      setError('Enter your employee ID and password');
      Alert.alert('Sign in required', 'Enter your employee ID and password to continue.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await api.conductorLogin({ employeeId: id, password });
      if (!result?.ok || !result?.conductor?.id) {
        throw new Error('Invalid employee ID or password');
      }
      await adoptConductor(result.conductor);
      navigation.replace('Home', { conductor: result.conductor });
    } catch (err) {
      setError(err.message || 'Invalid employee ID or password');
      Alert.alert('Sign in failed', err.message || 'Invalid employee ID or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>TalaByahe</Text>
        <Text style={styles.subtitle}>Conductor App</Text>
        <Text style={styles.label}>Employee ID</Text>
        <TextInput
          style={styles.input}
          value={employeeId}
          onChangeText={setEmployeeId}
          placeholder="EMP-001"
          placeholderTextColor={colors.gray600}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
        />
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={() =>
            Alert.alert(
              'Forgot Password',
              'Contact your dispatcher or admin to reset your conductor account password.',
            )
          }
        >
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={!canSubmit || loading}
        >
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Sign In</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.red900,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 28,
    textAlign: 'center',
    color: colors.red900,
  },
  subtitle: {
    fontFamily: fonts.body,
    textAlign: 'center',
    color: colors.gray600,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodySemi,
    marginBottom: 6,
    color: colors.gray800,
  },
  input: {
    fontFamily: fonts.body,
    fontWeight: '400',
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    color: colors.gray800,
  },
  passwordRow: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 72,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeText: {
    fontFamily: fonts.bodySemi,
    color: colors.red700,
    fontSize: 13,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    fontFamily: fonts.bodySemi,
    color: colors.red700,
    fontSize: 14,
  },
  error: {
    fontFamily: fonts.bodySemi,
    color: colors.red700,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.red700,
    padding: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    color: colors.white,
    fontSize: 16,
  },
});
