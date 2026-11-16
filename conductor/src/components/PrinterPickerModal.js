import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export default function PrinterPickerModal({
  visible,
  loading,
  printers,
  error,
  onRefresh,
  onSelect,
  onClose,
  title = 'Select Printer',
  closeLabel = 'Cancel',
  selectable = true,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          {loading ? (
            <ActivityIndicator color={colors.red700} style={{ marginVertical: spacing.md }} />
          ) : (
            <ScrollView style={styles.list}>
              {printers.length === 0 ? (
                <Text style={styles.empty}>No paired Bluetooth devices found.</Text>
              ) : (
                printers.map((printer) => {
                  const content = (
                    <>
                      <Text style={styles.name}>{printer.name}</Text>
                      <Text style={styles.address}>{printer.address}</Text>
                    </>
                  );

                  if (!selectable) {
                    return (
                      <View key={printer.address || printer.id} style={styles.row}>
                        {content}
                      </View>
                    );
                  }

                  return (
                    <TouchableOpacity
                      key={printer.address || printer.id}
                      style={styles.row}
                      onPress={() => onSelect?.(printer)}
                    >
                      {content}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onRefresh}
              disabled={loading}
              accessibilityState={{ disabled: loading }}
            >
              <Text style={[styles.secondaryText, loading && styles.disabledText]}>Refresh</Text>
            </TouchableOpacity>
            {/* Close must stay tappable even if Bluetooth listing hangs. */}
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryText}>{closeLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  title: { fontFamily: fonts.header, fontSize: 20, color: colors.red900, marginBottom: spacing.md },
  list: { maxHeight: 280 },
  empty: { fontFamily: fonts.body, color: colors.gray600, textAlign: 'center', paddingVertical: spacing.lg },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  name: { fontFamily: fonts.bodySemi, color: colors.gray800, fontSize: 16 },
  address: { fontFamily: fonts.body, color: colors.gray600, fontSize: 12, marginTop: 2 },
  error: { fontFamily: fonts.body, color: colors.red700, marginTop: spacing.sm, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: spacing.md },
  secondaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryText: { fontFamily: fonts.bodyBold, color: colors.red700 },
  disabledText: { opacity: 0.45 },
  primaryBtn: {
    backgroundColor: colors.gray200,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  primaryText: { fontFamily: fonts.bodyBold, color: colors.gray800 },
});
