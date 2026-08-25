import { useEffect } from "react";

import useAuthLinker from "@/shared/hooks/useAuthLinker";

export default function RedirectToBlAdmin(props: { path: string; retainHistory?: boolean }) {
  const { redirectToBlAdmin } = useAuthLinker();
  useEffect(() => {
    void redirectToBlAdmin(props.path, props.retainHistory);
  }, [props.path, props.retainHistory, redirectToBlAdmin]);
  return null;
}
