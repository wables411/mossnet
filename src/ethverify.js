// The only crypto the save endpoint needs: recover the Ethereum address that signed a
// personal_sign message. Bundled into functions/_lib/ethverify.js by `npm run build:verify`
// so the Pages Function stays import-free and needs no install at deploy time.
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

const hex = (b) => '0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function bytes(h) {
  h = h.startsWith('0x') ? h.slice(2) : h;
  if (h.length % 2) throw new Error('odd-length hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    const b = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(b)) throw new Error('bad hex');
    out[i] = b;
  }
  return out;
}

// EIP-191: "\x19Ethereum Signed Message:\n" + length + message, then keccak
function personalHash(message) {
  const msg = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  const all = new Uint8Array(prefix.length + msg.length);
  all.set(prefix, 0);
  all.set(msg, prefix.length);
  return keccak_256(all);
}

// EIP-55 checksummed address from a 64-byte uncompressed public key
function addressOf(pubkey) {
  const raw = Array.from(keccak_256(pubkey.slice(1)).slice(-20), (x) => x.toString(16).padStart(2, '0')).join('');
  const sum = Array.from(keccak_256(new TextEncoder().encode(raw)), (x) => x.toString(16).padStart(2, '0')).join('');
  let out = '0x';
  for (let i = 0; i < raw.length; i++) out += parseInt(sum[i], 16) >= 8 ? raw[i].toUpperCase() : raw[i];
  return out;
}

/** Recover the signer of a personal_sign signature, or null if the signature is malformed. */
export function recoverPersonalSigner(message, signature) {
  try {
    const sig = bytes(signature);
    if (sig.length !== 65) return null;
    let v = sig[64];
    if (v >= 27) v -= 27;                       // wallets send 27/28, some send 0/1
    if (v !== 0 && v !== 1) return null;
    const s = secp256k1.Signature.fromCompact(sig.slice(0, 64)).addRecoveryBit(v);
    const pub = s.recoverPublicKey(personalHash(message)).toRawBytes(false);
    return addressOf(pub);
  } catch (_) {
    return null;                                 // a bad signature is an answer, not an exception
  }
}

export { hex, bytes, personalHash };
