import type { TicketProfile } from "@ticket-radar/shared";

export type EncryptedEnvelope = {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};
export const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const decode = (value: string) =>
  Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const asBuffer = (value: Uint8Array) =>
  value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;

async function deriveKey(pin: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: asBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptProfile(
  profile: TicketProfile,
  pin: string,
): Promise<EncryptedEnvelope> {
  if (pin.length < 6) throw new Error("PIN 至少需要 6 碼。");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBuffer(iv) },
    key,
    encoder.encode(JSON.stringify(profile)),
  );
  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: encode(salt),
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
    createdAt: new Date().toISOString(),
  };
}
export async function decryptProfile(
  envelope: EncryptedEnvelope,
  pin: string,
): Promise<TicketProfile> {
  const key = await deriveKey(pin, decode(envelope.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(decode(envelope.iv)) },
    key,
    asBuffer(decode(envelope.ciphertext)),
  );
  return JSON.parse(decoder.decode(plaintext)) as TicketProfile;
}
