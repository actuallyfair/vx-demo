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
} from "vx-verifier";
import { CrashDice } from "vx-verifier/dist/generated/message-contexts/crash-dice";
import { Currency } from "vx-verifier/dist/generated/currency";

const houseEdge = 0.01; // fixed

async function main() {
  console.log("Running vx demo [dice]");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const COMMITMENT = sha256(GS_SEED);
  const url = `https://actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
    COMMITMENT
  )}`;

  console.log("Hey Player! We've picked a commitment");
  console.log(`COMMITMENT := 0x${bytesToHex(COMMITMENT)}\n\n`);

  console.log("You should see all related API requests @ ", url, "\n\n");

  const commitContext: CommitmentContext = { sha256Commitment: {} };

  const VX_PUBKEY = await vx.make_commitment(COMMITMENT, commitContext);

  console.log("--");

  // Allow the user to pick their own player seed by using console input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const playerSeed = await rl.question("Enter player Seed: ");

  let balance = 0;
  let nonce = 0;
  while (true) {
    const res = await rl.question(
      `[${nonce}] Dice bet of 1 satoshi. What do you want to target? (0 to quit): `
    );
    const target = Number.parseFloat(res);
    if (!Number.isFinite(target) || target < 0) {
      continue; // try again...
    }
    if (res === "0") {
      break;
    }

    // ok we're betting

    const amount = { currency: Currency.BTC, value: 1 }; // this means 1 satoshi
    const crashDice: CrashDice = { amount, houseEdge, target };
    const wager: MessageContext = {
      crashDice,
    };

    const message = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${playerSeed}:${nonce}`) // This is inside hmac, so we're not worried about anything like length extension attacks
    );

    const vxSignature = await vx.make_message(
      COMMITMENT,
      message,
      nonce,
      0,
      wager
    );
    const verified = bls.verify(vxSignature, message, VX_PUBKEY);

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
    console.log("---");

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
    "\n---\nThanks for playing! Your final balance is",
    balance,
    "\nJust to recap, the information you'll need to verify your games is: ",
    {
      GS_SEED: bytesToHex(GS_SEED),
      COMMITMENT: bytesToHex(COMMITMENT),
      VX_PUBKEY: bytesToHex(VX_PUBKEY),
      PLAYER_SEED: playerSeed,
      GAMES_PLAYED: nonce,
    },
    url
  );

  // request input from console input
}

main();
