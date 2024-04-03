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
import { Currency } from "verifier/dist/generated/currency";

async function main() {
  console.log("Running vx demo... (mines)");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const commitment = sha256(GS_SEED);

  const mines = 1;
  const cellLineBreak = 2;
  const cells = 4;

  const commitContext: CommitmentContext = { sha256Commitment: {} };
  const VX_PUBKEY = await vx.make_commitment(commitment, commitContext);

  console.log(
    `We are going to play mines with ${mines} mines in a ${cells} cell grid`
  );

  console.log("--");

  // Allow the user to pick their own player seed by using console input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const playerSeed = await rl.question("Enter player Seed: ");
  let balance = 0;

  let index = 0;
  while (true) {
    const res = await rl.question(
      `[${index}] Do you want to bet (B) or Quit (Q): `
    );
    if (res.toLowerCase() === "q") {
      break;
    }
    if (res.toLowerCase() !== "b") {
      continue; // try again...
    }

    console.log("---");

    // ok we're betting

    const amount = { currency: Currency.BTC, value: 100 }; // 100 satoshi
    const wager: MessageContext = {
      mines: {
        start: {
          amount,
          cells,
          cellLineBreak,
          mines,
        },
      },
    };
    let subIndex = 0;

    const message = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${playerSeed}:${index}`) // We don't use the subIndex here, because it's zero
    );
    subIndex++;

    const vxSignature = await vx.make_message(
      commitment,
      message,
      index,
      subIndex,
      wager
    );
    const verified = bls.verify(vxSignature, message, VX_PUBKEY);
    assert(verified);
    balance -= amount.value;

    let revealedCells: Set<number> = new Set();

    while (true) {
      const res = await rl.question(
        `[${index}] Pick a number between 0 and ${cells - 1} or Cashout (C)?: `
      );

      const message = hmac(
        sha256,
        GS_SEED,
        utf8ToBytes(`${playerSeed}:${index}:${subIndex}`)
      );

      if (res.toLowerCase() === "c") {
        const messageContext: MessageContext = {
          mines: {
            cashout: true,
          },
        };
        const vxSignature = await vx.make_message(
          commitment,
          message,
          index,
          subIndex,
          messageContext
        );
        const verified = bls.verify(vxSignature, message, VX_PUBKEY);
        assert(verified);
        subIndex++;

        console.log("You have been cashed out! ");

        const mineLocations = getMineLocations(
          vxSignature,
          revealedCells,
          cells,
          mines
        );

        console.log("The rest of the mines were here: ", mineLocations);
        // TODO: ..some deterministic algo to fill the rest of the board
        // TODO: figure out their winnings
      } else {
        const pickedCell = Number.parseInt(res, 10);
        if (
          !Number.isSafeInteger(pickedCell) ||
          pickedCell < 0 ||
          pickedCell >= cells
        ) {
          console.log("Unknown command or invalid");
          continue; // try again...
        }
        const messageContext: MessageContext = {
          mines: {
            move: {
              cell: pickedCell,
            },
          },
        };
        const gsContribution = hmac(
          sha256,
          GS_SEED,
          utf8ToBytes(`${playerSeed}:${index}:${subIndex}`)
        );

        const vxSignature = await vx.make_message(
          commitment,
          gsContribution,
          index,
          subIndex,
          messageContext
        );
        const verified = bls.verify(vxSignature, gsContribution, VX_PUBKEY);
        assert(verified);

        subIndex++;

        const mineLocations = getMineLocations(
          vxSignature,
          revealedCells,
          cells,
          mines
        );

        if (mineLocations.has(pickedCell)) {
          console.log("oh no, you hit a mine. Sorry!");
          console.log("The cells with mines were: ", mineLocations);
          break;
        } else {
          console.log("phew, you are safe. ");
          revealedCells.add(pickedCell);
        }
      }
    }

    index++;
  }
  rl.close();

  const reveal: RevealContext = {
    standardDerivation: {
      playerSeed: playerSeed,
    },
  };
  await vx.make_reveal(commitment, GS_SEED, reveal);

  console.log(
    "Thanks for playing! ",
    balance,
    "\nJust to recap, the information you'll need to verify your games is: ",
    {
      GS_SEED: bytesToHex(GS_SEED),
      COMMITMENT: bytesToHex(commitment),
      VX_PUBKEY: bytesToHex(VX_PUBKEY),
      GAMES_PLAYED: index,
    }
  );
  console.log(
    `https://www.actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
      commitment
    )}`
  );

  // request input from console input
}

main();

function getMineLocations(
  vxSignature: Uint8Array,
  revealedCells: Set<number>, // tiles we know are safe
  cells: number, // how many cells in total
  mines: number // how many mines there are going to be in total
) {
  let mineLocations = new Set<number>();

  for (let m = 0; m < mines; m++) {
    const cellsLeft = cells - revealedCells.size - m;

    if (cellsLeft == 0) {
      console.warn(
        "hmm trying to get mine locations when there's no locations left?"
      );
      break;
    }

    let mineIndex = Number(bytesToNumberBE(vxSignature) % BigInt(cellsLeft));

    for (let i = 0; i < cells; i++) {
      if (revealedCells.has(i)) {
        mineIndex++;
        continue;
      }
      if (mineIndex == i) {
        mineLocations.add(i);
        break;
      }
    }
  }

  return mineLocations;
}
