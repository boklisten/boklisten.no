import { useNavigate } from "@tanstack/react-router";

import { showBlid, showCustomer } from "@/features/kasse/kasseParams";
import SearchSpotlight from "@/features/search/SearchSpotlight";
import { globalSearchStore } from "@/features/search/openSearch";
import useSearchShortcuts from "@/features/search/useSearchShortcuts";

const KASSE_PATH = "/admin/kasse";

/**
 * The search that is one shortcut away on every admin page. It also finds the admin pages the user
 * may open, by the same names as the sidebar. A customer or book pick opens it in the Kasse; from
 * the Kasse itself the page's own search takes over (see KasseSearch), so a pick there follows the
 * open view instead of navigating.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  useSearchShortcuts();

  return (
    <SearchSpotlight
      store={globalSearchStore}
      kinds={{ customers: true, books: true, pages: true }}
      onSelectCustomer={(detailsId) =>
        void navigate({ to: KASSE_PATH, search: showCustomer(detailsId) })
      }
      onSelectBook={(blid) => void navigate({ to: KASSE_PATH, search: showBlid(blid) })}
    />
  );
}
