import { radius, spacing, typeScale } from '@noto/config';
import type { NotoDocument } from '@noto/types';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNotoStore } from '../src/hooks/use-noto-store';
import { useThemeColors } from '../src/theme';

export default function DocumentListScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { status, error, documents, createDocument, deleteDocument } = useNotoStore();

  const onCreate = async () => {
    const document = await createDocument();
    if (document) router.push(`/document/${document.id}`);
  };

  const confirmDelete = (document: NotoDocument) => {
    Alert.alert(
      'Delete document',
      `“${document.title || 'Untitled'}” will be moved to trash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteDocument(document.id),
        },
      ],
      { cancelable: true },
    );
  };

  if (status === 'loading') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Storage unavailable</Text>
        <Text style={[styles.excerpt, { color: colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: NotoDocument }) => (
    <Pressable
      onPress={() => router.push(`/document/${item.id}`)}
      /* Long-press mirrors the platform gesture for "do something to this row";
         the visible button next to it is what makes the action discoverable. */
      onLongPress={() => confirmDelete(item)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.title || 'Untitled'}
        </Text>
        <Text style={[styles.excerpt, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.excerpt || 'Empty document'}
        </Text>
      </View>

      <Pressable
        onPress={() => confirmDelete(item)}
        /* Padded out to the 44px the design system asks for: the label itself
           is nowhere near a comfortable target. */
        hitSlop={spacing[2]}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.title || 'Untitled'}`}
        style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.rowActionLabel, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>No documents yet</Text>
            <Text style={[styles.excerpt, { color: colors.textSecondary }]}>
              Tap New document to start writing.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => void onCreate()}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? colors.brandHover : colors.brand },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onBrand }]}>New document</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing[6] },
  list: { flexGrow: 1, gap: spacing[2], padding: spacing[4] },
  row: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
  },
  rowText: { flex: 1, gap: spacing[1] },
  rowAction: { paddingHorizontal: spacing[2], paddingVertical: spacing[3] },
  rowActionLabel: { fontSize: typeScale.bodySmall.fontSize, fontWeight: '600' },
  title: {
    fontSize: typeScale.h4.fontSize,
    fontWeight: typeScale.h4.fontWeight,
    lineHeight: typeScale.h4.lineHeight,
  },
  excerpt: {
    fontSize: typeScale.bodySmall.fontSize,
    lineHeight: typeScale.bodySmall.lineHeight,
  },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
    margin: spacing[4],
    minHeight: 48,
    padding: spacing[3],
  },
  buttonLabel: { fontSize: typeScale.bodyLarge.fontSize, fontWeight: typeScale.button.fontWeight },
});
