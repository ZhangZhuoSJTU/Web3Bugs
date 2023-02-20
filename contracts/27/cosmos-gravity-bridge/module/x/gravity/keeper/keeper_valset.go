package keeper

import (
	"fmt"
	"math"
	"sort"
	"strconv"

	"github.com/cosmos/cosmos-sdk/store/prefix"
	sdk "github.com/cosmos/cosmos-sdk/types"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

/////////////////////////////
//     VALSET REQUESTS     //
/////////////////////////////

// SetValsetRequest returns a new instance of the Gravity BridgeValidatorSet
// by taking a snapshot of the current set
// i.e. {"nonce": 1, "memebers": [{"eth_addr": "foo", "power": 11223}]}
func (k Keeper) SetValsetRequest(ctx sdk.Context) *types.Valset {
	valset := k.GetCurrentValset(ctx)
	k.StoreValset(ctx, valset)

	// Store the checkpoint as a legit past valset, this is only for evidence
	// based slashing. We are storing the checkpoint that will be signed with
	// the validators Etheruem keys so that we know not to slash them if someone
	// attempts to submit the signature of this validator set as evidence of bad behavior
	checkpoint := valset.GetCheckpoint(k.GetGravityID(ctx))
	k.SetPastEthSignatureCheckpoint(ctx, checkpoint)

	ctx.EventManager().EmitEvent(
		sdk.NewEvent(
			types.EventTypeMultisigUpdateRequest,
			sdk.NewAttribute(sdk.AttributeKeyModule, types.ModuleName),
			sdk.NewAttribute(types.AttributeKeyContract, k.GetBridgeContractAddress(ctx)),
			sdk.NewAttribute(types.AttributeKeyBridgeChainID, strconv.Itoa(int(k.GetBridgeChainID(ctx)))),
			sdk.NewAttribute(types.AttributeKeyMultisigID, fmt.Sprint(valset.Nonce)),
			sdk.NewAttribute(types.AttributeKeyNonce, fmt.Sprint(valset.Nonce)),
		),
	)

	return valset
}

// StoreValset is for storing a valiator set at a given height
func (k Keeper) StoreValset(ctx sdk.Context, valset *types.Valset) {
	store := ctx.KVStore(k.storeKey)
	valset.Height = uint64(ctx.BlockHeight())
	store.Set(types.GetValsetKey(valset.Nonce), k.cdc.MustMarshalBinaryBare(valset))
	k.SetLatestValsetNonce(ctx, valset.Nonce)
}

// StoreValsetUnsafe is for storing a valiator set at a given height
func (k Keeper) StoreValsetUnsafe(ctx sdk.Context, valset *types.Valset) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.GetValsetKey(valset.Nonce), k.cdc.MustMarshalBinaryBare(valset))
	k.SetLatestValsetNonce(ctx, valset.Nonce)
}

// HasValsetRequest returns true if a valset defined by a nonce exists
func (k Keeper) HasValsetRequest(ctx sdk.Context, nonce uint64) bool {
	store := ctx.KVStore(k.storeKey)
	return store.Has(types.GetValsetKey(nonce))
}

// DeleteValset deletes the valset at a given nonce from state
func (k Keeper) DeleteValset(ctx sdk.Context, nonce uint64) {
	ctx.KVStore(k.storeKey).Delete(types.GetValsetKey(nonce))
}

// GetLatestValsetNonce returns the latest valset nonce
func (k Keeper) GetLatestValsetNonce(ctx sdk.Context) uint64 {
	store := ctx.KVStore(k.storeKey)
	bytes := store.Get(types.LatestValsetNonce)

	if len(bytes) == 0 {
		return 0
	}
	return types.UInt64FromBytes(bytes)
}

//  SetLatestValsetNonce sets the latest valset nonce
func (k Keeper) SetLatestValsetNonce(ctx sdk.Context, nonce uint64) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.LatestValsetNonce, types.UInt64Bytes(nonce))
}

// GetValset returns a valset by nonce
func (k Keeper) GetValset(ctx sdk.Context, nonce uint64) *types.Valset {
	store := ctx.KVStore(k.storeKey)
	bz := store.Get(types.GetValsetKey(nonce))
	if bz == nil {
		return nil
	}
	var valset types.Valset
	k.cdc.MustUnmarshalBinaryBare(bz, &valset)
	return &valset
}

// IterateValsets retruns all valsetRequests
func (k Keeper) IterateValsets(ctx sdk.Context, cb func(key []byte, val *types.Valset) bool) {
	prefixStore := prefix.NewStore(ctx.KVStore(k.storeKey), types.ValsetRequestKey)
	iter := prefixStore.ReverseIterator(nil, nil)
	defer iter.Close()
	for ; iter.Valid(); iter.Next() {
		var valset types.Valset
		k.cdc.MustUnmarshalBinaryBare(iter.Value(), &valset)
		// cb returns true to stop early
		if cb(iter.Key(), &valset) {
			break
		}
	}
}

// GetValsets returns all the validator sets in state
func (k Keeper) GetValsets(ctx sdk.Context) (out []*types.Valset) {
	k.IterateValsets(ctx, func(_ []byte, val *types.Valset) bool {
		out = append(out, val)
		return false
	})
	sort.Sort(types.Valsets(out))
	return
}

// GetLatestValset returns the latest validator set in store. This is different
// from the CurrrentValset because this one has been saved and is therefore *the* valset
// for this nonce. GetCurrentValset shows you what could be, if you chose to save it, this function
// shows you what is the latest valset that was saved.
func (k Keeper) GetLatestValset(ctx sdk.Context) (out *types.Valset) {
	latestValsetNonce := k.GetLatestValsetNonce(ctx)
	out = k.GetValset(ctx, latestValsetNonce)
	return
}

// setLastSlashedValsetNonce sets the latest slashed valset nonce
func (k Keeper) SetLastSlashedValsetNonce(ctx sdk.Context, nonce uint64) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.LastSlashedValsetNonce, types.UInt64Bytes(nonce))
}

// GetLastSlashedValsetNonce returns the latest slashed valset nonce
func (k Keeper) GetLastSlashedValsetNonce(ctx sdk.Context) uint64 {
	store := ctx.KVStore(k.storeKey)
	bytes := store.Get(types.LastSlashedValsetNonce)

	if len(bytes) == 0 {
		return 0
	}
	return types.UInt64FromBytes(bytes)
}

// SetLastUnBondingBlockHeight sets the last unbonding block height
func (k Keeper) SetLastUnBondingBlockHeight(ctx sdk.Context, unbondingBlockHeight uint64) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.LastUnBondingBlockHeight, types.UInt64Bytes(unbondingBlockHeight))
}

// GetLastUnBondingBlockHeight returns the last unbonding block height
func (k Keeper) GetLastUnBondingBlockHeight(ctx sdk.Context) uint64 {
	store := ctx.KVStore(k.storeKey)
	bytes := store.Get(types.LastUnBondingBlockHeight)

	if len(bytes) == 0 {
		return 0
	}
	return types.UInt64FromBytes(bytes)
}

// GetUnSlashedValsets returns all the "ready-to-slash" unslashed validator sets in state (valsets at least signedValsetsWindow blocks old)
func (k Keeper) GetUnSlashedValsets(ctx sdk.Context, signedValsetsWindow uint64) (out []*types.Valset) {
	lastSlashedValsetNonce := k.GetLastSlashedValsetNonce(ctx)
	blockHeight := uint64(ctx.BlockHeight())
	k.IterateValsetBySlashedValsetNonce(ctx, lastSlashedValsetNonce, func(_ []byte, valset *types.Valset) bool {
		// Implicitly the unslashed valsets appear after the last slashed valset,
		// however not all valsets are ready-to-slash since validators have a window
		if valset.Nonce > lastSlashedValsetNonce && !(blockHeight < valset.Height+signedValsetsWindow) {
			out = append(out, valset)
		}
		return false
	})
	return
}

// IterateValsetBySlashedValsetNonce iterates through all valset by last slashed valset nonce in ASC order
func (k Keeper) IterateValsetBySlashedValsetNonce(ctx sdk.Context, lastSlashedValsetNonce uint64, cb func([]byte, *types.Valset) bool) {
	prefixStore := prefix.NewStore(ctx.KVStore(k.storeKey), types.ValsetRequestKey)
	// Consider all valsets, including the most recent one
	cutoffNonce := k.GetLatestValsetNonce(ctx) + 1
	iter := prefixStore.Iterator(types.UInt64Bytes(lastSlashedValsetNonce), types.UInt64Bytes(cutoffNonce))
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		var valset types.Valset
		k.cdc.MustUnmarshalBinaryBare(iter.Value(), &valset)
		// cb returns true to stop early
		if cb(iter.Key(), &valset) {
			break
		}
	}
}

// GetCurrentValset gets powers from the store and normalizes them
// into an integer percentage with a resolution of uint32 Max meaning
// a given validators 'gravity power' is computed as
// Cosmos power for that validator / total cosmos power = x / uint32 Max
// where x is the voting power on the gravity contract. This allows us
// to only use integer division which produces a known rounding error
// from truncation equal to the ratio of the validators
// Cosmos power / total cosmos power ratio, leaving us at uint32 Max - 1
// total voting power. This is an acceptable rounding error since floating
// point may cause consensus problems if different floating point unit
// implementations are involved.
//
// 'total cosmos power' has an edge case, if a validator has not set their
// Ethereum key they are not included in the total. If they where control
// of the bridge could be lost in the following situation.
//
// If we have 100 total power, and 100 total power joins the validator set
// the new validators hold more than 33% of the bridge power, if we generate
// and submit a valset and they don't have their eth keys set they can never
// update the validator set again and the bridge and all its' funds are lost.
// For this reason we exclude validators with unset eth keys from validator sets
//
// The function is intended to return what the valset would look like if you made one now
// you should call this function, evaluate if you want to save this new valset, and discard
// it or save
func (k Keeper) GetCurrentValset(ctx sdk.Context) *types.Valset {
	validators := k.StakingKeeper.GetBondedValidatorsByPower(ctx)
	// allocate enough space for all validators, but len zero, we then append
	// so that we have an array with extra capacity but the correct length depending
	// on how many validators have keys set.
	bridgeValidators := make([]*types.BridgeValidator, 0, len(validators))
	var totalPower uint64
	// TODO someone with in depth info on Cosmos staking should determine
	// if this is doing what I think it's doing
	for _, validator := range validators {
		val := validator.GetOperator()

		p := uint64(k.StakingKeeper.GetLastValidatorPower(ctx, val))

		if ethAddr, found := k.GetEthAddressByValidator(ctx, val); found {
			bv := &types.BridgeValidator{Power: p, EthereumAddress: ethAddr}
			bridgeValidators = append(bridgeValidators, bv)
			totalPower += p
		}
	}
	// normalize power values
	for i := range bridgeValidators {
		bridgeValidators[i].Power = sdk.NewUint(bridgeValidators[i].Power).MulUint64(math.MaxUint32).QuoUint64(totalPower).Uint64()
	}

	// get the reward from the params store
	reward := k.GetParams(ctx).ValsetReward
	var rewardToken string
	var rewardAmount sdk.Int
	if !reward.IsValid() || reward.IsZero() {
		// the case where a validator has 'no reward'. The 'no reward' value is interpreted as having a zero
		// address for the ERC20 token and a zero value for the reward amount. Since we store a coin with the
		// params, a coin with a blank denom and/or zero amount is interpreted in this way.
		rewardToken = "0x0000000000000000000000000000000000000000"
		rewardAmount = sdk.NewIntFromUint64(0)

	} else {
		rewardToken, rewardAmount = k.RewardToERC20Lookup(ctx, reward)
	}

	// increment the nonce, since this potential future valset should be after the current valset
	valsetNonce := k.GetLatestValsetNonce(ctx) + 1

	return types.NewValset(valsetNonce, uint64(ctx.BlockHeight()), bridgeValidators, rewardAmount, rewardToken)
}

/////////////////////////////
//     VALSET CONFIRMS     //
/////////////////////////////

// GetValsetConfirm returns a valset confirmation by a nonce and validator address
func (k Keeper) GetValsetConfirm(ctx sdk.Context, nonce uint64, validator sdk.AccAddress) *types.MsgValsetConfirm {
	store := ctx.KVStore(k.storeKey)
	entity := store.Get(types.GetValsetConfirmKey(nonce, validator))
	if entity == nil {
		return nil
	}
	confirm := types.MsgValsetConfirm{
		Nonce:        nonce,
		Orchestrator: "",
		EthAddress:   "",
		Signature:    "",
	}
	k.cdc.MustUnmarshalBinaryBare(entity, &confirm)
	return &confirm
}

// SetValsetConfirm sets a valset confirmation
func (k Keeper) SetValsetConfirm(ctx sdk.Context, valsetConf types.MsgValsetConfirm) []byte {
	store := ctx.KVStore(k.storeKey)
	addr, err := sdk.AccAddressFromBech32(valsetConf.Orchestrator)
	if err != nil {
		panic(err)
	}
	key := types.GetValsetConfirmKey(valsetConf.Nonce, addr)
	store.Set(key, k.cdc.MustMarshalBinaryBare(&valsetConf))
	return key
}

// GetValsetConfirms returns all validator set confirmations by nonce
func (k Keeper) GetValsetConfirms(ctx sdk.Context, nonce uint64) (confirms []*types.MsgValsetConfirm) {
	prefixStore := prefix.NewStore(ctx.KVStore(k.storeKey), types.ValsetConfirmKey)
	start, end := prefixRange(types.UInt64Bytes(nonce))
	iterator := prefixStore.Iterator(start, end)

	defer iterator.Close()

	for ; iterator.Valid(); iterator.Next() {
		confirm := types.MsgValsetConfirm{
			Nonce:        nonce,
			Orchestrator: "",
			EthAddress:   "",
			Signature:    "",
		}
		k.cdc.MustUnmarshalBinaryBare(iterator.Value(), &confirm)
		confirms = append(confirms, &confirm)
	}

	return confirms
}

// IterateValsetConfirmByNonce iterates through all valset confirms by validator set nonce in ASC order
func (k Keeper) IterateValsetConfirmByNonce(ctx sdk.Context, nonce uint64, cb func([]byte, types.MsgValsetConfirm) bool) {
	prefixStore := prefix.NewStore(ctx.KVStore(k.storeKey), types.ValsetConfirmKey)
	iter := prefixStore.Iterator(prefixRange(types.UInt64Bytes(nonce)))
	defer iter.Close()

	for ; iter.Valid(); iter.Next() {
		confirm := types.MsgValsetConfirm{
			Nonce:        nonce,
			Orchestrator: "",
			EthAddress:   "",
			Signature:    "",
		}
		k.cdc.MustUnmarshalBinaryBare(iter.Value(), &confirm)
		// cb returns true to stop early
		if cb(iter.Key(), confirm) {
			break
		}
	}
}
