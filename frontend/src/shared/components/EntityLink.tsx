import TanStackAnchor from "@/shared/components/TanStackAnchor";

/**
 * A link that reads like the text around it — a name, a title, a code — and only reveals itself
 * as clickable on hover and focus. The admin standard for every in-page link: plain link blue is
 * reserved for the public site.
 */
// oxlint-disable-next-line react/function-component-definition
const EntityLink: typeof TanStackAnchor = (props) => (
  <TanStackAnchor c="inherit" fw={600} underline="hover" {...props} />
);

export default EntityLink;
