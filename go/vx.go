package main

import (
	"context"

	"github.com/jackc/pgx/v4/pgxpool"
)

func vx_make_commitment(pool *pgxpool.Pool, commitment []byte) []byte {

	// hardcoded to a sha256 hash chain commitment for now

	const commitmentContext = `{ "sha256Chain": {} }`

	var vxPubKey []byte
	err := pool.QueryRow(context.Background(), `SELECT pubkey FROM make_commitment($1, encode_commitment_context($2))`, commitment, commitmentContext).Scan(&vxPubKey)
	if err != nil {
		panic(err)
	}

	return vxPubKey
}

func vx_make_message(pool *pgxpool.Pool, commitment []byte, message []byte, gameId int) []byte {
	// const row = await queryOne("SELECT * FROM make_commitment($1)", [gsSeedHash]);
	// return row.vx_pubkey as Uint8Array;

	messageContext := `{ "vhempCrash": {} }`

	var vxSignature []byte
	err := pool.QueryRow(context.Background(), `SELECT signature FROM make_message(
		$1,
		$2,
		$3,
		encode_message_context($4))`, commitment, message, gameId, messageContext).Scan(&vxSignature)
	if err != nil {
		panic(err)
	}

	return vxSignature
}
