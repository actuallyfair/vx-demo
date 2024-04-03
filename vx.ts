import { bytesToHex } from "@noble/hashes/utils";
import * as pg from "pg";
import { assert } from "tsafe";
import { MessageContext, CommitmentContext, RevealContext } from "verifier";

// This really isn't a great example of how to use postgres. In reality want
// to use a persistent connection (or more likely a connection pool) and not just create a connection for every query.

const connectionString =
  "postgresql://demo_writer:verysecurepassword@vxdemo.actuallyfair.com/demo";

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

  const insertCommitmentsQuery =
    "INSERT INTO commitments(commitment, context) VALUES($1, $2) RETURNING id, vx_pubkey";

  const row = await queryOne(insertCommitmentsQuery, [
    commitment,
    contextBytes,
  ]);

  const vxPubkey = row.vx_pubkey as Uint8Array;

  console.log(
    `Vx: insert into commitments: https://actuallyfair.com/apps/demo/vx/commitments/${row.id}`
  );
  console.log(`VX_PUBKEY := 0x${bytesToHex(vxPubkey)}`);

  return vxPubkey;
}

export async function make_message(
  commitment: Uint8Array,
  message: Uint8Array,
  index: number,
  subIndex: number,
  context: MessageContext
) {
  const insertMessagesQuery = `INSERT INTO messages(commitment, message, index, sub_index, context) VALUES($1, $2, $3, $4, $5) RETURNING id, vx_signature`;

  const contextBytes = MessageContext.encode(context).finish();

  const row = await queryOne(insertMessagesQuery, [
    commitment,
    message,
    index,
    subIndex,
    contextBytes,
  ]);

  const vxSignature = row.vx_signature as Uint8Array;

  console.log(
    `Vx: insert into messages: https://actuallyfair.com/apps/demo/vx/messages/${row.id}`
  );
  console.log(`VX_SIGNATURE := 0x${bytesToHex(vxSignature)}`);

  return vxSignature;
}

export async function make_reveal(
  commitment: Uint8Array,
  reveal: Uint8Array,
  context: RevealContext
) {
  const insertRevealsQuery = `INSERT INTO reveals(commitment, reveal, context) VALUES($1, $2, $3) RETURNING id, vx_private_key`;

  const revealContext = RevealContext.encode(context).finish();

  const row = await queryOne(insertRevealsQuery, [
    commitment,
    reveal,
    revealContext,
  ]);

  const vxPrivateKey = row.vx_private_key as Uint8Array;

  console.log(
    `Vx: insert into reveals: https://actuallyfair.com/apps/demo/vx/reveals/${row.id}`
  );

  return vxPrivateKey;
}
