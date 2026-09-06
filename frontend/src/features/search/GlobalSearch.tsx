import { useLocation, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

import type { KasseSearchInput } from "@/features/kasse/kasseParams";
import { readKasseSearch, showBookSearch, showCustomerSearch } from "@/features/kasse/kasseParams";
import { visibleAdminPages } from "@/features/layout/adminNavigation";
import SearchSpotlight from "@/features/search/SearchSpotlight";
import { globalSearchStore } from "@/features/search/openSearch";
import useSearchShortcuts from "@/features/search/useSearchShortcuts";
import useAuth from "@/shared/hooks/useAuth";

const KASSE_PATH = "/admin/kasse";

/**
 * The search that is one shortcut away on every admin page. It also finds the admin pages the user
 * may open, by the same names as the sidebar. A customer or book pick lands in the Kasse: a
 * customer opens in Kunde, a book in Boksøk. From the Kasse itself the pick merges into the current
 * URL so the other modes keep their result; from anywhere else it starts a clean Kasse URL.
 */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const pages = useMemo(() => visibleAdminPages(isAdmin), [isAdmin]);
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
      pages={pages}
      onSelectPage={(page) => void navigate({ to: page.to })}
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
