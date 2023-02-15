package types

import (
	"encoding/hex"
	"testing"

	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//nolint: exhaustivestruct
func TestOutgoingTxBatchCheckpointGold1(t *testing.T) {
	senderAddr, err := sdk.AccAddressFromHex("527FBEE652609AB150F0AEE9D61A2F76CFC4A73E")
	require.NoError(t, err)
	var (
		erc20Addr = "0x835973768750b3ED2D5c3EF5AdcD5eDb44d12aD4"
	)

	src := OutgoingTxBatch{
		BatchNonce: 1,
		//
		BatchTimeout: 2111,
		Transactions: []*OutgoingTransferTx{
			{
				Id:          0x1,
				Sender:      senderAddr.String(),
				DestAddress: "0x9FC9C2DfBA3b6cF204C37a5F690619772b926e39",
				Erc20Token: &ERC20Token{
					Amount:   sdk.NewInt(0x1),
					Contract: erc20Addr,
				},
				Erc20Fee: &ERC20Token{
					Amount:   sdk.NewInt(0x1),
					Contract: erc20Addr,
				},
			},
		},
		TokenContract: erc20Addr,
	}

	// TODO: get from params
	ourHash := src.GetCheckpoint("foo")

	// hash from bridge contract
	goldHash := "0xa3a7ee0a363b8ad2514e7ee8f110d7449c0d88f3b0913c28c1751e6e0079a9b2"[2:]
	// The function used to compute the "gold hash" above is in /solidity/test/updateValsetAndSubmitBatch.ts
	// Be aware that every time that you run the above .ts file, it will use a different tokenContractAddress and thus compute
	// a different hash.
	assert.Equal(t, goldHash, hex.EncodeToString(ourHash))
}

//nolint: exhaustivestruct
func TestOutgoingLogicCallCheckpointGold1(t *testing.T) {
	payload, err := hex.DecodeString("0x74657374696e675061796c6f6164000000000000000000000000000000000000"[2:])
	require.NoError(t, err)
	invalidationId, err := hex.DecodeString("0x696e76616c69646174696f6e4964000000000000000000000000000000000000"[2:])
	require.NoError(t, err)

	token := []*ERC20Token{{
		Contract: "0xC26eFfa98B8A2632141562Ae7E34953Cfe5B4888",
		Amount:   sdk.NewIntFromUint64(1),
	}}
	call := OutgoingLogicCall{
		Transfers:            token,
		Fees:                 token,
		LogicContractAddress: "0x17c1736CcF692F653c433d7aa2aB45148C016F68",
		Payload:              payload,
		Timeout:              4766922941000,
		InvalidationId:       invalidationId,
		InvalidationNonce:    1,
	}

	ourHash := call.GetCheckpoint("foo")

	// hash from bridge contract
	goldHash := "0x1de95c9ace999f8ec70c6dc8d045942da2612950567c4861aca959c0650194da"[2:]
	// The function used to compute the "gold hash" above is in /solidity/test/updateValsetAndSubmitBatch.ts
	// Be aware that every time that you run the above .ts file, it will use a different tokenContractAddress and thus compute
	// a different hash.
	assert.Equal(t, goldHash, hex.EncodeToString(ourHash))
}
