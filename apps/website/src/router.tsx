/**
 * A minimal history router.
 *
 * The website is nine static pages with no nested routes, no data loaders and
 * no route parameters. A routing library would be more configuration than the
 * problem needs, so this is the whole of it: a pathname in state, `pushState`
 * to change it, and a `popstate` listener for the back button.
 *
 * `public/_redirects` serves index.html for every path so a deep link and a
 * refresh both reach this code rather than a 404.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';

import { RouterContext, normalisePath, useRouter } from './router-context';

export function Router({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => normalisePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalisePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const target = normalisePath(to);
    if (target === normalisePath(window.location.pathname)) return;

    window.history.pushState({}, '', target);
    setPath(target);
    // A pushState navigation does not reset the scroll position the way a real
    // page load does; without this every page opens halfway down.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * An anchor that routes internally but behaves like an ordinary link otherwise,
 * so external URLs, new-tab clicks and middle clicks all keep working.
 */
export function Link({ href, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const isInternal = href.startsWith('/') && !href.startsWith('//');

  return (
    <a
      href={href}
      {...(isInternal ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!isInternal) return;
        // Leave modified clicks to the browser: they mean "open elsewhere".
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (event.button !== 0) return;

        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
