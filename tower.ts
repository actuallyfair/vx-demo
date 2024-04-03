import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils";
import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
import * as vx from "./vx";

import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { CommitmentContext, MessageContext, RevealContext } from "verifier";
import { assert } from "tsafe";
import { bytesToNumberBE } from "@noble/curves/abstract/utils";

async function main() {
  console.log("Running vx demo... (tower)");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const COMMITMENT = sha256(GS_SEED);

  const levels = 9;
  const choicesPerLevel = 4;
  const minesPerLevel = 1;

  const houseEdge = 0.01;

  const commitContext: CommitmentContext = { sha256Commitment: {} };
  const VX_PUBKEY = await vx.make_commitment(COMMITMENT, commitContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    COMMITMENT := ${bytesToHex(COMMITMENT)}
    VX_PUBKEY    := ${bytesToHex(VX_PUBKEY)}
    with ${levels} levels  with ${minesPerLevel} mines out of  ${choicesPerLevel} options`
  );

  const url = `https://actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
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
    const wager: MessageContext = {
      tower: {
        start: {
          houseEdge,
          amount,
          levels,
          choicesPerLevel,
          minesPerLevel,
        },
      },
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
      0,
      wager
    );
    const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
    assert(verified);
    balance -= amount.value;

    let picked = 0;

    while (true) {
      const res = await rl.question(
        `[${nonce}] Pick a number between 0 and ${
          choicesPerLevel - 1
        } or Cashout (C)?: `
      );

      if (res.toLowerCase() === "c") {
        const messageContext: MessageContext = {
          mines: {
            cashout: true,
          },
        };
        const gsContribution = hmac(
          sha256,
          GS_SEED,
          utf8ToBytes(`${playerSeed}:${nonce}:cashout`) // This is inside hmac, so we're not worried about anything like length extension attacks
        );

        const vxSignature = await vx.make_message(
          COMMITMENT,
          gsContribution,
          nonce,
          0,
          messageContext
        );
        const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
        assert(verified);

        console.log("You have been cashed out! ");
        // TODO: ..some deterministic algo to fill the rest of the board
        // TODO: figure out their winnings
      } else {
        const choice = Number.parseInt(res, 10);
        if (
          !Number.isSafeInteger(choice) ||
          choice < 0 ||
          choice >= choicesPerLevel
        ) {
          console.log("Unknown command or invalid");
          continue; // try again...
        }
        const messageContext: MessageContext = {
          tower: {
            move: {
              choice,
            },
          },
        };
        const gsContribution = hmac(
          sha256,
          GS_SEED,
          utf8ToBytes(`${playerSeed}:${nonce}:${choice}`) // This is inside hmac, so we're not worried about anything like length extension attacks
        );

        const vxSignature = await vx.make_message(
          COMMITMENT,
          gsContribution,
          nonce,
          0,
          messageContext
        );
        const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
        assert(verified);

        const normalized = Number(
          bytesToNumberBE(vxSignature) % BigInt(choice - picked)
        );

        if (normalized < minesPerLevel) {
          console.log("You hit a mine! Sorry!", normalized, picked);
          break;
        }
        picked++;
      }
    }

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
    }
  );
  console.log(
    `https://www.actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
      COMMITMENT
    )}`
  );

  // request input from console input
}

main();
