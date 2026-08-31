import { APP_NAME } from '@noto/config';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

import { printHtml, saveFile, type SaveFileRequest } from '../platform/actions';
import { executeSql, selectSql } from '../platform/sql-host';
import { useThemeColors } from '../theme';

/**
 * Noto on Android.
 *
 * The interface is the `@noto/ui` application — the same one the web and
 * desktop builds render — packaged into the APK by
 * `plugins/with-android-webapp.cjs` and loaded from the asset folder. This
 * component is the shell around it: it answers the SQL the interface asks for
 * from the native SQLite connection, performs the two things a WebView cannot
 * do for itself, and turns the hardware back button into navigation.
 *
 * That is the whole reason the port was worth doing this way. Tabs, find and
 * replace, history, rich formatting, the outline, the seven screens — none of
 * it had to be written twice, and none of it can drift, because it is not a
 * second implementation. It is the first one.
 */

/** Where the packaged interface lives once Gradle has assembled the APK. */
const PACKAGED_URI = 'file:///android_asset/webapp/index.html';

/**
 * A running `@noto/mobile-webview` dev server, when one is being used.
 *
 * Prebuild is what copies the built interface into the Android project, so
 * without this every interface change would mean a full prebuild and reinstall
 * to see. Point this at the Vite server instead and the phone reloads on save:
 *
 *   EXPO_PUBLIC_NOTO_WEBAPP_URL=http://192.168.1.10:5173 pnpm dev:mobile
 *
 * Use the machine's LAN address for a real device, or 10.0.2.2 for the
 * emulator. Unset in every build that ships.
 */
const DEV_URI = process.env.EXPO_PUBLIC_NOTO_WEBAPP_URL;

const WEBAPP_URI = DEV_URI ?? PACKAGED_URI;

interface BridgeRequest {
  id: number;
  channel: string;
  payload: unknown;
}

/**
 * Encodes a value for `injectJavaScript`.
 *
 * `JSON.stringify` of a JSON string produces a valid JavaScript string literal,
 * which is then parsed back on the page. The two line separators are escaped
 * afterwards: they are legal inside a JSON string and were, for a long time,
 * illegal inside a JavaScript one. Modern engines accept them, and Android's
 * WebView is one — but the cost of being sure is two replacements.
 */
function asScriptLiteral(value: unknown): string {
  return JSON.stringify(JSON.stringify(value))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

async function handle(channel: string, payload: unknown): Promise<unknown> {
  switch (channel) {
    case 'sql.execute': {
      const { sql, params } = payload as { sql: string; params: string[] };
      return executeSql(sql, params);
    }
    case 'sql.select': {
      const { sql, params } = payload as { sql: string; params: string[] };
      return selectSql(sql, params);
    }
    case 'print': {
      const { html } = payload as { html: string };
      return printHtml(html);
    }
    case 'file.save':
      return saveFile(payload as SaveFileRequest);
    default:
      throw new Error(`Noto received a request on an unknown channel: ${channel}.`);
  }
}

export function NotoWebView() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const webView = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  /** Runs a statement on the page. Nothing lands before the page has loaded. */
  const inject = useCallback((script: string) => {
    // `true;` at the end keeps the WebView from warning about a
    // non-serialisable completion value.
    webView.current?.injectJavaScript(`${script}true;`);
  }, []);

  const reply = useCallback(
    (value: { id: number; ok: boolean; result?: unknown; error?: string }) => {
      inject(`window.__noto&&window.__noto.resolve(JSON.parse(${asScriptLiteral(value)}));`);
    },
    [inject],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let request: BridgeRequest;
      try {
        request = JSON.parse(event.nativeEvent.data) as BridgeRequest;
      } catch {
        // Not ours. Nothing else posts on this channel today, but a malformed
        // message must not take the application down.
        return;
      }

      void (async () => {
        try {
          reply({
            id: request.id,
            ok: true,
            result: await handle(request.channel, request.payload),
          });
        } catch (cause) {
          reply({
            id: request.id,
            ok: false,
            error: cause instanceof Error ? cause.message : String(cause),
          });
        }
      })();
    },
    [reply],
  );

  /*
   * Safe areas. `env(safe-area-inset-*)` is not answered for Android's system
   * bars inside a WebView, so they are measured here and pushed in. Sent again
   * whenever they change — a rotation, or the navigation bar switching between
   * gestures and buttons.
   */
  useEffect(() => {
    if (!loaded) return;
    inject(`window.__noto&&window.__noto.event('insets',JSON.parse(${asScriptLiteral(insets)}));`);
  }, [inject, insets, loaded]);

  /*
   * The hardware back button walks the interface's own history — the shell
   * routes on the URL hash, so each screen is a real history entry. Returning
   * `false` at the start of it lets Android do what it would have done anyway
   * and leave the application.
   */
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      webView.current?.goBack();
      return true;
    });

    return () => subscription.remove();
  }, [canGoBack]);

  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
  }, []);

  if (failure) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {APP_NAME} could not start
        </Text>
        <Text style={[styles.detail, { color: colors.textSecondary }]}>{failure}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <WebView
        ref={webView}
        source={{ uri: WEBAPP_URI }}
        onMessage={onMessage}
        onLoadEnd={() => setLoaded(true)}
        onNavigationStateChange={onNavigationStateChange}
        onRenderProcessGone={() =>
          setFailure('The interface stopped responding and Android ended it. Reopen Noto.')
        }
        onError={({ nativeEvent }) =>
          setFailure(nativeEvent.description || 'The interface could not be loaded.')
        }
        /*
         * The interface is loaded from the APK's own asset folder, so it is a
         * `file://` page. Chromium gives such a page an opaque origin, which by
         * itself cannot read the script, stylesheet and font files sitting
         * beside it — these settings are what let a packaged application load
         * its own parts.
         *
         * They are safe here only because everything the WebView loads ships
         * inside the APK: there is no remote content, and nothing a document
         * contains is ever executed — pasted HTML is parsed into ProseMirror
         * nodes, never run. Revisit all of them the day Noto loads anything
         * over the network into this WebView.
         */
        originWhitelist={DEV_URI ? ['file://*', 'http://*', 'https://*'] : ['file://*']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        // Documents are in SQLite on this side; localStorage holds preferences
        // and the open-tab list, and both should survive being backgrounded.
        domStorageEnabled
        javaScriptEnabled
        // Noto has a zoom control of its own. A second, invisible one on top of
        // it would disagree with what the status bar reports.
        setBuiltInZoomControls={false}
        // The editor scrolls its own canvas; letting the WebView bounce the
        // whole page underneath it reads as the document coming loose.
        overScrollMode="never"
        bounces={false}
        // Without hardware acceleration a long document scrolls visibly badly
        // on mid-range devices.
        androidLayerType="hardware"
        // Nothing in Noto is a link to somewhere else, so there is no second
        // window to open. A stray one would replace the whole interface.
        setSupportMultipleWindows={false}
        style={[styles.fill, { backgroundColor: colors.background }]}
      />

      {!loaded ? (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  centered: { alignItems: 'center', flex: 1, gap: 8, justifyContent: 'center', padding: 24 },
  title: { fontSize: 17, fontWeight: '600' },
  detail: { fontSize: 14, textAlign: 'center' },
});
