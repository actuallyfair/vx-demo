import * as pg from "pg";
import { assert } from "tsafe";
import { DemoFairCoinToss } from "verifier/dist/wagers/demo_fair_coin_toss";
import { bytesToHex } from "@noble/hashes/utils";

// This really isn't a great example of how to use postgres. In reality want
// to use a persistent connection (or more likely a connection pool) and not just create a connection for every query.

const connectionString =
  "postgres://logger:verysecurepassword@34.145.37.118:5432/postgres";

const pool = new pg.Pool({
  connectionString,
});

export async function queryOne(query: string, params: any[]) {
  const { rows } = await pool.query(query, params);
  assert(rows.length === 1);
  return rows[0];
}

export async function make_pubkey(gsSeedHash: Uint8Array) {
  const row = await queryOne("SELECT * FROM make_pubkey($1)", [gsSeedHash]);
  return row.vx_pubkey as Uint8Array;
}

export async function make_wager(
  gsSeedHash: Uint8Array,
  gsContribution: Uint8Array,
  wager: DemoFairCoinToss
) {
  const wagerBytes = DemoFairCoinToss.encode(wager).finish();

  const row = await queryOne("SELECT * FROM make_wager($1, $2, $3)", [
    gsSeedHash,
    gsContribution,
    wagerBytes,
  ]);

  return row.vx_signature as Uint8Array;
}
