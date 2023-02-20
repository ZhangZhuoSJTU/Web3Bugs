package keeper

import (
	"bytes"
	"fmt"
	"testing"

	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

//nolint: exhaustivestruct
func TestPrefixRange(t *testing.T) {
	cases := map[string]struct {
		src      []byte
		expStart []byte
		expEnd   []byte
		expPanic bool
	}{
		"normal":              {src: []byte{1, 3, 4}, expStart: []byte{1, 3, 4}, expEnd: []byte{1, 3, 5}},
		"normal short":        {src: []byte{79}, expStart: []byte{79}, expEnd: []byte{80}},
		"empty case":          {src: []byte{}},
		"roll-over example 1": {src: []byte{17, 28, 255}, expStart: []byte{17, 28, 255}, expEnd: []byte{17, 29, 0}},
		"roll-over example 2": {src: []byte{15, 42, 255, 255},
			expStart: []byte{15, 42, 255, 255}, expEnd: []byte{15, 43, 0, 0}},
		"pathological roll-over": {src: []byte{255, 255, 255, 255}, expStart: []byte{255, 255, 255, 255}},
		"nil prohibited":         {expPanic: true},
	}

	for testName, tc := range cases {
		tc := tc
		t.Run(testName, func(t *testing.T) {
			if tc.expPanic {
				require.Panics(t, func() {
					prefixRange(tc.src)
				})
				return
			}
			start, end := prefixRange(tc.src)
			assert.Equal(t, tc.expStart, start)
			assert.Equal(t, tc.expEnd, end)
		})
	}
}

//nolint: exhaustivestruct
func TestCurrentValsetNormalization(t *testing.T) {
	specs := map[string]struct {
		srcPowers []uint64
		expPowers []uint64
	}{
		"one": {
			srcPowers: []uint64{100},
			expPowers: []uint64{4294967295},
		},
		"two": {
			srcPowers: []uint64{100, 1},
			expPowers: []uint64{4252442866, 42524428},
		},
	}
	input := CreateTestEnv(t)
	ctx := input.Context
	for msg, spec := range specs {
		spec := spec
		t.Run(msg, func(t *testing.T) {
			operators := make([]MockStakingValidatorData, len(spec.srcPowers))
			for i, v := range spec.srcPowers {
				cAddr := bytes.Repeat([]byte{byte(i)}, sdk.AddrLen)
				operators[i] = MockStakingValidatorData{
					// any unique addr
					Operator: cAddr,
					Power:    int64(v),
				}
				input.GravityKeeper.SetEthAddressForValidator(ctx, cAddr, "0xf71402f886b45c134743F4c00750823Bbf5Fd045")
			}
			input.GravityKeeper.StakingKeeper = NewStakingKeeperWeightedMock(operators...)
			r := input.GravityKeeper.GetCurrentValset(ctx)
			assert.Equal(t, spec.expPowers, types.BridgeValidators(r.Members).GetPowers())
		})
	}
}

//nolint: exhaustivestruct
func TestAttestationIterator(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context
	// add some attestations to the store

	att1 := &types.Attestation{
		Observed: true,
		Votes:    []string{},
	}
	dep1 := &types.MsgSendToCosmosClaim{
		EventNonce:     1,
		TokenContract:  TokenContractAddrs[0],
		Amount:         sdk.NewInt(100),
		EthereumSender: EthAddrs[0].String(),
		CosmosReceiver: AccAddrs[0].String(),
		Orchestrator:   AccAddrs[0].String(),
	}
	att2 := &types.Attestation{
		Observed: true,
		Votes:    []string{},
	}
	dep2 := &types.MsgSendToCosmosClaim{
		EventNonce:     2,
		TokenContract:  TokenContractAddrs[0],
		Amount:         sdk.NewInt(100),
		EthereumSender: EthAddrs[0].String(),
		CosmosReceiver: AccAddrs[0].String(),
		Orchestrator:   AccAddrs[0].String(),
	}
	input.GravityKeeper.SetAttestation(ctx, dep1.EventNonce, dep1.ClaimHash(), att1)
	input.GravityKeeper.SetAttestation(ctx, dep2.EventNonce, dep2.ClaimHash(), att2)

	atts := []types.Attestation{}
	input.GravityKeeper.IterateAttestaions(ctx, func(_ []byte, att types.Attestation) bool {
		atts = append(atts, att)
		return false
	})

	require.Len(t, atts, 2)
}

//nolint: exhaustivestruct
func TestDelegateKeys(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context
	k := input.GravityKeeper
	var (
		ethAddrs = []string{"0x3146D2d6Eed46Afa423969f5dDC3152DfC359b09",
			"0x610277F0208D342C576b991daFdCb36E36515e76", "0x835973768750b3ED2D5c3EF5AdcD5eDb44d12aD4",
			"0xb2A7F3E84F8FdcA1da46c810AEa110dd96BAE6bF"}

		valAddrs = []string{"cosmosvaloper1jpz0ahls2chajf78nkqczdwwuqcu97w6z3plt4",
			"cosmosvaloper15n79nty2fj37ant3p2gj4wju4ls6eu6tjwmdt0", "cosmosvaloper16dnkc6ac6ruuyr6l372fc3p77jgjpet6fka0cq",
			"cosmosvaloper1vrptwhl3ht2txmzy28j9msqkcvmn8gjz507pgu"}

		orchAddrs = []string{"cosmos1g0etv93428tvxqftnmj25jn06mz6dtdasj5nz7", "cosmos1rhfs24tlw4na04v35tzmjncy785kkw9j27d5kx",
			"cosmos10upq3tmt04zf55f6hw67m0uyrda3mp722q70rw", "cosmos1nt2uwjh5peg9vz2wfh2m3jjwqnu9kpjlhgpmen"}
	)

	for i := range ethAddrs {
		// set some addresses
		val, err1 := sdk.ValAddressFromBech32(valAddrs[i])
		orch, err2 := sdk.AccAddressFromBech32(orchAddrs[i])
		require.NoError(t, err1)
		require.NoError(t, err2)
		// set the orchestrator address
		k.SetOrchestratorValidator(ctx, val, orch)
		// set the ethereum address
		k.SetEthAddressForValidator(ctx, val, ethAddrs[i])
	}

	addresses := k.GetDelegateKeys(ctx)
	for i := range addresses {
		res := addresses[i]
		assert.Equal(t, valAddrs[i], res.Validator)
		assert.Equal(t, orchAddrs[i], res.Orchestrator)
		assert.Equal(t, ethAddrs[i], res.EthAddress)
	}

}

//nolint: exhaustivestruct
func TestLastSlashedValsetNonce(t *testing.T) {
	input := CreateTestEnv(t)
	k := input.GravityKeeper
	ctx := input.Context

	vs := k.GetCurrentValset(ctx)

	i := 1
	for ; i < 10; i++ {
		vs.Height = uint64(i)
		vs.Nonce = uint64(i)
		k.StoreValsetUnsafe(ctx, vs)
	}

	latestValsetNonce := k.GetLatestValsetNonce(ctx)
	assert.Equal(t, latestValsetNonce, uint64(i-1))

	//  lastSlashedValsetNonce should be zero initially.
	lastSlashedValsetNonce := k.GetLastSlashedValsetNonce(ctx)
	assert.Equal(t, lastSlashedValsetNonce, uint64(0))
	unslashedValsets := k.GetUnSlashedValsets(ctx, uint64(12))
	assert.Equal(t, len(unslashedValsets), 9)

	// check if last Slashed Valset nonce is set properly or not
	k.SetLastSlashedValsetNonce(ctx, uint64(3))
	lastSlashedValsetNonce = k.GetLastSlashedValsetNonce(ctx)
	assert.Equal(t, lastSlashedValsetNonce, uint64(3))

	lastSlashedValset := k.GetValset(ctx, lastSlashedValsetNonce)

	// when valset height + signedValsetsWindow > current block height, len(unslashedValsets) should be zero
	unslashedValsets = k.GetUnSlashedValsets(ctx, uint64(ctx.BlockHeight()))
	assert.Equal(t, len(unslashedValsets), 0)

	// when lastSlashedValset height + signedValsetsWindow == BlockHeight, len(unslashedValsets) should be zero
	heightDiff := uint64(ctx.BlockHeight()) - lastSlashedValset.Height
	unslashedValsets = k.GetUnSlashedValsets(ctx, heightDiff)
	assert.Equal(t, len(unslashedValsets), 0)

	// when signedValsetsWindow is between lastSlashedValset height and latest valset's height
	unslashedValsets = k.GetUnSlashedValsets(ctx, heightDiff-2)
	assert.Equal(t, len(unslashedValsets), 2)

	// when signedValsetsWindow > latest valset's height
	unslashedValsets = k.GetUnSlashedValsets(ctx, heightDiff-6)
	assert.Equal(t, len(unslashedValsets), 6)
	fmt.Println("unslashedValsetsRange", unslashedValsets)
}
