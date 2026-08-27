import { spacing, typeScale } from '@noto/config';
import { contentFromPlainText, plainTextFromContent } from '@noto/core';
import type { UpdateDocumentInput } from '@noto/types';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
  const router = useRouter();
  const colors = useThemeColors();
  const { status, documents, updateDocument, deleteDocument } = useNotoStore();

  const [draft, setDraft] = useState<Draft | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<UpdateDocumentInput | null>(null);

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

  /** Writes whatever is queued, right now. Safe to call after unmount. */
  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const queued = pendingRef.current;
    if (!queued || !id) return;

    pendingRef.current = null;
    void updateDocument(id, queued);
  }, [id, updateDocument]);

  /*
   * Flushing on unmount is what makes leaving inside the autosave window safe:
   * the cleanup used to only clear the timer, so tapping back within 600ms of
   * the last keystroke threw those edits away.
   */
  useEffect(() => () => flush(), [flush]);

  const edit = (patch: Partial<Omit<Draft, 'documentId'>>) => {
    if (!active || !id) return;

    const next: Draft = { ...active, ...patch, documentId: id };
    setDraft(next);

    pendingRef.current = {
      title: next.title,
      content: contentFromPlainText(next.body),
    };

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  };

  const onDelete = useCallback(() => {
    if (!id) return;

    Alert.alert(
      'Delete document',
      `“${active?.title || 'Untitled'}” will be moved to trash.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Drop the queued autosave first: flushing it after the delete would
            // resurrect the document by writing a fresh `updatedAt` over it.
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = null;
            pendingRef.current = null;

            // The draft is what keeps this screen rendering a document the
            // store has already tombstoned. Dropping it is what lets the
            // screen fall through to its loading state while the pop happens.
            setDraft(null);

            void deleteDocument(id).then(() => {
              // A document opened from the list has one to go back to. One
              // opened by `noto://document/<id>` is the only entry in its
              // stack, and popping it would leave the deleted document on
              // screen with no way off it.
              if (router.canGoBack()) router.back();
              else router.replace('/');
            });
          },
        },
      ],
      { cancelable: true },
    );
  }, [active?.title, deleteDocument, id, router]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={onDelete}
          hitSlop={spacing[3]}
          accessibilityRole="button"
          accessibilityLabel="Delete document"
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={[styles.headerAction, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      ),
    });
  }, [navigation, onDelete, colors.danger]);

  if (status === 'loading' || !active) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TextInput
        value={active.title}
        onChangeText={(title) => edit({ title })}
        placeholder="Untitled"
        placeholderTextColor={colors.textDisabled}
        style={[styles.title, { color: colors.textPrimary }]}
      />

      <TextInput
        value={active.body}
        onChangeText={(body) => edit({ body })}
        placeholder="Start writing…"
        placeholderTextColor={colors.textDisabled}
        multiline
        textAlignVertical="top"
        style={[styles.body, { color: colors.textPrimary }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing[3], padding: spacing[4] },
  centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: {
    fontSize: typeScale.h1.fontSize,
    fontWeight: typeScale.h1.fontWeight,
    lineHeight: typeScale.h1.lineHeight,
  },
  /* The reading measure from the design system: a document set at body-large
     with the editor's generous leading, not the app's chrome sizing. */
  body: { flex: 1, fontSize: typeScale.bodyLarge.fontSize, lineHeight: 28 },
  headerAction: { fontSize: typeScale.bodyLarge.fontSize, fontWeight: typeScale.button.fontWeight },
});
