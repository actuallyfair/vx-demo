import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  CommitmentContext,
  HiLoMove,
  HiLoMove_Choice,
  HiLoStart,
  MessageContext,
  RevealContext,
} from "vx-verifier";
import { HiLo } from "vx-verifier";
import { assert } from "tsafe";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";

async function main() {
  console.log("Running vx demo...");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const GS_SEED_HASH = sha256(GS_SEED);

  const commitContext: CommitmentContext = { sha256Commitment: {} };
  const VX_PUBKEY = await vx.make_commitment(GS_SEED_HASH, commitContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    COMMITMENT := ${bytesToHex(GS_SEED_HASH)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}`
  );

  console.log(
    `Normally we'd show it to a player as single value (by either hashing them together, or concat'ing them) to make it easier to copy&paste, but you seem pretty technical`
  );

  console.log("--");

  // Allow the user to pick their own player seed by using console input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const playerSeed = await rl.question("Enter player Seed: ");

  console.log("Client seed is: ", playerSeed);

  let balance = 0;
  let nonce = 0;
  while (true) {
    // The starting card is arbitrary, can be 1 (ace) to 13 (king)
    const startingCard = Math.ceil(Math.random() * 13);
    assert(startingCard >= 1 && startingCard <= 13);
    console.log(`[${nonce}: The starting card is:  ${startingCard}`);

    const res = await rl.question(
      `[${nonce}] Do you want to bet (B) or Quit (Q): `
    );
    if (res.toLowerCase() === "q") {
      break;
    }
    if (res.toLowerCase() !== "b") {
      continue; // try again...
    }

    console.log("---");

    // ok we're betting

    const amount = { currency: 0, value: 1 };
    const start: HiLoStart = { amount, startingCard };
    const hiloContext: HiLo = { start };
    const wager: MessageContext = {
      hilo: hiloContext,
    };

    let moveIndex = 0;

    const gsContribution = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${playerSeed}:${nonce}:${moveIndex}`) // This is inside hmac, so we're not worried about anything like length extension attacks
    );

    const vxSignature = await vx.make_message(
      GS_SEED_HASH,
      gsContribution,
      nonce,
      wager
    );
    const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
    assert(verified);

    while (true) {
      moveIndex++;
      const res = await rl.question(
        `[${nonce}] Do you want to go Hi (H) or Lo (L) or Cashout (C)?: `
      );

      let playerChoice;

      if (res.toLowerCase() === "c") {
        playerChoice = HiLoMove_Choice.Cashout;
      } else if (res.toLowerCase() !== "h") {
        playerChoice = HiLoMove_Choice.Hi;
      } else if (res.toLowerCase() !== "l") {
        playerChoice = HiLoMove_Choice.Lo;
      } else {
        continue; // try again...
      }
      const move: HiLoMove = {
        moveIndex,
        playerChoice,
      };
      const messageContext: MessageContext = {
        hilo: {
          move,
        },
      };

      const gsContribution = hmac(
        sha256,
        GS_SEED,
        utf8ToBytes(`${playerSeed}:${nonce}:${moveIndex}`) // This is inside hmac, so we're not worried about anything like length extension attacks
      );

      const vxSignature = await vx.make_message(
        GS_SEED_HASH,
        gsContribution,
        nonce,
        messageContext
      );
      const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
      assert(verified);

      if (playerChoice === HiLoMove_Choice.Cashout) {
        break;
      }

      const nextCard = Number(bytesToNumberBE(vxSignature) % 13n) + 1; // TODO:..
      console.log("The next card is ", nextCard);
    }

    nonce++;
  }
  rl.close();

  const reveal: RevealContext = {
    standardDerivation: {
      playerSeed: playerSeed,
    },
  };
  await vx.make_reveal(GS_SEED_HASH, GS_SEED, reveal);

  console.log(
    "Thanks for playing! ",
    balance,
    "\nJust to recap, the information you'll need to verify your games is: ",
    {
      GS_SEED: bytesToHex(GS_SEED),
      GS_SEED_HASH: bytesToHex(GS_SEED_HASH),
      VX_PUBKEY: bytesToHex(VX_PUBKEY),
      GAMES_PLAYED: nonce,
    }
  );

  // request input from console input
}

main();
