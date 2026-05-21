import type {
  AttachmentPayload,
  ConversationParticipant,
  MessageContent,
  ServerMessage
} from "./types";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let output = "";

  bytes.forEach((byte) => {
    output += String.fromCharCode(byte);
  });

  return btoa(output);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
};

const derivePasswordKey = async (password: string, saltBase64: string) => {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(fromBase64(saltBase64)),
      iterations: 250000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptPrivateKeyBuffer = async (privateKeyBuffer: ArrayBuffer, password: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePasswordKey(password, toBase64(salt.buffer));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    privateKeyBuffer
  );

  return {
    encryptedPrivateKey: toBase64(encrypted),
    privateKeySalt: toBase64(salt.buffer),
    privateKeyIv: toBase64(iv.buffer)
  };
};

export const generateEncryptedIdentity = async (password: string) => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = toBase64(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const encryptedBundle = await encryptPrivateKeyBuffer(privateKeyPkcs8, password);

  return {
    publicKey,
    privateKey: keyPair.privateKey,
    ...encryptedBundle
  };
};

export const unlockPrivateKey = async (
  encryptedPrivateKey: string,
  privateKeySalt: string,
  privateKeyIv: string,
  password: string
) => {
  try {
    const aesKey = await derivePasswordKey(password, privateKeySalt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(fromBase64(privateKeyIv)) },
      aesKey,
      fromBase64(encryptedPrivateKey)
    );

    return crypto.subtle.importKey(
      "pkcs8",
      decrypted,
      {
        name: "RSA-OAEP",
        hash: "SHA-256"
      },
      true,
      ["decrypt"]
    );
  } catch {
    throw new Error("Incorrect password. Please try again.");
  }
};

const importPublicKey = (value: string) =>
  crypto.subtle.importKey(
    "spki",
    fromBase64(value),
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    true,
    ["encrypt"]
  );

export const fingerprintKey = async (publicKey: string) => {
  const digest = await crypto.subtle.digest("SHA-256", fromBase64(publicKey));
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(":");
};

const normalizeAttachments = (attachments: AttachmentPayload[]) =>
  attachments.map(({ id, name, mimeType, size, dataUrl }) => ({
    id,
    name,
    mimeType,
    size,
    dataUrl
  }));

export const encryptMessageForConversation = async (
  content: MessageContent,
  recipients: ConversationParticipant[]
) => {
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const normalizedContent = {
    text: content.text,
    attachments: normalizeAttachments(content.attachments)
  };

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(JSON.stringify(normalizedContent))
  );

  const rawKey = await crypto.subtle.exportKey("raw", aesKey);

  const recipientKeys = await Promise.all(
    recipients.map(async (recipient) => {
      const publicKey = await importPublicKey(recipient.publicKey);
      const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey);

      return {
        userId: recipient.userId,
        wrappedKey: toBase64(wrappedKey),
        deliveredAt: null,
        readAt: null
      };
    })
  );

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv.buffer),
    algorithm: "AES-GCM",
    attachments: content.attachments.map(({ id, name, mimeType, size }) => ({
      id,
      name,
      mimeType,
      size
    })),
    recipientKeys
  };
};

export const decryptMessage = async (
  message: ServerMessage,
  privateKey: CryptoKey,
  currentUserId: string
) => {
  const matchingEnvelope = message.recipientKeys.find((item) => item.userId === currentUserId);

  if (!matchingEnvelope) {
    return {
      text: "",
      attachments: []
    } satisfies MessageContent;
  }

  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(matchingEnvelope.wrappedKey)
  );

  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(fromBase64(message.iv)) },
    aesKey,
    fromBase64(message.ciphertext)
  );

  return JSON.parse(decoder.decode(decrypted)) as MessageContent;
};

export const fileToAttachment = async (file: File): Promise<AttachmentPayload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        id: `${file.name}-${crypto.randomUUID()}`,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result)
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

