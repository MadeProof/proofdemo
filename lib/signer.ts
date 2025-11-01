import { createPrivateKey, createPublicKey, sign } from "crypto";

const privPem = process.env.MP_SIGN_PRIV || "";
const pubPem  = process.env.MP_SIGN_PUB  || "";

export function signReceipt(payload: object) {
  if (!privPem || !pubPem) throw new Error("Signing keys not configured");
  const data = Buffer.from(JSON.stringify(payload));
  const privateKey = createPrivateKey(privPem);
  const signature = sign(null, data, privateKey); // ed25519
  return signature.toString("base64");
}

export function getPublicKeyPem() {
  if (!pubPem) throw new Error("Public key not set");
  createPublicKey(pubPem); // validate
  return pubPem;
}
