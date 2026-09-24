import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { WriterOnly } from '../../../components/WriterOnly';
import { isIsbn, normalizeBarcode } from '../../../lib/barcode';
import { resolveBarcode } from '../../../lib/barcodeResolve';
import { radius, spacing, useTheme } from '../../../lib/theme';

function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [resolving, setResolving] = useState(false);
  const lockedRef = useRef(false);

  const handleResolved = useCallback(
    async (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code || resolving || lockedRef.current) return;

      lockedRef.current = true;
      setResolving(true);
      try {
        const result = await resolveBarcode(code);

        if (result.kind === 'book') {
          router.replace({
            pathname: '/scan/confirm-book',
            params: { payload: JSON.stringify(result.book) },
          });
          return;
        }

        if (result.kind === 'movie_candidates') {
          router.replace({
            pathname: '/scan/confirm-movie',
            params: {
              barcode: result.barcode,
              productTitle: result.productTitle,
              ownershipHints: JSON.stringify(result.ownershipHints),
              movies: JSON.stringify(result.movies),
            },
          });
          return;
        }

        const searchBooks = isIsbn(result.barcode);
        Alert.alert('No match', result.reason, [
          {
            text: searchBooks ? 'Search books' : 'Search movies',
            onPress: () =>
              router.replace({
                pathname: searchBooks ? '/add-book' : '/add',
                params: result.suggestedQuery ? { q: result.suggestedQuery } : undefined,
              }),
          },
          {
            text: 'Scan again',
            style: 'cancel',
            onPress: () => {
              lockedRef.current = false;
            },
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not resolve barcode.';
        Alert.alert('Scan failed', message, [
          {
            text: 'OK',
            onPress: () => {
              lockedRef.current = false;
            },
          },
        ]);
      } finally {
        setResolving(false);
      }
    },
    [resolving, router],
  );

  const onBarcodeScanned = (scan: BarcodeScanningResult) => {
    void handleResolved(scan.data);
  };

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access needed</Text>
        <Text style={[styles.permissionBody, { color: colors.textSecondary }]}>
          Allow camera access to scan disc and book barcodes. Cards are not supported.
        </Text>
        <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
        onBarcodeScanned={resolving || lockedRef.current ? undefined : onBarcodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.overlayTitle}>Scan barcode</Text>
        <Text style={styles.overlayHint}>Books (ISBN) or movie discs (UPC/EAN)</Text>
        <View style={styles.frame} />
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        {resolving ? (
          <View style={styles.resolvingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={{ color: colors.textSecondary }}>Looking up…</Text>
          </View>
        ) : (
          <>
            <Text style={[styles.manualLabel, { color: colors.textSecondary }]}>
              Or enter code manually
            </Text>
            <View style={styles.manualRow}>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                keyboardType="number-pad"
                placeholder="UPC or ISBN"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.manualInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Pressable
                onPress={() => void handleResolved(manualCode)}
                style={[styles.manualButton, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: colors.accentText, fontWeight: '700' }}>Go</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/add')} style={styles.secondary}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Search movies (TMDb)</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/add-book')} style={styles.secondary}>
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Search books (Open Library)</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  permissionBody: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  overlayHint: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  frame: {
    width: '75%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.md,
    marginTop: spacing.xl,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  manualLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  manualButton: {
    minWidth: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

export default function ScanRoute() {
  return (
    <WriterOnly>
      <ScanScreen />
    </WriterOnly>
  );
}
