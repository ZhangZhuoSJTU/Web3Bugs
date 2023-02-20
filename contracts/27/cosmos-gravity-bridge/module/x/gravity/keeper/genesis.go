package keeper

import (
	sdk "github.com/cosmos/cosmos-sdk/types"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

// InitGenesis starts a chain from a genesis state
func InitGenesis(ctx sdk.Context, k Keeper, data types.GenesisState) {
	k.SetParams(ctx, *data.Params)
	// reset valsets in state
	for _, vs := range data.Valsets {
		// TODO: block height?
		k.StoreValsetUnsafe(ctx, vs)
	}

	// reset valset confirmations in state
	for _, conf := range data.ValsetConfirms {
		k.SetValsetConfirm(ctx, *conf)
	}

	// reset batches in state
	for _, batch := range data.Batches {
		// TODO: block height?
		k.StoreBatchUnsafe(ctx, batch)
	}

	// reset batch confirmations in state
	for _, conf := range data.BatchConfirms {
		conf := conf
		k.SetBatchConfirm(ctx, &conf)
	}

	// reset logic calls in state
	for _, call := range data.LogicCalls {
		k.SetOutgoingLogicCall(ctx, call)
	}

	// reset batch confirmations in state
	for _, conf := range data.LogicCallConfirms {
		conf := conf
		k.SetLogicCallConfirm(ctx, &conf)
	}

	// reset pool transactions in state
	for _, tx := range data.UnbatchedTransfers {
		if err := k.addUnbatchedTX(ctx, tx); err != nil {
			panic(err)
		}
	}

	// reset attestations in state
	for _, att := range data.Attestations {
		att := att
		claim, err := k.UnpackAttestationClaim(&att)
		if err != nil {
			panic("couldn't cast to claim")
		}

		// TODO: block height?
		k.SetAttestation(ctx, claim.GetEventNonce(), claim.ClaimHash(), &att)
	}
	k.setLastObservedEventNonce(ctx, data.LastObservedNonce)

	// reset attestation state of specific validators
	// this must be done after the above to be correct
	for _, att := range data.Attestations {
		att := att
		claim, err := k.UnpackAttestationClaim(&att)
		if err != nil {
			panic("couldn't cast to claim")
		}
		// reconstruct the latest event nonce for every validator
		// if somehow this genesis state is saved when all attestations
		// have been cleaned up GetLastEventNonceByValidator handles that case
		//
		// if we where to save and load the last event nonce for every validator
		// then we would need to carry that state forever across all chain restarts
		// but since we've already had to handle the edge case of new validators joining
		// while all attestations have already been cleaned up we can do this instead and
		// not carry around every validators event nonce counter forever.
		for _, vote := range att.Votes {
			val, err := sdk.ValAddressFromBech32(vote)
			if err != nil {
				panic(err)
			}
			last := k.GetLastEventNonceByValidator(ctx, val)
			if claim.GetEventNonce() > last {
				k.setLastEventNonceByValidator(ctx, val, claim.GetEventNonce())
			}
		}
	}

	// reset delegate keys in state
	for _, keys := range data.DelegateKeys {
		err := keys.ValidateBasic()
		if err != nil {
			panic("Invalid delegate key in Genesis!")
		}
		val, err := sdk.ValAddressFromBech32(keys.Validator)
		if err != nil {
			panic(err)
		}

		orch, err := sdk.AccAddressFromBech32(keys.Orchestrator)
		if err != nil {
			panic(err)
		}

		// set the orchestrator address
		k.SetOrchestratorValidator(ctx, val, orch)
		// set the ethereum address
		k.SetEthAddressForValidator(ctx, val, keys.EthAddress)
	}

	// populate state with cosmos originated denom-erc20 mapping
	for _, item := range data.Erc20ToDenoms {
		k.setCosmosOriginatedDenomToERC20(ctx, item.Denom, item.Erc20)
	}

	// now that we have the denom-erc20 mapping we need to validate
	// that the valset reward is possible and cosmos originated remove
	// this if you want a non-cosmos originated reward
	valsetReward := k.GetParams(ctx).ValsetReward
	if valsetReward.IsValid() && !valsetReward.IsZero() {
		_, exists := k.GetCosmosOriginatedERC20(ctx, valsetReward.Denom)
		if !exists {
			panic("Invalid Cosmos originated denom for valset reward")
		}
	}

}

// ExportGenesis exports all the state needed to restart the chain
// from the current state of the chain
func ExportGenesis(ctx sdk.Context, k Keeper) types.GenesisState {
	var (
		p                  = k.GetParams(ctx)
		calls              = k.GetOutgoingLogicCalls(ctx)
		batches            = k.GetOutgoingTxBatches(ctx)
		valsets            = k.GetValsets(ctx)
		attmap             = k.GetAttestationMapping(ctx)
		vsconfs            = []*types.MsgValsetConfirm{}
		batchconfs         = []types.MsgConfirmBatch{}
		callconfs          = []types.MsgConfirmLogicCall{}
		attestations       = []types.Attestation{}
		delegates          = k.GetDelegateKeys(ctx)
		lastobserved       = k.GetLastObservedEventNonce(ctx)
		erc20ToDenoms      = []*types.ERC20ToDenom{}
		unbatchedTransfers = k.GetUnbatchedTransactions(ctx)
	)

	// export valset confirmations from state
	for _, vs := range valsets {
		// TODO: set height = 0?
		vsconfs = append(vsconfs, k.GetValsetConfirms(ctx, vs.Nonce)...)
	}

	// export batch confirmations from state
	for _, batch := range batches {
		// TODO: set height = 0?
		batchconfs = append(batchconfs,
			k.GetBatchConfirmByNonceAndTokenContract(ctx, batch.BatchNonce, batch.TokenContract)...)
	}

	// export logic call confirmations from state
	for _, call := range calls {
		// TODO: set height = 0?
		callconfs = append(callconfs,
			k.GetLogicConfirmByInvalidationIDAndNonce(ctx, call.InvalidationId, call.InvalidationNonce)...)
	}

	// export attestations from state
	for _, atts := range attmap {
		// TODO: set height = 0?
		attestations = append(attestations, atts...)
	}

	// export erc20 to denom relations
	k.IterateERC20ToDenom(ctx, func(key []byte, erc20ToDenom *types.ERC20ToDenom) bool {
		erc20ToDenoms = append(erc20ToDenoms, erc20ToDenom)
		return false
	})

	return types.GenesisState{
		Params:             &p,
		LastObservedNonce:  lastobserved,
		Valsets:            valsets,
		ValsetConfirms:     vsconfs,
		Batches:            batches,
		BatchConfirms:      batchconfs,
		LogicCalls:         calls,
		LogicCallConfirms:  callconfs,
		Attestations:       attestations,
		DelegateKeys:       delegates,
		Erc20ToDenoms:      erc20ToDenoms,
		UnbatchedTransfers: unbatchedTransfers,
	}
}
