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
  FairCoinToss,
  FairCoinToss_Choice,
  fairCoinToss_ChoiceToJSON,
  computeFairCoinTossOutcome,
} from "vx-verifier";

async function main() {
  console.log("Running vx demo...");

  // Let's generate a random seed
  const GS_SEED = randomBytes(32); // very secret!
  const GS_SEED_HASH = sha256(GS_SEED);

  const commitContext: CommitmentContext = { sha256Commitment: {} };
  const VX_PUBKEY = await vx.make_commitment(GS_SEED_HASH, commitContext);

  console.log(
    `Hey Player! We're ready to go with the following values: 
    GS_SEED_HASH := ${bytesToHex(GS_SEED_HASH)}
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
    console.log("---");
    const res = await rl.question(
      `[${nonce}] Guess Heads (H) or Tails (T) or Quit (Q): `
    );
    if (res.toLowerCase() === "q") {
      break;
    }
    let playerChoice: FairCoinToss_Choice;
    if (res.toLowerCase() === "h") {
      playerChoice = FairCoinToss_Choice.HEADS;
    } else if (res.toLowerCase() === "t") {
      playerChoice = FairCoinToss_Choice.TAILS;
    } else {
      console.log("Invalid guess, try again");
      continue;
    }
    // Ok, so now we know what the player wants to guess, let's figure out the outcome!

    const GS_CONTRIBUTION = hmac(
      sha256,
      GS_SEED,
      utf8ToBytes(`${playerSeed}:${nonce}`) // This is inside hmac, so we're not worried about anything like length extension attacks
    );
    const coinTossWager: FairCoinToss = {
      playerChoice,
    };
    const wager: MessageContext = {
      fairCoinToss: coinTossWager,
    };

    const VX_SIGNATURE = await vx.make_message(
      GS_SEED_HASH,
      GS_CONTRIBUTION,
      nonce,
      wager
    );

    // Now as the game-server we need to make sure that Vx isn't cheating us or something
    // We can do this by verifying the signature.

    // This is actually pretty slow in js (but fine in native ), so you might want to verify in the background or in batches?
    const verified = bls.verify(VX_SIGNATURE, GS_CONTRIBUTION, VX_PUBKEY);

    const outcome = computeFairCoinTossOutcome(VX_SIGNATURE, coinTossWager);

    balance += outcome.playerProfit.amount;

    console.log(
      "Outcome: ",
      fairCoinToss_ChoiceToJSON(outcome.result),
      " (verified =",
      verified,
      ") Your new balance is =",
      balance
    );

    // console.log(
    //   `Players don't really need to see this, but doesn't hurt either:
    // VX_SIGNATURE :=`,
    //   bytesToHex(VX_SIGNATURE)
    // );

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
    "Thanks for playing! Your final balance is: ",
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
