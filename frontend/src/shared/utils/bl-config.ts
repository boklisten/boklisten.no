const BL_CONFIG = {
  login: {
    localStorageKeys: {
      /** Where to go after a login that detours through Vipps or the pending-tasks page. */
      redirect: "bl-redirect",
    },
  },
} as const;

export default BL_CONFIG;
