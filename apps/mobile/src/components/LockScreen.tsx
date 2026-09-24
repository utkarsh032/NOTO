import { APP_NAME } from '@noto/config';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '../theme';

export interface LockScreenProps {
  /** `false` while Noto is only covered for the app switcher. */
  locked: boolean;
  onUnlock(): void;
}

/**
 * Drawn over the interface while Noto is locked or in the background.
 *
 * The WebView stays mounted underneath, so unlocking returns to exactly where
 * the person was: the open document, the cursor, an unsaved edit.
 */
export function LockScreen({ locked, onUnlock }: LockScreenProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.cover, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{APP_NAME}</Text>
      {locked ? (
        <>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>Noto is locked.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onUnlock}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.brand, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.buttonLabel}>Unlock</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    alignItems: 'center',
    bottom: 0,
    gap: 12,
    justifyContent: 'center',
    left: 0,
    padding: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  title: { fontSize: 22, fontWeight: '600' },
  detail: { fontSize: 15 },
  button: {
    borderRadius: 10,
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  buttonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
