import { useLocation, useNavigate } from "@tanstack/react-router";

import type { KasseSearchInput } from "@/features/kasse/kasseParams";
import { readKasseSearch, showBookSearch, showCustomerSearch } from "@/features/kasse/kasseParams";
import SearchSpotlight from "@/features/search/SearchSpotlight";
import { globalSearchStore } from "@/features/search/openSearch";
import useSearchShortcuts from "@/features/search/useSearchShortcuts";

const KASSE_PATH = "/admin/kasse";

/**
 * The search that is one shortcut away on every admin page. A pick lands in the Kasse: a customer
 * opens in Kunde, a book in Boksøk. From the Kasse itself the pick merges into the current URL so
 * the other modes keep their result; from anywhere else it starts a clean Kasse URL.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation({
    select: (current) => ({ pathname: current.pathname, search: current.search }),
  });
  useSearchShortcuts();

  const currentKasseSearch = (): KasseSearchInput =>
    location.pathname === KASSE_PATH ? readKasseSearch(location.search) : {};

  return (
    <SearchSpotlight
      store={globalSearchStore}
      kinds={{ customers: true, books: true }}
      onSelectCustomer={(detailsId) =>
        void navigate({
          to: KASSE_PATH,
          search: showCustomerSearch(detailsId)(currentKasseSearch()),
        })
      }
      onSelectBook={(blid) =>
        void navigate({ to: KASSE_PATH, search: showBookSearch(blid)(currentKasseSearch()) })
      }
    />
  );
}
