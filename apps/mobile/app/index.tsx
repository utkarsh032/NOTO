import { radius, spacing } from '@noto/config';
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
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>Storage unavailable</Text>
        <Text style={[styles.excerpt, { color: colors.textMuted }]}>{error}</Text>
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
          backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceRaised,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {item.title || 'Untitled'}
        </Text>
        <Text style={[styles.excerpt, { color: colors.textMuted }]} numberOfLines={2}>
          {item.excerpt || 'Empty document'}
        </Text>
      </View>

      <Pressable
        onPress={() => confirmDelete(item)}
        hitSlop={spacing.sm}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.title || 'Untitled'}`}
        style={({ pressed }) => [styles.rowAction, { opacity: pressed ? 0.5 : 1 }]}
      >
        <Text style={[styles.rowActionLabel, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </Pressable>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={[styles.title, { color: colors.text }]}>No documents yet</Text>
            <Text style={[styles.excerpt, { color: colors.textMuted }]}>
              Tap New to start writing.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() => void onCreate()}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: pressed ? colors.accentHover : colors.accent },
        ]}
      >
        <Text style={[styles.buttonLabel, { color: colors.accentText }]}>New document</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  list: { flexGrow: 1, padding: spacing.lg, gap: spacing.sm },
  row: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rowText: { flex: 1, gap: spacing.xs },
  rowAction: { paddingVertical: spacing.xs },
  rowActionLabel: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '600' },
  excerpt: { fontSize: 13 },
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    margin: spacing.lg,
    padding: spacing.lg,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
});
