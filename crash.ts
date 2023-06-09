import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import { Wager, computeVhempCrashResult } from "verifier";

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

  const GS_SEED_HASH = hashChain[0];
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
  while (hashChain.length > 1) {
    gameId++;

    const wager: Wager = {
      vhempCrash: {
        gameId,
      },
    };

    const vxSignature = await vx.make_wager(GS_SEED_HASH, hashChain[0], wager);

    const verified = bls.verify(vxSignature, hashChain[0], VX_PUBKEY);
    if (!verified) {
      throw new Error("huh?! vx gave us something that didn't verify");
    }

    const hash = hashChain.pop();
    assert(hash);

    const res = computeVhempCrashResult(vxSignature, hash);
    console.log(`Game id ${gameId} = ${res.toFixed(2)}x `);

    // There's really no point revealing, because each game reveals the previous anyway
    // but technically we probably should have a special reveal for after-the-last game
  }

  // request input from console input
}

main();
