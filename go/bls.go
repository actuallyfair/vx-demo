package main

import (
	"errors"

	bls "github.com/kilic/bls12-381"
)

func VerifySignature(signature, message, pubkey []byte) (bool, error) {

	var engine = bls.NewEngine()

	var G1 = bls.G1One
	var SIG, err_sig = bls.NewG2().FromCompressed(signature)

	if err_sig != nil {
		return false, err_sig
	}

	var pairOne = engine.AddPair(&G1, SIG).Result()

	var pub, err_pub = bls.NewG1().FromCompressed(pubkey)

	if err_pub != nil {
		return false, err_pub
	}

	var g = bls.NewG2()
	var domain = []byte("BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_NUL_")
	msg_on_curve, err_msg := g.HashToCurve(message, domain)

	if err_msg != nil {
		return false, err_msg
	}

	var pairTwo = engine.AddPair(pub, msg_on_curve).Result()

	GT := engine.GT()

	if !GT.IsValid(pairOne) {
		return false, errors.New("pairing One result is not valid, please check G1 and SIG")
	}

	if !GT.IsValid(pairTwo) {
		return false, errors.New("pairing Two result is not valid, please check Public key and msg")
	}

	var equalPairs = pairOne.Equal(pairTwo)

	return equalPairs, nil
}
