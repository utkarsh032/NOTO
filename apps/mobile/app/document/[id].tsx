import { spacing } from '@noto/config';
import { contentFromPlainText, plainTextFromContent } from '@noto/core';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { useNotoStore } from '../../src/hooks/use-noto-store';
import { useThemeColors } from '../../src/theme';

const AUTOSAVE_DELAY_MS = 600;

interface Draft {
  documentId: string;
  title: string;
  body: string;
}

/**
 * Mobile editing surface.
 *
 * Tiptap needs a DOM, so mobile edits plain text and stores it through
 * `contentFromPlainText`. The result is the same document model the other
 * platforms read, so a note written here opens correctly on web and desktop.
 */
export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const { status, documents, updateDocument } = useNotoStore();

  const [draft, setDraft] = useState<Draft | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stored = useMemo(() => documents.find((row) => row.id === id) ?? null, [documents, id]);

  /*
   * What is on screen: the local draft while the user is typing, otherwise the
   * stored document. Deriving this rather than copying into state on load means
   * a background refresh can never overwrite in-progress edits.
   */
  const active: Draft | null =
    draft?.documentId === id
      ? draft
      : stored
        ? {
            documentId: stored.id,
            title: stored.title,
            body: plainTextFromContent(stored.content),
          }
        : null;

  useEffect(() => {
    navigation.setOptions({ title: active?.title || 'Untitled' });
  }, [navigation, active?.title]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const edit = (patch: Partial<Omit<Draft, 'documentId'>>) => {
    if (!active || !id) return;

    const next: Draft = { ...active, ...patch, documentId: id };
    setDraft(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void updateDocument(id, {
        title: next.title,
        content: contentFromPlainText(next.body),
      });
    }, AUTOSAVE_DELAY_MS);
  };

  if (status === 'loading' || !active) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <TextInput
        value={active.title}
        onChangeText={(title) => edit({ title })}
        placeholder="Untitled"
        placeholderTextColor={colors.textSubtle}
        style={[styles.title, { color: colors.text }]}
      />

      <TextInput
        value={active.body}
        onChangeText={(body) => edit({ body })}
        placeholder="Start writing…"
        placeholderTextColor={colors.textSubtle}
        multiline
        textAlignVertical="top"
        style={[styles.body, { color: colors.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.md, padding: spacing.lg },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700' },
  body: { flex: 1, fontSize: 16, lineHeight: 24 },
});
