package types

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValsetConfirmSig(t *testing.T) {
	const (
		correctSig = "e108a7776de6b87183b0690484a74daef44aa6daf907e91abaf7bbfa426ae7706b12e0bd44ef7b0634710d99c2d81087a2f39e075158212343a3b2948ecf33d01c"
		invalidSig = "fffff7776de6b87183b0690484a74daef44aa6daf907e91abaf7bbfa426ae7706b12e0bd44ef7b0634710d99c2d81087a2f39e075158212343a3b2948ecf33d01c"
		ethAddress = "0xc783df8a850f42e7F7e57013759C285caa701eB6"
		hash       = "88165860d955aee7dc3e83d9d1156a5864b708841965585d206dbef6e9e1a499"
	)

	specs := map[string]struct {
		srcHash      string
		srcSignature string
		srcETHAddr   string
		expErr       bool
	}{
		"all good": {
			srcHash:      hash,
			srcSignature: correctSig,
			srcETHAddr:   ethAddress,
		},
		"invalid signature": {
			srcHash:      hash,
			srcSignature: invalidSig,
			srcETHAddr:   ethAddress,
			expErr:       true,
		},
		"empty hash": {
			srcSignature: correctSig,
			srcETHAddr:   ethAddress,
			expErr:       true,
		},
		"hash too short": {
			srcSignature: correctSig,
			srcETHAddr:   ethAddress,
			srcHash:      hash[0:30],
			expErr:       true,
		},
		"hash too long": {
			srcSignature: correctSig,
			srcETHAddr:   ethAddress,
			srcHash:      hash + "01",
			expErr:       true,
		},
		"empty signature": {
			srcHash:    hash,
			srcETHAddr: ethAddress,
			expErr:     true,
		},
		"signature too short": {
			srcHash:      hash,
			srcSignature: correctSig[0:64],
			srcETHAddr:   ethAddress,
			expErr:       true,
		},
		"empty eth address": {
			srcHash:      hash,
			srcSignature: correctSig,
			expErr:       true,
		},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			var err error
			var hashBytes []byte
			if len(spec.srcHash) != 0 {
				hashBytes, err = hex.DecodeString(spec.srcHash)
				require.NoError(t, err)
			}
			sigBytes, err := hex.DecodeString(spec.srcSignature)
			require.NoError(t, err)

			// when
			err = ValidateEthereumSignature(hashBytes, sigBytes, spec.srcETHAddr)
			if spec.expErr {
				assert.Error(t, err)
				return
			}
			assert.NoError(t, err)
		})
	}
}
