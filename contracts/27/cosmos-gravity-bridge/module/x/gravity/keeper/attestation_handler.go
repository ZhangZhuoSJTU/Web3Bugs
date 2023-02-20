package keeper

import (
	"fmt"

	sdk "github.com/cosmos/cosmos-sdk/types"
	sdkerrors "github.com/cosmos/cosmos-sdk/types/errors"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

// AttestationHandler processes `observed` Attestations
type AttestationHandler struct {
	keeper     Keeper
	bankKeeper types.BankKeeper
}

// Handle is the entry point for Attestation processing.
func (a AttestationHandler) Handle(ctx sdk.Context, att types.Attestation, claim types.EthereumClaim) error {
	switch claim := claim.(type) {
	// deposit in this context means a deposit into the Ethereum side of the bridge
	case *types.MsgSendToCosmosClaim:
		// Check if coin is Cosmos-originated asset and get denom
		isCosmosOriginated, denom := a.keeper.ERC20ToDenomLookup(ctx, claim.TokenContract)

		if isCosmosOriginated {
			// If it is cosmos originated, unlock the coins
			coins := sdk.Coins{sdk.NewCoin(denom, claim.Amount)}

			addr, err := sdk.AccAddressFromBech32(claim.CosmosReceiver)
			if err != nil {
				return sdkerrors.Wrap(err, "invalid receiver address")
			}

			if err = a.bankKeeper.SendCoinsFromModuleToAccount(ctx, types.ModuleName, addr, coins); err != nil {
				return sdkerrors.Wrap(err, "transfer vouchers")
			}
		} else {
			// If it is not cosmos originated, mint the coins (aka vouchers)
			coins := sdk.Coins{sdk.NewCoin(denom, claim.Amount)}

			if err := a.bankKeeper.MintCoins(ctx, types.ModuleName, coins); err != nil {
				return sdkerrors.Wrapf(err, "mint vouchers coins: %s", coins)
			}

			addr, err := sdk.AccAddressFromBech32(claim.CosmosReceiver)
			if err != nil {
				return sdkerrors.Wrap(err, "invalid receiver address")
			}

			if err = a.bankKeeper.SendCoinsFromModuleToAccount(ctx, types.ModuleName, addr, coins); err != nil {
				return sdkerrors.Wrap(err, "transfer vouchers")
			}
		}
	// withdraw in this context means a withdraw from the Ethereum side of the bridge
	case *types.MsgBatchSendToEthClaim:
		a.keeper.OutgoingTxBatchExecuted(ctx, claim.TokenContract, claim.BatchNonce)
		return nil
	case *types.MsgERC20DeployedClaim:
		// Check if it already exists
		existingERC20, exists := a.keeper.GetCosmosOriginatedERC20(ctx, claim.CosmosDenom)
		if exists {
			return sdkerrors.Wrap(
				types.ErrInvalid,
				fmt.Sprintf("ERC20 %s already exists for denom %s", existingERC20, claim.CosmosDenom))
		}

		// Check if denom exists
		metadata := a.keeper.bankKeeper.GetDenomMetaData(ctx, claim.CosmosDenom)
		if metadata.Base == "" {
			return sdkerrors.Wrap(types.ErrUnknown, fmt.Sprintf("denom not found %s", claim.CosmosDenom))
		}

		// Check if attributes of ERC20 match Cosmos denom
		if claim.Name != metadata.Display {
			return sdkerrors.Wrap(
				types.ErrInvalid,
				fmt.Sprintf("ERC20 name %s does not match denom display %s", claim.Name, metadata.Description))
		}

		if claim.Symbol != metadata.Display {
			return sdkerrors.Wrap(
				types.ErrInvalid,
				fmt.Sprintf("ERC20 symbol %s does not match denom display %s", claim.Symbol, metadata.Display))
		}

		// ERC20 tokens use a very simple mechanism to tell you where to display the decimal point.
		// The "decimals" field simply tells you how many decimal places there will be.
		// Cosmos denoms have a system that is much more full featured, with enterprise-ready token denominations.
		// There is a DenomUnits array that tells you what the name of each denomination of the
		// token is.
		// To correlate this with an ERC20 "decimals" field, we have to search through the DenomUnits array
		// to find the DenomUnit which matches up to the main token "display" value. Then we take the
		// "exponent" from this DenomUnit.
		// If the correct DenomUnit is not found, it will default to 0. This will result in there being no decimal places
		// in the token's ERC20 on Ethereum. So, for example, if this happened with Atom, 1 Atom would appear on Ethereum
		// as 1 million Atoms, having 6 extra places before the decimal point.
		// This will only happen with a Denom Metadata which is for all intents and purposes invalid, but I am not sure
		// this is checked for at any other point.
		decimals := uint32(0)
		for _, denomUnit := range metadata.DenomUnits {
			if denomUnit.Denom == metadata.Display {
				decimals = denomUnit.Exponent
				break
			}
		}

		if decimals != uint32(claim.Decimals) {
			return sdkerrors.Wrap(
				types.ErrInvalid,
				fmt.Sprintf("ERC20 decimals %d does not match denom decimals %d", claim.Decimals, decimals))
		}

		// Add to denom-erc20 mapping
		a.keeper.setCosmosOriginatedDenomToERC20(ctx, claim.CosmosDenom, claim.TokenContract)
	case *types.MsgValsetUpdatedClaim:
		// TODO here we should check the contents of the validator set against
		// the store, if they differ we should take some action to indicate to the
		// user that bridge highjacking has occurred
		a.keeper.SetLastObservedValset(ctx, types.Valset{
			Nonce:        claim.ValsetNonce,
			Members:      claim.Members,
			Height:       0,
			RewardAmount: claim.RewardAmount,
			RewardToken:  claim.RewardToken,
		})
		// if the reward is greater than zero and the reward token
		// is valid then some reward was issued by this validator set
		// and we need to either add to the total tokens for a Cosmos native
		// token, or burn non cosmos native tokens
		if claim.RewardAmount.GT(sdk.ZeroInt()) && claim.RewardToken != "0x0000000000000000000000000000000000000000" {
			// Check if coin is Cosmos-originated asset and get denom
			isCosmosOriginated, denom := a.keeper.ERC20ToDenomLookup(ctx, claim.RewardToken)
			if isCosmosOriginated {
				// If it is cosmos originated, mint some coins to account
				// for coins that now exist on Ethereum and may eventually come
				// back to Cosmos.
				//
				// Note the flow is
				// user relays valset and gets reward -> event relayed to cosmos mints tokens to module
				// -> user sends tokens to cosmos and gets the minted tokens from the module
				//
				// it is not possible for this to be a race condition thanks to the event nonces
				// no matter how long it takes to relay the valset updated event the deposit event
				// for the user will always come after.
				//
				// Note we are minting based on the claim! This is important as the reward value
				// could change between when this event occurred and the present
				coins := sdk.Coins{sdk.NewCoin(denom, claim.RewardAmount)}
				a.bankKeeper.MintCoins(ctx, types.ModuleName, coins)
			} else {
				// // If it is not cosmos originated, burn the coins (aka Vouchers)
				// // so that we don't think we have more in the bridge than we actually do
				// coins := sdk.Coins{sdk.NewCoin(denom, claim.RewardAmount)}
				// a.bankKeeper.BurnCoins(ctx, types.ModuleName, coins)

				// if you want to issue Ethereum originated tokens remove this panic and uncomment
				// the above code but note that you will have to constantly replenish the tokens in the
				// module or your chain will eventually halt.
				panic("Can not use Ethereum originated token as reward!")
			}
		}

	default:
		panic(fmt.Sprintf("Invalid event type for attestations %s", claim.GetType()))
	}
	return nil
}
