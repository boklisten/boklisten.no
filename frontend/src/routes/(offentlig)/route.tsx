import PublicLayout from "@/features/PublicLayout";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/(offentlig)")({
  component: PublicPageLayout,
});

/**
 * One layout for every public page, so the header keeps its state (and its highlighter glides)
 * from page to page. The front page paints its own background edge to edge, so it gets no padding.
 */
function PublicPageLayout() {
  const frontpage = useLocation({ select: (location) => location.pathname === "/" });
  return frontpage ? (
    <PublicLayout padding={0} withBorder={false} footerSpacing={0}>
      <Outlet />
    </PublicLayout>
  ) : (
    <PublicLayout padding="md" withBorder>
      <Outlet />
    </PublicLayout>
  );
}
