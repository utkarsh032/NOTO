import { radius, spacing } from '@noto/config';
import type { NotoDocument } from '@noto/types';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotoStore } from '../src/hooks/use-noto-store';
import { useThemeColors } from '../src/theme';

export default function DocumentListScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { status, error, documents, createDocument } = useNotoStore();

  const onCreate = async () => {
    const document = await createDocument();
    if (document) router.push(`/document/${document.id}`);
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
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceRaised,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={[styles.excerpt, { color: colors.textMuted }]} numberOfLines={2}>
        {item.excerpt || 'Empty document'}
      </Text>
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
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    padding: spacing.lg,
  },
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
