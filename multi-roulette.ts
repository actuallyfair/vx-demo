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
  computeMultiRouletteResult,
} from "verifier";

import { assert } from "tsafe";
import { MultiRoulette_Outcome } from "verifier/dist/generated/message-contexts/multi-roulette";
import { Currency } from "verifier/dist/generated/currency";

const clientSeed = "chicken"; // Note: this is treated as ascii, should be found via a seeding event

async function main() {
  console.log("Running vx multi-roulette demo...");

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

  console.log(`COMMITMENT := 0x${bytesToHex(commitment)}\n\n`);
  const url = `https://actuallyfair.com/apps/demo/vx/summary/${bytesToHex(
    commitment
  )}`;
  console.log("You should see all related API requests @ ", url, "\n\n");

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
  let hash: Uint8Array;

  while (hashChain.length >= 1) {
    // Now let's get the next hash for our game
    const h = hashChain.pop();
    assert(h !== undefined); // Hack to make TS happy
    hash = h;

    gameId++;

    const red: MultiRoulette_Outcome = {
      probability: 0.495,
      multiplier: 2,
      bets: [
        // all the red players go here...
        { uname: "RedMaster", amount: { value: 23, currency: Currency.BTC } },
        { uname: "BloodBath", amount: { value: 13, currency: Currency.BTC } },
      ],
    };
    const green: MultiRoulette_Outcome = {
      probability: 0.495,
      multiplier: 2,
      bets: [
        // all the players betting blue should be here
        { uname: "BlueDevil", amount: { value: 1, currency: Currency.TBTC } },
      ],
    };
    const bonus: MultiRoulette_Outcome = {
      probability: 0.01,
      multiplier: 99,
      bets: [
        // all the players betting bonus should be here
        {
          uname: "BonusHunter",
          amount: { value: 14, currency: Currency.ETH },
        },
      ],
    };

    const wager = {
      multiRoulette: {
        outcomes: [red, green, bonus],
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

    // Now let's compute the result of the game
    const res = computeMultiRouletteResult(vxSignature, wager.multiRoulette);
    let outcomeName;
    if (res == 0) {
      outcomeName = "red";
    } else if (res == 1) {
      outcomeName = "green";
    } else if (res == 2) {
      outcomeName = "bonus";
    } else {
      throw new Error("unknown roulette outcome?!");
    }
    console.log(`Game id ${gameId} = ${outcomeName}`);
  }

  // There's really no point revealing, but after all done we can... (Todo:...)
}

main();
