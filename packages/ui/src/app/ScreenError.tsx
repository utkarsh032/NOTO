import { Button } from '../components/Button';
import { isChunkLoadError } from '../components/chunk-error';
import { ErrorState } from '../components/ErrorState';

/**
 * What a screen draws when it fails to render.
 *
 * Said in the order an error message owes the reader: what happened, that
 * their documents are safe, and what they can do. A failed chunk after a
 * deployment gets its own wording and only the button that can fix it.
 */
export function ScreenError({
  error,
  onRetry,
  onHome,
}: {
  error: Error;
  onRetry: () => void;
  onHome?: () => void;
}) {
  const stale = isChunkLoadError(error);

  return (
    <main className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-auto">
      <ErrorState
        title={stale ? 'Noto has been updated' : 'This screen could not be shown'}
        description={
          <>
            <p>
              {stale
                ? 'Part of this screen belongs to a newer version of Noto. Reload to get it.'
                : 'Something went wrong while drawing it.'}
            </p>
            <p className="mt-2">
              Your documents are saved on this device and have not been touched.
            </p>
          </>
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            {stale ? null : (
              <Button variant="secondary" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button variant={stale ? 'primary' : 'ghost'} onClick={() => window.location.reload()}>
              Reload Noto
            </Button>
            {onHome && !stale ? (
              <Button variant="ghost" onClick={onHome}>
                Go to Home
              </Button>
            ) : null}
          </div>
        }
      />
    </main>
  );
}

/**
 * The last line: the whole window failed.
 *
 * No shell to fall back into, so this is the page. It reloads rather than
 * retries, because whatever broke was above every screen.
 */
export function AppCrash({ error }: { error: Error }) {
  return (
    <main className="bg-background flex h-full items-center justify-center">
      <ErrorState
        title={isChunkLoadError(error) ? 'Noto has been updated' : 'Noto ran into a problem'}
        description={
          <>
            <p>Reloading usually fixes this.</p>
            <p className="mt-2">
              Your documents are saved on this device and have not been touched.
            </p>
          </>
        }
        action={
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload Noto
          </Button>
        }
      />
    </main>
  );
}
