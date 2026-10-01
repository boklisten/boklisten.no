import { Box } from "@mantine/core";
import { useLayoutEffect, useRef, useState } from "react";

import Logo from "@/features/layout/Logo";
import CartPill from "@/features/layout/public-nav/CartPill";
import MenuButton from "@/features/layout/nav/MenuButton";
import NavAnchor from "@/features/layout/nav/NavAnchor";
import classes from "@/features/layout/nav/Nav.module.css";
import { isNavLinkActive, usePathname } from "@/features/layout/nav/navigation";
import { CART_PATH, primaryLinks } from "@/features/layout/public-nav/publicNavigation";
import useAuth from "@/shared/hooks/useAuth";

/**
 * The teal bar at the top of every public page. On phones it holds the logo and the cart; the
 * navigation is the tab bar at the bottom. From `sm` up the same items sit top right: the three
 * primary links and the menu button, with one highlighter stroke that glides to the current page,
 * the cart pill included.
 */
export default function PublicTopBar({
  menuOpened,
  onOpenMenu,
}: {
  menuOpened: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const links = primaryLinks(isLoggedIn);
  const activeKey =
    links.find((link) => isNavLinkActive(link, pathname))?.to ??
    (isNavLinkActive({ to: CART_PATH }, pathname) ? CART_PATH : null);
  const { navRef, marker, settled } = useMarker(activeKey);

  return (
    <div className={classes.bar}>
      <Logo variant="white" />
      <div ref={navRef} className={classes.actions}>
        <Box
          component="span"
          className={classes.marker}
          data-visible={marker ? "" : undefined}
          data-animate={settled ? "" : undefined}
          style={{
            "--marker-x": `${marker?.left ?? 0}px`,
            "--marker-w": `${marker?.width ?? 0}px`,
            "--marker-bottom": `${marker?.bottom ?? 0}px`,
          }}
          aria-hidden
        />
        <CartPill />
        <nav className={classes.links} aria-label="Hovedmeny">
          {links.map((link) => (
            <NavAnchor
              key={link.to}
              to={link.to}
              active={link.to === activeKey}
              className={classes.link}
              data-key={link.to}
            >
              {link.label}
            </NavAnchor>
          ))}
          <MenuButton
            className={`${classes.link} ${classes.menuLink}`}
            iconClassName={classes.menuIcon}
            opened={menuOpened}
            onOpen={onOpenMenu}
          />
        </nav>
      </div>
    </div>
  );
}

/**
 * Where the stroke sits: the item with `data-key` equal to `key`, measured inside the actions
 * box and re-measured when the box changes size or its items come and go (the cart pill leaves
 * when the cart is emptied). An item that is not shown at this width (the links on a phone) gives
 * no stroke. `settled` turns true after the first measurement so the stroke appears in place on
 * load and only glides from then on.
 */
function useMarker(key: string | null) {
  const navRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<{ left: number; width: number; bottom: number } | null>(
    null,
  );
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const measure = () => {
      const item =
        nav && key ? nav.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) : null;
      setMarker(
        item && item.offsetWidth > 0
          ? {
              left: item.offsetLeft,
              width: item.offsetWidth,
              bottom: item.offsetTop + item.offsetHeight,
            }
          : null,
      );
      setSettled(true);
    };
    measure();
    const resizes = new ResizeObserver(measure);
    const mutations = new MutationObserver(measure);
    if (nav) {
      resizes.observe(nav);
      mutations.observe(nav, { childList: true, subtree: true });
    }
    return () => {
      resizes.disconnect();
      mutations.disconnect();
    };
  }, [key]);

  return { navRef, marker, settled };
}
