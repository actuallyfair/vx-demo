import * as pg from "pg";
import { assert } from "tsafe";
import { DemoFairCoinToss } from "verifier/dist/wagers/demo_fair_coin_toss";
import { bytesToHex } from "@noble/hashes/utils";
import { Wager } from "verifier/dist/wagers";
import { Reveal } from "verifier/dist/reveals";

// This really isn't a great example of how to use postgres. In reality want
// to use a persistent connection (or more likely a connection pool) and not just create a connection for every query.

const connectionString =
  "postgres://logger:verysecurepassword@34.145.37.118:5432/postgres";

const pool = new pg.Pool({
  connectionString,
  allowExitOnIdle: true,
});

export async function queryOne(query: string, params: any[]) {
  const { rows } = await pool.query(query, params);
  assert(rows.length === 1);
  return rows[0];
}

export async function make_commitment(gsSeedHash: Uint8Array) {
  const row = await queryOne("SELECT * FROM make_commitment($1)", [gsSeedHash]);
  return row.vx_pubkey as Uint8Array;
}

export async function make_wager(
  gsSeedHash: Uint8Array,
  gsContribution: Uint8Array,
  wager: Wager
) {
  const wagerBytes = Wager.encode(wager).finish();

  const row = await queryOne("SELECT * FROM make_wager($1, $2, $3)", [
    gsSeedHash,
    gsContribution,
    wagerBytes,
  ]);

  return row.vx_signature as Uint8Array;
}

export async function make_reveal(
  gsSeedHash: Uint8Array,
  gsSeed: Uint8Array,
  reveal: Reveal
) {
  const revealBytes = Reveal.encode(reveal).finish();

  const row = await queryOne("SELECT * FROM make_reveal($1, $2, $3)", [
    gsSeedHash,
    gsSeed,
    revealBytes,
  ]);
}
