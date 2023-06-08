import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import { Wager } from "verifier";

import { assert } from "tsafe";

async function main() {
  console.log("Running vx crash demo...");

  // First lets generate a hash chain
  const hashChainLength = 10;
  let iterator = randomBytes(32); // very secret!

  const hashChain: Uint8Array[] = [];
  for (let i = 0; i < hashChainLength; i++) {
    hashChain.push(iterator);
    iterator = sha256(iterator);
  }
  hashChain.reverse();

  const GS_SEED_HASH = hashChain.pop();
  assert(GS_SEED_HASH !== undefined);
  console.log(
    "Our hash chain has been established. The terminating hash is: ",
    bytesToHex(GS_SEED_HASH)
  );

  const VX_PUBKEY = await vx.make_commitment(GS_SEED_HASH);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    GS_SEED_HASH := ${bytesToHex(GS_SEED_HASH)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}`
  );

  let gameId = 0;
  while (hashChain.length > 0) {
    gameId++;
    const hash = hashChain.pop();
    assert(hash !== undefined);

    const wager: Wager = {
      vhempCrash: {
        gameId,
      },
    };

    const vxSignature = await vx.make_wager(GS_SEED_HASH, hash, wager);

    const verified = bls.verify(vxSignature, hash, VX_PUBKEY);

    // Now we need to derive a result from the vxSignature. Doing it
    // in a bustabit style would be something like:
    const vxSignatureHash = sha256(vxSignature);
    const nBits = 52;
    const n = bytesToHex(vxSignatureHash).slice(0, nBits / 4);
    const r = Number.parseInt(n, 16);
    const X = r / 2 ** nBits; // uniform distribution between 0 and 1

    console.log(
      `Game id ${gameId} = ${(1 / X).toFixed(2)}x verified=${verified}`
    );

    // There's really no point revealing, because each game reveals the previous anyway
    // but technically we probably should have a special reveal for after-the-last game
  }

  // request input from console input
}

main();
