package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"math/big"
	"math/rand"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
)

func main() {

	// Generate a hash chain
	startingSeed := make([]byte, 32)

	rand.Seed(time.Now().UnixNano())
	_, err := rand.Read(startingSeed)
	if err != nil {
		panic(err)
	}

	hashChain := make([][]byte, 0)

	// Loop 10 times hashing the previous hash
	iterator := startingSeed
	for i := 0; i < 10; i++ {
		bytes := sha256.Sum256(iterator)
		iterator = bytes[:]
		hashChain = append(hashChain, iterator)
	}

	// Now we need to reverse the hash chain..
	for left, right := 0, len(hashChain)-1; left < right; left, right = left+1, right-1 {
		hashChain[left], hashChain[right] = hashChain[right], hashChain[left]
	}
	// Wow go. You're so cool. Glad there isn't a generic .reverse() method.

	GS_SEED_HASH, hashChain := hashChain[0], hashChain[1:]

	fmt.Println("The terminating hash (GS_SEED_HASH) is: ", hex.EncodeToString(GS_SEED_HASH))

	pool, err := pgxpool.Connect(context.Background(), "postgres://logger:verysecurepassword@34.145.37.118:5432/vx")
	if err != nil {
		panic(err)
	}

	vxPubKey := vx_make_commitment(pool, GS_SEED_HASH)

	fmt.Println("The vx pubkey is: ", hex.EncodeToString(vxPubKey))

	/// Ok ... now this process is done per bet

	gameId := 0
	for len(hashChain) > 0 {
		gameId = gameId + 1
		var hash []byte
		hash, hashChain = hashChain[0], hashChain[1:]

		vxSignature := vx_make_wager(pool, GS_SEED_HASH, hash, gameId)

		verified, err := VerifySignature(vxSignature, hash, vxPubKey)
		if err != nil {
			panic(err)
		}
		if !verified {
			panic("wtf vx signature is not verified!")
		}

		seed := sha256.Sum256(vxSignature)

		const nBits = 52

		seedInt := new(big.Int).SetBytes(seed[:])
		seedInt.Rsh(seedInt, sha256.Size*8-nBits)
		r := seedInt.Uint64()

		X := float64(r) / math.Pow(2, nBits) // uniformly distributed in [0; 1)

		fmt.Println("Game Id: ", gameId, "Multiplier (with no house edge): ", (1 / X), "x ... verified: ", verified)

	}

}

func HexToBytes(hexString string) []byte {
	data, err := hex.DecodeString(hexString)
	if err != nil {
		panic(err)
	}
	return data
}
