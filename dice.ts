import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  CommitmentContext,
  MessageContext,
  RevealContext,
  computeCrashDiceResult,
} from "verifier";
import { assert } from "tsafe";
import { CrashDice } from "verifier/dist/generated/message-contexts/crash-dice";

const houseEdge = 0.01; // fixed
const playerBalance = 0;

async function main() {
  console.log("Running vx demo...");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const COMMITMENT = sha256(GS_SEED);

  const commitContext: CommitmentContext = { sha256Commitment: {} };
  const VX_PUBKEY = await vx.make_commitment(COMMITMENT, commitContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    COMMITMENT := ${bytesToHex(COMMITMENT)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}`
  );

  const url = `https://provablyhonest.com/apps/demo/vx/summary/${bytesToHex(
    COMMITMENT
  )}`;
  console.log(
    `Normally we'd show it to a player as single value (by either hashing them together, or concat'ing them) to make it easier to copy&paste, but you seem pretty technical`
  );
  console.log(url);

  console.log("--");

  // Allow the user to pick their own player seed by using console input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const playerSeed = await rl.question("Enter player Seed: ");

  console.log("Client seed is: ", playerSeed);

  let balance = 0;
  let nonce = 0;
  while (true) {
    const res = await rl.question(
      `[${nonce}] What do you want to target? (0 to quit): `
    );
    const target = Number.parseFloat(res);
    if (!Number.isFinite(target) || target < 0) {
      continue; // try again...
    }
    if (res === "0") {
      break;
    }

    console.log("---");

    // ok we're betting

    const amount = { currency: 0, value: 1 };
    const crashDice: CrashDice = { amount, houseEdge, target };
    const wager: MessageContext = {
      crashDice,
    };

    const gsContribution = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${playerSeed}:${nonce}`) // This is inside hmac, so we're not worried about anything like length extension attacks
    );

    const vxSignature = await vx.make_message(
      COMMITMENT,
      gsContribution,
      nonce,
      wager
    );
    const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);

    const crashResult = computeCrashDiceResult(vxSignature, 0.01);
    balance -= 1; // User pays this to bet
    if (target <= crashResult) {
      balance += target;
    }

    console.log(
      "Game result: ",
      crashResult,
      "which means you",
      target <= crashResult ? "WON" : "LOST",
      "and your new balance is ",
      balance,
      " verified=",
      verified
    );

    nonce++;
  }
  rl.close();

  const reveal: RevealContext = {
    standardDerivation: {
      playerSeed: playerSeed,
    },
  };
  await vx.make_reveal(COMMITMENT, GS_SEED, reveal);

  console.log(
    "Thanks for playing! ",
    balance,
    "\nJust to recap, the information you'll need to verify your games is: ",
    {
      GS_SEED: bytesToHex(GS_SEED),
      GS_SEED_HASH: bytesToHex(COMMITMENT),
      VX_PUBKEY: bytesToHex(VX_PUBKEY),
      GAMES_PLAYED: nonce,
    },
    url
  );

  // request input from console input
}

main();
