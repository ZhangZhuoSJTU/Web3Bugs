package gravity

import (
	"testing"

	sdk "github.com/cosmos/cosmos-sdk/types"
	bank "github.com/cosmos/cosmos-sdk/x/bank/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/keeper"
	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

// Have the validators put in a erc20<>denom relation with ERC20DeployedEvent
// Send some coins of that denom into the cosmos module
// Check that the coins are locked, not burned
// Have the validators put in a deposit event for that ERC20
// Check that the coins are unlocked and sent to the right account

func TestCosmosOriginated(t *testing.T) {
	tv := initializeTestingVars(t)
	addDenomToERC20Relation(tv)
	lockCoinsInModule(tv)
	acceptDepositEvent(tv)
}

type testingVars struct {
	myOrchestratorAddr sdk.AccAddress
	myValAddr          sdk.ValAddress
	erc20              string
	denom              string
	input              keeper.TestInput
	ctx                sdk.Context
	h                  sdk.Handler
	t                  *testing.T
}

func initializeTestingVars(t *testing.T) *testingVars {
	var tv testingVars

	tv.t = t

	tv.myOrchestratorAddr = make([]byte, sdk.AddrLen)
	tv.myValAddr = sdk.ValAddress(tv.myOrchestratorAddr) // revisit when proper mapping is impl in keeper

	tv.erc20 = "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e"
	tv.denom = "uatom"

	tv.input = keeper.CreateTestEnv(t)
	tv.ctx = tv.input.Context
	tv.input.GravityKeeper.StakingKeeper = keeper.NewStakingKeeperMock(tv.myValAddr)
	tv.input.GravityKeeper.SetOrchestratorValidator(tv.ctx, tv.myValAddr, tv.myOrchestratorAddr)
	tv.h = NewHandler(tv.input.GravityKeeper)

	return &tv
}

func addDenomToERC20Relation(tv *testingVars) {
	tv.input.BankKeeper.SetDenomMetaData(tv.ctx, bank.Metadata{
		Description: "The native staking token of the Cosmos Hub.",
		DenomUnits: []*bank.DenomUnit{
			{Denom: "uatom", Exponent: uint32(0), Aliases: []string{"microatom"}},
			{Denom: "matom", Exponent: uint32(3), Aliases: []string{"milliatom"}},
			{Denom: "atom", Exponent: uint32(6), Aliases: []string{}},
		},
		Base:    "uatom",
		Display: "atom",
	})

	var (
		myNonce = uint64(1)
	)

	ethClaim := types.MsgERC20DeployedClaim{
		EventNonce:    myNonce,
		BlockHeight:   0,
		CosmosDenom:   tv.denom,
		TokenContract: tv.erc20,
		Name:          "atom",
		Symbol:        "atom",
		Decimals:      6,
		Orchestrator:  tv.myOrchestratorAddr.String(),
	}

	_, err := tv.h(tv.ctx, &ethClaim)
	require.NoError(tv.t, err)

	EndBlocker(tv.ctx, tv.input.GravityKeeper)

	// check if attestation persisted
	a := tv.input.GravityKeeper.GetAttestation(tv.ctx, myNonce, ethClaim.ClaimHash())
	require.NotNil(tv.t, a)

	// check if erc20<>denom relation added to db
	isCosmosOriginated, gotERC20, err := tv.input.GravityKeeper.DenomToERC20Lookup(tv.ctx, tv.denom)
	require.NoError(tv.t, err)
	assert.True(tv.t, isCosmosOriginated)

	isCosmosOriginated, gotDenom := tv.input.GravityKeeper.ERC20ToDenomLookup(tv.ctx, tv.erc20)
	assert.True(tv.t, isCosmosOriginated)

	assert.Equal(tv.t, tv.denom, gotDenom)
	assert.Equal(tv.t, tv.erc20, gotERC20)
}

func lockCoinsInModule(tv *testingVars) {
	var (
		userCosmosAddr, _            = sdk.AccAddressFromBech32("cosmos1990z7dqsvh8gthw9pa5sn4wuy2xrsd80mg5z6y")
		denom                        = "uatom"
		startingCoinAmount sdk.Int   = sdk.NewIntFromUint64(150)
		sendAmount         sdk.Int   = sdk.NewIntFromUint64(50)
		feeAmount          sdk.Int   = sdk.NewIntFromUint64(5)
		startingCoins      sdk.Coins = sdk.Coins{sdk.NewCoin(denom, startingCoinAmount)}
		sendingCoin        sdk.Coin  = sdk.NewCoin(denom, sendAmount)
		feeCoin            sdk.Coin  = sdk.NewCoin(denom, feeAmount)
		ethDestination               = "0x3c9289da00b02dC623d0D8D907619890301D26d4"
	)

	// we start by depositing some funds into the users balance to send
	tv.input.BankKeeper.MintCoins(tv.ctx, types.ModuleName, startingCoins)
	tv.input.BankKeeper.SendCoinsFromModuleToAccount(tv.ctx, types.ModuleName, userCosmosAddr, startingCoins)
	balance1 := tv.input.BankKeeper.GetAllBalances(tv.ctx, userCosmosAddr)
	assert.Equal(tv.t, sdk.Coins{sdk.NewCoin(denom, startingCoinAmount)}, balance1)

	// send some coins
	msg := &types.MsgSendToEth{
		Sender:    userCosmosAddr.String(),
		EthDest:   ethDestination,
		Amount:    sendingCoin,
		BridgeFee: feeCoin,
	}

	_, err := tv.h(tv.ctx, msg)
	require.NoError(tv.t, err)

	// Check that user balance has gone down
	balance2 := tv.input.BankKeeper.GetAllBalances(tv.ctx, userCosmosAddr)
	assert.Equal(tv.t, sdk.Coins{sdk.NewCoin(denom, startingCoinAmount.Sub(sendAmount).Sub(feeAmount))}, balance2)

	// Check that gravity balance has gone up
	gravityAddr := tv.input.AccountKeeper.GetModuleAddress(types.ModuleName)
	assert.Equal(tv.t,
		sdk.Coins{sdk.NewCoin(denom, sendAmount.Add(feeAmount))},
		tv.input.BankKeeper.GetAllBalances(tv.ctx, gravityAddr),
	)
}

func acceptDepositEvent(tv *testingVars) {
	var (
		myOrchestratorAddr sdk.AccAddress = make([]byte, sdk.AddrLen)
		myCosmosAddr, _                   = sdk.AccAddressFromBech32("cosmos16ahjkfqxpp6lvfy9fpfnfjg39xr96qett0alj5")
		myNonce                           = uint64(2)
		anyETHAddr                        = "0xf9613b532673Cc223aBa451dFA8539B87e1F666D"
	)

	myErc20 := types.ERC20Token{
		Amount:   sdk.NewInt(12),
		Contract: tv.erc20,
	}

	ethClaim := types.MsgSendToCosmosClaim{
		EventNonce:     myNonce,
		BlockHeight:    0,
		TokenContract:  myErc20.Contract,
		Amount:         myErc20.Amount,
		EthereumSender: anyETHAddr,
		CosmosReceiver: myCosmosAddr.String(),
		Orchestrator:   myOrchestratorAddr.String(),
	}

	_, err := tv.h(tv.ctx, &ethClaim)
	require.NoError(tv.t, err)
	EndBlocker(tv.ctx, tv.input.GravityKeeper)

	// check that attestation persisted
	a := tv.input.GravityKeeper.GetAttestation(tv.ctx, myNonce, ethClaim.ClaimHash())
	require.NotNil(tv.t, a)

	// Check that user balance has gone up
	assert.Equal(tv.t,
		sdk.Coins{sdk.NewCoin(tv.denom, myErc20.Amount)},
		tv.input.BankKeeper.GetAllBalances(tv.ctx, myCosmosAddr))

	// Check that gravity balance has gone down
	gravityAddr := tv.input.AccountKeeper.GetModuleAddress(types.ModuleName)
	assert.Equal(tv.t,
		sdk.Coins{sdk.NewCoin(tv.denom, sdk.NewIntFromUint64(55).Sub(myErc20.Amount))},
		tv.input.BankKeeper.GetAllBalances(tv.ctx, gravityAddr),
	)
}
