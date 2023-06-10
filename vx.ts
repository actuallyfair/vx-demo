import * as pg from "pg";
import { assert } from "tsafe";
import { MessageContext, CommitmentContext, RevealContext } from "verifier";

// This really isn't a great example of how to use postgres. In reality want
// to use a persistent connection (or more likely a connection pool) and not just create a connection for every query.

const connectionString =
  "postgres://logger:verysecurepassword@34.145.37.118:5432/vx";

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
  const row = await queryOne(
    "SELECT * FROM make_commitment($1, encode_commitment_context($2))",
    [commitment, context]
  );
  return row.pubkey as Uint8Array;
}

export async function make_message(
  commitment: Uint8Array,
  message: Uint8Array,
  context: MessageContext
) {
  // So there's two options. We need wager converted to bytes. Since we have protocolbuffers
  // lib we could simply do: Wager.encode(wager).finish();
  // That would be the recommended way, as it'd be easier to debug. But in case you don't have protobuff library,
  // or don't want to install it  you could also just use json and do it
  // from inside the db with encode_wager, which we will show
  const row = await queryOne(
    "SELECT * FROM make_message($1, $2, encode_message_context($3))",
    [commitment, message, context]
  );

  return row.signature as Uint8Array;
}

export async function make_reveal(
  commitment: Uint8Array,
  context: RevealContext
) {
  const revealContext = RevealContext.encode(context).finish();
  // We could also just do it from inside the db with encode_reveal_context
  // but we need to be a bit careful as it need to base64 for the uint8array
  const row = await queryOne("SELECT * FROM make_reveal($1, $2)", [
    commitment,
    revealContext,
  ]);
}
