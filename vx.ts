import * as pg from "pg";
import { assert } from "tsafe";
import { MessageContext, CommitmentContext, RevealContext } from "verifier";

// This really isn't a great example of how to use postgres. In reality want
// to use a persistent connection (or more likely a connection pool) and not just create a connection for every query.

const connectionString =
  "postgres://writer:verysecurepassword@34.145.37.118:5432/vx";

const pool = new pg.Pool({
  connectionString,
  allowExitOnIdle: true,
});

export async function queryOne(query: string, params: any[]) {
  const { rows } = await pool.query(query, params);
  assert(rows.length === 1);
  return rows[0];

  // Or doing it per client would be
  // const client = new pg.Client(connectionString);
  // await client.connect();
  // const { rows } = await client.query(query, params);
  // assert(rows.length === 1);
  // client.end();
  // return rows[0];
}

export async function make_commitment(
  commitment: Uint8Array,
  context: CommitmentContext
) {
  const contextBytes = CommitmentContext.encode(context).finish();
  // We could also use encode_commitment_context($2)
  const row = await queryOne("SELECT * FROM make_commitment($1, $2)", [
    commitment,
    contextBytes,
  ]);
  return row.vx_pubkey as Uint8Array;
}

export async function make_message(
  commitment: Uint8Array,
  message: Uint8Array,
  index: number,
  context: MessageContext
) {
  const contextBytes = MessageContext.encode(context).finish();

  const row = await queryOne("SELECT * FROM make_message($1, $2, $3, $4)", [
    commitment,
    message,
    index,
    contextBytes,
  ]);

  return row.vx_signature as Uint8Array;
}

export async function make_reveal(
  commitment: Uint8Array,
  reveal: Uint8Array,
  context: RevealContext
) {
  const revealContext = RevealContext.encode(context).finish();
  // We could also just do it from inside the db with encode_reveal_context
  // but we need to be a bit careful as it need to base64 for the uint8array
  const row = await queryOne("SELECT * FROM make_reveal($1, $2, $3)", [
    commitment,
    reveal,
    revealContext,
  ]);
}
