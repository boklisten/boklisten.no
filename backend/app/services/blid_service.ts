import CryptoService from "#services/crypto_service";

const BlidService = {
  createUserBlid(provider: string, providerId: string) {
    return "u#" + CryptoService.cipher(provider + providerId);
  },

  /** A BL-ID is either a 12-character alphanumeric id or an 8-digit numeric id. */
  isValidBlid(scannedText: string): boolean {
    if (Number.isNaN(Number(scannedText))) {
      return scannedText.length === 12;
    }
    return scannedText.length === 8;
  },
};
export default BlidService;
