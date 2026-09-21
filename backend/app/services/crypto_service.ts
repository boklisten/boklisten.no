import crypto from "node:crypto";

const CryptoService = {
  random() {
    return crypto.randomBytes(20).toString("hex");
  },
};

export default CryptoService;
