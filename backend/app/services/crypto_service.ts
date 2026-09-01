import crypto from "node:crypto";

const CryptoService = {
  cipher(message: string) {
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(crypto.randomBytes(32)),
      crypto.randomBytes(16),
    );
    return cipher.update(message, "utf8", "hex") + cipher.final("hex");
  },
  random() {
    return crypto.randomBytes(20).toString("hex");
  },
};

export default CryptoService;
