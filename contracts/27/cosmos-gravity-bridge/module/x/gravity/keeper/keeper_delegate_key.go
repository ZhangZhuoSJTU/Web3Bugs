package keeper

import (
	"time"

	codectypes "github.com/cosmos/cosmos-sdk/codec/types"
	sdk "github.com/cosmos/cosmos-sdk/types"
	stakingtypes "github.com/cosmos/cosmos-sdk/x/staking/types"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

/////////////////////////////
//    ADDRESS DELEGATION   //
/////////////////////////////

// SetOrchestratorValidator sets the Orchestrator key for a given validator
func (k Keeper) SetOrchestratorValidator(ctx sdk.Context, val sdk.ValAddress, orch sdk.AccAddress) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.GetOrchestratorAddressKey(orch), val.Bytes())
}

// GetOrchestratorValidator returns the validator key associated with an orchestrator key
func (k Keeper) GetOrchestratorValidator(ctx sdk.Context, orch sdk.AccAddress) (validator stakingtypes.Validator, found bool) {
	store := ctx.KVStore(k.storeKey)
	valAddr := store.Get(types.GetOrchestratorAddressKey(orch))
	if valAddr == nil {
		return stakingtypes.Validator{
			OperatorAddress: "",
			ConsensusPubkey: &codectypes.Any{
				TypeUrl:              "",
				Value:                []byte{},
				XXX_NoUnkeyedLiteral: struct{}{},
				XXX_unrecognized:     []byte{},
				XXX_sizecache:        0,
			},
			Jailed:          false,
			Status:          0,
			Tokens:          sdk.Int{},
			DelegatorShares: sdk.Dec{},
			Description: stakingtypes.Description{
				Moniker:         "",
				Identity:        "",
				Website:         "",
				SecurityContact: "",
				Details:         "",
			},
			UnbondingHeight: 0,
			UnbondingTime:   time.Time{},
			Commission: stakingtypes.Commission{
				CommissionRates: stakingtypes.CommissionRates{
					Rate:          sdk.Dec{},
					MaxRate:       sdk.Dec{},
					MaxChangeRate: sdk.Dec{},
				},
				UpdateTime: time.Time{},
			},
			MinSelfDelegation: sdk.Int{},
		}, false
	}
	validator, found = k.StakingKeeper.GetValidator(ctx, valAddr)
	if !found {
		return stakingtypes.Validator{
			OperatorAddress: "",
			ConsensusPubkey: &codectypes.Any{
				TypeUrl:              "",
				Value:                []byte{},
				XXX_NoUnkeyedLiteral: struct{}{},
				XXX_unrecognized:     []byte{},
				XXX_sizecache:        0,
			},
			Jailed:          false,
			Status:          0,
			Tokens:          sdk.Int{},
			DelegatorShares: sdk.Dec{},
			Description: stakingtypes.Description{
				Moniker:         "",
				Identity:        "",
				Website:         "",
				SecurityContact: "",
				Details:         "",
			},
			UnbondingHeight: 0,
			UnbondingTime:   time.Time{},
			Commission: stakingtypes.Commission{
				CommissionRates: stakingtypes.CommissionRates{
					Rate:          sdk.Dec{},
					MaxRate:       sdk.Dec{},
					MaxChangeRate: sdk.Dec{},
				},
				UpdateTime: time.Time{},
			},
			MinSelfDelegation: sdk.Int{},
		}, false
	}

	return validator, true
}

/////////////////////////////
//       ETH ADDRESS       //
/////////////////////////////

// SetEthAddress sets the ethereum address for a given validator
func (k Keeper) SetEthAddressForValidator(ctx sdk.Context, validator sdk.ValAddress, ethAddr string) {
	store := ctx.KVStore(k.storeKey)
	store.Set(types.GetEthAddressByValidatorKey(validator), []byte(ethAddr))
	store.Set(types.GetValidatorByEthAddressKey(ethAddr), []byte(validator))
}

// GetEthAddressByValidator returns the eth address for a given gravity validator
func (k Keeper) GetEthAddressByValidator(ctx sdk.Context, validator sdk.ValAddress) (ethAddress string, found bool) {
	store := ctx.KVStore(k.storeKey)
	ethAddr := store.Get(types.GetEthAddressByValidatorKey(validator))
	if ethAddr == nil {
		return "", false
	} else {
		return string(ethAddr), true
	}
}

// GetValidatorByEthAddress returns the validator for a given eth address
func (k Keeper) GetValidatorByEthAddress(ctx sdk.Context, ethAddr string) (validator stakingtypes.Validator, found bool) {
	store := ctx.KVStore(k.storeKey)
	valAddr := store.Get(types.GetValidatorByEthAddressKey(ethAddr))
	if valAddr == nil {
		return stakingtypes.Validator{
			OperatorAddress: "",
			ConsensusPubkey: &codectypes.Any{
				TypeUrl:              "",
				Value:                []byte{},
				XXX_NoUnkeyedLiteral: struct{}{},
				XXX_unrecognized:     []byte{},
				XXX_sizecache:        0,
			},
			Jailed:          false,
			Status:          0,
			Tokens:          sdk.Int{},
			DelegatorShares: sdk.Dec{},
			Description: stakingtypes.Description{
				Moniker:         "",
				Identity:        "",
				Website:         "",
				SecurityContact: "",
				Details:         "",
			},
			UnbondingHeight: 0,
			UnbondingTime:   time.Time{},
			Commission: stakingtypes.Commission{
				CommissionRates: stakingtypes.CommissionRates{
					Rate:          sdk.Dec{},
					MaxRate:       sdk.Dec{},
					MaxChangeRate: sdk.Dec{},
				},
				UpdateTime: time.Time{},
			},
			MinSelfDelegation: sdk.Int{},
		}, false
	}
	validator, found = k.StakingKeeper.GetValidator(ctx, valAddr)
	if !found {
		return stakingtypes.Validator{
			OperatorAddress: "",
			ConsensusPubkey: &codectypes.Any{
				TypeUrl:              "",
				Value:                []byte{},
				XXX_NoUnkeyedLiteral: struct{}{},
				XXX_unrecognized:     []byte{},
				XXX_sizecache:        0,
			},
			Jailed:          false,
			Status:          0,
			Tokens:          sdk.Int{},
			DelegatorShares: sdk.Dec{},
			Description: stakingtypes.Description{
				Moniker:         "",
				Identity:        "",
				Website:         "",
				SecurityContact: "",
				Details:         "",
			},
			UnbondingHeight: 0,
			UnbondingTime:   time.Time{},
			Commission: stakingtypes.Commission{
				CommissionRates: stakingtypes.CommissionRates{
					Rate:          sdk.Dec{},
					MaxRate:       sdk.Dec{},
					MaxChangeRate: sdk.Dec{},
				},
				UpdateTime: time.Time{},
			},
			MinSelfDelegation: sdk.Int{},
		}, false
	}

	return validator, true
}
