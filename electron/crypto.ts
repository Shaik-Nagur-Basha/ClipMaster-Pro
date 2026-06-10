import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { safeStorage } from "electron";
import * as fs from "fs";
import * as path from "path";
import { getDataDir } from "./storage";

let machineKeyCached: Buffer | null = null;

export function getMachineKey(): Buffer {
  if (machineKeyCached) return machineKeyCached;

  if (process.env.CLIPMASTER_SECRET) {
    machineKeyCached = scryptSync(
      process.env.CLIPMASTER_SECRET,
      "clipmaster-salt-v2",
      32,
    );
    return machineKeyCached;
  }

  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const keyPath = path.join(dataDir, "key.enc");

  if (safeStorage.isEncryptionAvailable()) {
    if (fs.existsSync(keyPath)) {
      try {
        const encryptedKey = fs.readFileSync(keyPath);
        const decryptedString = safeStorage.decryptString(encryptedKey);
        machineKeyCached = Buffer.from(decryptedString, "base64");
        return machineKeyCached;
      } catch (err) {
        console.error("[Crypto] Failed to decrypt saved machine key. Generating a new one...", err);
      }
    }

    const newKeyBytes = randomBytes(32);
    try {
      const encryptedKey = safeStorage.encryptString(newKeyBytes.toString("base64"));
      fs.writeFileSync(keyPath, encryptedKey);
      machineKeyCached = newKeyBytes;
      return machineKeyCached;
    } catch (err) {
      console.error("[Crypto] Failed to encrypt and save machine key:", err);
    }
  }

  // Fallback to plaintext key file
  const fallbackKeyPath = path.join(dataDir, "key.txt");
  if (fs.existsSync(fallbackKeyPath)) {
    try {
      const hexKey = fs.readFileSync(fallbackKeyPath, "utf-8").trim();
      machineKeyCached = Buffer.from(hexKey, "hex");
      return machineKeyCached;
    } catch (err) {
      console.error("[Crypto] Failed to read fallback machine key:", err);
    }
  }

  const fallbackKey = randomBytes(32);
  try {
    fs.writeFileSync(fallbackKeyPath, fallbackKey.toString("hex"), {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch (err) {
    console.error("[Crypto] Failed to save fallback machine key:", err);
  }
  machineKeyCached = fallbackKey;
  return machineKeyCached;
}

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", getMachineKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf-8"),
    cipher.final(),
  ]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(data: string): string {
  try {
    const [ivHex, encHex] = data.split(":");
    if (!ivHex || !encHex) return data;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", getMachineKey(), iv);
    return Buffer.concat([
      decipher.update(Buffer.from(encHex, "hex")),
      decipher.final(),
    ]).toString("utf-8");
  } catch {
    return data;
  }
}
