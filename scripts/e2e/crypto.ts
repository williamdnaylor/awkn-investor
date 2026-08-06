/**
 * A software TOTP generator and a software WebAuthn authenticator.
 *
 * The point is to exercise the real endpoints with real cryptography rather
 * than stubbing them: the server verifies these signatures the same way it
 * verifies a YubiKey's. No browser, no virtual-authenticator harness.
 */
import {
  createHmac,
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
  type KeyObject,
} from "node:crypto";

/* ------------------------------------------------------------------ base64 */

export const b64u = {
  encode: (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url"),
  decode: (s: string) => Buffer.from(s, "base64url"),
};

/* -------------------------------------------------------------------- TOTP */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error(`Bad base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238, the defaults Better Auth's twoFactor plugin uses: SHA-1, 30s, 6. */
export function totp(secretBase32: string, atSeconds = Date.now() / 1000): string {
  const counter = Math.floor(atSeconds / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(secretBase32)).update(buf).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function secretFromOtpUri(uri: string): string {
  const secret = new URL(uri.replace(/^otpauth:\/\//, "https://")).searchParams.get(
    "secret"
  );
  if (!secret) throw new Error(`No secret in otpauth URI`);
  return secret;
}

/* -------------------------------------------------------------------- CBOR */

function cborUint(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 0x100) return Buffer.from([(major << 5) | 24, n]);
  if (n < 0x10000) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(n, 1);
  return b;
}

/**
 * Written as an interface rather than a plain recursive alias: a type alias
 * that references itself through `Map`/`Record` is a circular reference to the
 * checker, whereas an interface is resolved lazily.
 */
interface CborMap extends Map<Cbor, Cbor> {}
interface CborRecord {
  [key: string]: Cbor;
}
type Cbor = number | string | Buffer | CborMap | CborRecord;

function cbor(value: Cbor): Buffer {
  if (typeof value === "number") {
    return value >= 0 ? cborUint(0, value) : cborUint(1, -value - 1);
  }
  if (typeof value === "string") {
    const b = Buffer.from(value, "utf8");
    return Buffer.concat([cborUint(3, b.length), b]);
  }
  if (Buffer.isBuffer(value)) {
    return Buffer.concat([cborUint(2, value.length), value]);
  }
  const entries: Array<[Cbor, Cbor]> =
    value instanceof Map ? [...value] : Object.entries(value);
  return Buffer.concat([
    cborUint(5, entries.length),
    ...entries.flatMap(([k, v]) => [cbor(k), cbor(v)]),
  ]);
}

/* ------------------------------------------------------------- authenticator */

const FLAG_UP = 0x01; // user present
const FLAG_UV = 0x04; // user verified
const FLAG_AT = 0x40; // attested credential data included

export class SoftAuthenticator {
  readonly credentialId: Buffer;
  private privateKey: KeyObject;
  private cose: Buffer;
  private signCount = 0;

  constructor(readonly rpId: string, readonly origin: string) {
    this.credentialId = randomBytes(32);
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    this.privateKey = privateKey;

    const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
    // COSE_Key for ES256: kty=EC2(2), alg=ES256(-7), crv=P-256(1), x, y.
    this.cose = cbor(
      new Map<Cbor, Cbor>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, b64u.decode(jwk.x)],
        [-3, b64u.decode(jwk.y)],
      ])
    );
  }

  private authData(flags: number, withCredential: boolean): Buffer {
    const rpIdHash = createHash("sha256").update(this.rpId).digest();
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(++this.signCount);
    if (!withCredential) {
      return Buffer.concat([rpIdHash, Buffer.from([flags]), counter]);
    }
    const credLen = Buffer.alloc(2);
    credLen.writeUInt16BE(this.credentialId.length);
    return Buffer.concat([
      rpIdHash,
      Buffer.from([flags]),
      counter,
      Buffer.alloc(16), // AAGUID — all-zero is what a platform authenticator reports
      credLen,
      this.credentialId,
      this.cose,
    ]);
  }

  private clientData(type: "webauthn.create" | "webauthn.get", challenge: string) {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: this.origin, crossOrigin: false }),
      "utf8"
    );
  }

  /** SimpleWebAuthn's RegistrationResponseJSON, "none" attestation. */
  register(challenge: string) {
    const clientDataJSON = this.clientData("webauthn.create", challenge);
    const authData = this.authData(FLAG_UP | FLAG_UV | FLAG_AT, true);
    const attestationObject = cbor({
      fmt: "none",
      attStmt: {},
      authData,
    } as unknown as Record<string, Cbor>);

    const id = b64u.encode(this.credentialId);
    return {
      id,
      rawId: id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u.encode(clientDataJSON),
        attestationObject: b64u.encode(attestationObject),
        transports: ["internal"],
      },
    };
  }

  /** SimpleWebAuthn's AuthenticationResponseJSON. */
  authenticate(challenge: string) {
    const clientDataJSON = this.clientData("webauthn.get", challenge);
    const authData = this.authData(FLAG_UP | FLAG_UV, false);
    const signed = Buffer.concat([
      authData,
      createHash("sha256").update(clientDataJSON).digest(),
    ]);
    const signature = createSign("sha256").update(signed).sign(this.privateKey);

    const id = b64u.encode(this.credentialId);
    return {
      id,
      rawId: id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u.encode(clientDataJSON),
        authenticatorData: b64u.encode(authData),
        signature: b64u.encode(signature),
        userHandle: null,
      },
    };
  }
}
