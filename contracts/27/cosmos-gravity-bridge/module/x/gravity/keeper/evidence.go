package keeper

import (
	"bytes"
	"encoding/hex"
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

func (k Keeper) CheckBadSignatureEvidence(
	ctx sdk.Context,
	msg *types.MsgSubmitBadSignatureEvidence) error {
	var subject types.EthereumSigned

	k.cdc.UnpackAny(msg.Subject, &subject)

	switch subject := subject.(type) {
	case *types.OutgoingTxBatch:
		return k.checkBadSignatureEvidenceInternal(ctx, subject, msg.Signature)
	case *types.Valset:
		return k.checkBadSignatureEvidenceInternal(ctx, subject, msg.Signature)
	case *types.OutgoingLogicCall:
		return k.checkBadSignatureEvidenceInternal(ctx, subject, msg.Signature)

	default:
		return sdkerrors.Wrap(types.ErrInvalid, "Bad signature must be over a batch, valset, or logic call")
	}
}

func (k Keeper) checkBadSignatureEvidenceInternal(ctx sdk.Context, subject types.EthereumSigned, signature string) error {
	// Get checkpoint of the supposed bad signature (fake valset, batch, or logic call submitted to eth)
	gravityID := k.GetGravityID(ctx)
	checkpoint := subject.GetCheckpoint(gravityID)

	// Try to find the checkpoint in the archives. If it exists, we don't slash because
	// this is not a bad signature
	if k.GetPastEthSignatureCheckpoint(ctx, checkpoint) {
		return sdkerrors.Wrap(types.ErrInvalid, "Checkpoint exists, cannot slash")
	}

	// Decode Eth signature to bytes
	sigBytes, err := hex.DecodeString(signature)
	if err != nil {
		return sdkerrors.Wrap(types.ErrInvalid, "signature decoding")
	}

	// Get eth address of the offending validator using the checkpoint and the signature
	ethAddress, err := types.EthAddressFromSignature(checkpoint, sigBytes)
	if err != nil {
		return sdkerrors.Wrap(types.ErrInvalid, fmt.Sprintf("signature to eth address failed with checkpoint %s and signature %s", hex.EncodeToString(checkpoint), signature))
	}

	// Find the offending validator by eth address
	val, found := k.GetValidatorByEthAddress(ctx, ethAddress)
	if !found {
		return sdkerrors.Wrap(types.ErrInvalid, fmt.Sprintf("Did not find validator for eth address %s", ethAddress))
	}

	// Slash the offending validator
	cons, err := val.GetConsAddr()
	if err != nil {
		return sdkerrors.Wrap(err, "Could not get consensus key address for validator")
	}

	params := k.GetParams(ctx)
	k.StakingKeeper.Slash(ctx, cons, ctx.BlockHeight(), val.ConsensusPower(), params.SlashFractionBadEthSignature)
	if !val.IsJailed() {
		k.StakingKeeper.Jail(ctx, cons)
	}

	return nil
}

// SetPastEthSignatureCheckpoint puts the checkpoint of a valset, batch, or logic call into a set
// in order to prove later that it existed at one point.
func (k Keeper) SetPastEthSignatureCheckpoint(ctx sdk.Context, checkpoint []byte) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.GetPastEthSignatureCheckpointKey(checkpoint), []byte{0x1})
}

// GetPastEthSignatureCheckpoint tells you whether a given checkpoint has ever existed
func (k Keeper) GetPastEthSignatureCheckpoint(ctx sdk.Context, checkpoint []byte) (found bool) {
	store := ctx.KVStore(k.storeKey)
	if bytes.Equal(store.Get(types.GetPastEthSignatureCheckpointKey(checkpoint)), []byte{0x1}) {
		return true
	} else {
		return false
	}
}
