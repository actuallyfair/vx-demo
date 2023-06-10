import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import {
  CommitmentContext,
  MessageContext,
  computeVhempCrashResult,
} from "verifier";

import { assert } from "tsafe";

async function main() {
  console.log("Running vx crash demo...");

  // First lets generate a hash chain
  const hashChainLength = 12;
  let iterator = randomBytes(32); // very secret!

  const hashChain: Uint8Array[] = [];
  for (let i = 0; i < hashChainLength; i++) {
    hashChain.push(iterator);
    iterator = sha256(iterator);
  }
  // We won't reverse the hash chain, as we'll iterate by poping off the last element

  const GS_SEED_HASH = hashChain.pop();
  assert(GS_SEED_HASH !== undefined);
  console.log(
    "Our hash chain has been established. The terminating hash is: ",
    bytesToHex(GS_SEED_HASH)
  );

  const commitmentContext: CommitmentContext = { sha256Chain: {} };
  const VX_PUBKEY = await vx.make_commitment(GS_SEED_HASH, commitmentContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    GS_SEED_HASH := ${bytesToHex(GS_SEED_HASH)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}`
  );

  let gameId = 0;
  let hash = hashChain.pop();
  assert(hash !== undefined);

  while (hashChain.length >= 1) {
    gameId++;
    assert(hash !== undefined);

    const wager: MessageContext = {
      vhempCrash: {
        gameId,
      },
    };

    const vxSignature = await vx.make_message(GS_SEED_HASH, hash, wager);

    const verified = bls.verify(vxSignature, hash, VX_PUBKEY);
    if (!verified) {
      throw new Error("huh?! vx gave us something that didn't verify");
    }

    // Now let's get the next hash for our game
    hash = hashChain.pop();
    assert(hash !== undefined);

    const res = computeVhempCrashResult(vxSignature, hash);
    console.log(`Game id ${gameId} = ${res.toFixed(2)}x `);
  }

  // There's really no point revealing, because each game reveals the previous anyway
  // but technically we probably should have a special reveal for after-the-last game
}

main();
