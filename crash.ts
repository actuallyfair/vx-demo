import {
  bytesToHex,
  concatBytes,
  randomBytes,
  utf8ToBytes,
} from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import {
  CommitmentContext,
  MessageContext,
  computeCrashResult,
} from "vx-verifier";

import { assert } from "tsafe";

const clientSeed = "chicken"; // Note: this is treated as ascii

async function main() {
  console.log("Running vx crash demo...");

  // First lets generate a hash chain
  const hashChainLength = 11;
  let iterator = randomBytes(32); // very secret!

  const hashChain: Uint8Array[] = [];
  for (let i = 0; i < hashChainLength; i++) {
    hashChain.push(iterator);
    iterator = sha256(iterator);
  }
  // We won't reverse the hash chain, as we'll iterate by poping off the last element

  const commitment = hashChain.pop();
  assert(commitment !== undefined);
  console.log(
    "Our hash chain has been established. The terminating hash is: ",
    bytesToHex(commitment)
  );

  const commitmentContext: CommitmentContext = { sha256Chain: {} };
  const VX_PUBKEY = await vx.make_commitment(commitment, commitmentContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    COMMITMENT := ${bytesToHex(commitment)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}
    Please see:  https://actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
      commitment
    )}
    `
  );

  let gameId = 0;
  let hash = commitment;
  assert(hash !== undefined);

  while (hashChain.length >= 1) {
    gameId++;

    const wager: MessageContext = {
      crash: {
        houseEdge: 0.0,
      },
    };

    const message = concatBytes(hash, utf8ToBytes(clientSeed));
    const vxSignature = await vx.make_message(
      commitment,
      message,
      gameId,
      0,
      wager
    );

    const verified = bls.verify(vxSignature, message, VX_PUBKEY);
    if (!verified) {
      throw new Error("huh?! vx gave us something that didn't verify");
    }

    // Now let's get the next hash for our game
    const h = hashChain.pop();
    assert(h !== undefined); // Hack to make TS happy
    hash = h;

    // Now let's compute the result of the game (note: how it uses the next games hash)
    const res = computeCrashResult(vxSignature, hash); // the multiplier is already floor'd to ~2 digits after the decimal
    console.log(`Game id ${gameId} = ${res}x `);
  }

  // There's really no point revealing, because each game reveals the previous anyway
  // but technically we probably should have a special reveal for after-the-last game
}

main();
