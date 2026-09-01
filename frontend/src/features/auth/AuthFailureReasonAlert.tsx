import type { AuthVippsError } from "@boklisten/backend/shared/auth_vipps_error";

import ErrorAlert from "@/shared/components/alerts/ErrorAlert";
import { PLEASE_TRY_AGAIN_TEXT } from "@/shared/utils/constants";

const AUTH_VIPPS_ERROR = {
  ACCESS_DENIED: "access_denied",
  EXPIRED: "expired",
  ERROR: "error",
} as const satisfies Record<Uppercase<AuthVippsError>, AuthVippsError>;

export default function AuthFailureReasonAlert({ reason }: { reason: string }) {
  let text = "";
  switch (reason) {
    case AUTH_VIPPS_ERROR.ACCESS_DENIED: {
      text = "Du har avbrutt innloggingsprosessen";
      break;
    }
    case AUTH_VIPPS_ERROR.EXPIRED: {
      text = "Forespørselen din har utløpt";
      break;
    }
    default: {
      text = "Det skjedde en ukjent feil";
      break;
    }
  }

  return <ErrorAlert title={text}>{PLEASE_TRY_AGAIN_TEXT}</ErrorAlert>;
}
