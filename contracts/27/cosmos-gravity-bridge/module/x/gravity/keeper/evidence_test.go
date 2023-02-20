package keeper

import (
	"encoding/hex"
	"testing"
	"time"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
	codectypes "github.com/cosmos/cosmos-sdk/codec/types"
	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
)

//nolint: exhaustivestruct
func TestSubmitBadSignatureEvidenceBatchExists(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	var (
		now                 = time.Now().UTC()
		mySender, _         = sdk.AccAddressFromBech32("cosmos1ahx7f8wyertuus9r20284ej0asrs085case3kn")
		myReceiver          = "0xd041c41EA1bf0F006ADBb6d2c9ef9D425dE5eaD7"
		myTokenContractAddr = "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5" // Pickle
		allVouchers         = sdk.NewCoins(
			types.NewERC20Token(99999, myTokenContractAddr).GravityCoin(),
		)
	)

	// mint some voucher first
	require.NoError(t, input.BankKeeper.MintCoins(ctx, types.ModuleName, allVouchers))
	// set senders balance
	input.AccountKeeper.NewAccountWithAddress(ctx, mySender)
	require.NoError(t, input.BankKeeper.SetBalances(ctx, mySender, allVouchers))

	// CREATE BATCH

	// add some TX to the pool
	for i, v := range []uint64{2, 3, 2, 1} {
		amount := types.NewERC20Token(uint64(i+100), myTokenContractAddr).GravityCoin()
		fee := types.NewERC20Token(v, myTokenContractAddr).GravityCoin()
		_, err := input.GravityKeeper.AddToOutgoingPool(ctx, mySender, myReceiver, amount, fee)
		require.NoError(t, err)
	}

	// when
	ctx = ctx.WithBlockTime(now)

	goodBatch, err := input.GravityKeeper.BuildOutgoingTXBatch(ctx, myTokenContractAddr, 2)
	require.NoError(t, err)

	any, _ := codectypes.NewAnyWithValue(goodBatch)

	msg := types.MsgSubmitBadSignatureEvidence{
		Subject:   any,
		Signature: "foo",
	}

	err = input.GravityKeeper.CheckBadSignatureEvidence(ctx, &msg)
	require.EqualError(t, err, "Checkpoint exists, cannot slash: invalid")
}

//nolint: exhaustivestruct
func TestSubmitBadSignatureEvidenceValsetExists(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	valset := input.GravityKeeper.SetValsetRequest(ctx)

	any, _ := codectypes.NewAnyWithValue(valset)

	msg := types.MsgSubmitBadSignatureEvidence{
		Subject:   any,
		Signature: "foo",
	}

	err := input.GravityKeeper.CheckBadSignatureEvidence(ctx, &msg)
	require.EqualError(t, err, "Checkpoint exists, cannot slash: invalid")
}

//nolint: exhaustivestruct
func TestSubmitBadSignatureEvidenceLogicCallExists(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	logicCall := types.OutgoingLogicCall{
		Timeout: 420,
	}

	input.GravityKeeper.SetOutgoingLogicCall(ctx, &logicCall)

	any, _ := codectypes.NewAnyWithValue(&logicCall)

	msg := types.MsgSubmitBadSignatureEvidence{
		Subject:   any,
		Signature: "foo",
	}

	err := input.GravityKeeper.CheckBadSignatureEvidence(ctx, &msg)
	require.EqualError(t, err, "Checkpoint exists, cannot slash: invalid")
}

//nolint: exhaustivestruct
func TestSubmitBadSignatureEvidenceSlash(t *testing.T) {
	input, ctx := SetupFiveValChain(t)

	batch := types.OutgoingTxBatch{
		BatchTimeout: 420,
	}

	checkpoint := batch.GetCheckpoint(input.GravityKeeper.GetGravityID(ctx))

	any, err := codectypes.NewAnyWithValue(&batch)
	require.NoError(t, err)

	privKey, err := crypto.GenerateKey()
	require.NoError(t, err)

	ethAddress := crypto.PubkeyToAddress(privKey.PublicKey)

	input.GravityKeeper.SetEthAddressForValidator(ctx, ValAddrs[0], ethAddress.String())

	ethSignature, err := types.NewEthereumSignature(checkpoint, privKey)
	require.NoError(t, err)

	msg := types.MsgSubmitBadSignatureEvidence{
		Subject:   any,
		Signature: hex.EncodeToString(ethSignature),
	}

	err = input.GravityKeeper.CheckBadSignatureEvidence(ctx, &msg)
	require.NoError(t, err)

	val := input.StakingKeeper.Validator(ctx, ValAddrs[0])
	require.True(t, val.IsJailed())
}
