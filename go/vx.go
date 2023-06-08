package main

import (
	"context"

	"github.com/jackc/pgx/v4/pgxpool"
)

func vx_make_commitment(pool *pgxpool.Pool, gsSeedHash []byte) []byte {
	// const row = await queryOne("SELECT * FROM make_commitment($1)", [gsSeedHash]);
	// return row.vx_pubkey as Uint8Array;

	var vxPubKey []byte
	err := pool.QueryRow(context.Background(), "SELECT vx_pubkey FROM make_commitment($1)", gsSeedHash).Scan(&vxPubKey)
	if err != nil {
		panic(err)
	}

	return vxPubKey
}

func vx_make_wager(pool *pgxpool.Pool, gsSeedHash []byte, gsContribution []byte, gameId int) []byte {
	// const row = await queryOne("SELECT * FROM make_commitment($1)", [gsSeedHash]);
	// return row.vx_pubkey as Uint8Array;

	var vxSignature []byte
	err := pool.QueryRow(context.Background(), `SELECT vx_signature FROM make_wager(
		$1,
		$2,
		encode_wager(json_build_object('vhempCrash',
											json_build_object('game_id', $3::int)
								 ))
	 );`, gsSeedHash, gsContribution, gameId).Scan(&vxSignature)
	if err != nil {
		panic(err)
	}

	return vxSignature
}
