package types

import (
	"testing"

	types "github.com/cosmos/cosmos-sdk/types"
	"github.com/stretchr/testify/require"
)

func TestGenesisStateValidate(t *testing.T) {
	specs := map[string]struct {
		src    *GenesisState
		expErr bool
	}{
		"default params": {src: DefaultGenesisState(), expErr: false},
		"empty params": {src: &GenesisState{
			Params: &Params{
				GravityId:                    "",
				ContractSourceHash:           "",
				BridgeEthereumAddress:        "",
				BridgeChainId:                0,
				SignedValsetsWindow:          0,
				SignedBatchesWindow:          0,
				SignedLogicCallsWindow:       0,
				TargetBatchTimeout:           0,
				AverageBlockTime:             0,
				AverageEthereumBlockTime:     0,
				SlashFractionValset:          types.Dec{},
				SlashFractionBatch:           types.Dec{},
				SlashFractionLogicCall:       types.Dec{},
				UnbondSlashingValsetsWindow:  0,
				SlashFractionBadEthSignature: types.Dec{},
				ValsetReward: types.Coin{
					Denom:  "",
					Amount: types.Int{},
				},
			},
			LastObservedNonce:  0,
			Valsets:            []*Valset{},
			ValsetConfirms:     []*MsgValsetConfirm{},
			Batches:            []*OutgoingTxBatch{},
			BatchConfirms:      []MsgConfirmBatch{},
			LogicCalls:         []*OutgoingLogicCall{},
			LogicCallConfirms:  []MsgConfirmLogicCall{},
			Attestations:       []Attestation{},
			DelegateKeys:       []*MsgSetOrchestratorAddress{},
			Erc20ToDenoms:      []*ERC20ToDenom{},
			UnbatchedTransfers: []*OutgoingTransferTx{},
		}, expErr: true},
		"invalid params": {src: &GenesisState{
			Params: &Params{
				GravityId:                    "foo",
				ContractSourceHash:           "laksdjflasdkfja",
				BridgeEthereumAddress:        "invalid-eth-address",
				BridgeChainId:                3279089,
				SignedValsetsWindow:          0,
				SignedBatchesWindow:          0,
				SignedLogicCallsWindow:       0,
				TargetBatchTimeout:           0,
				AverageBlockTime:             0,
				AverageEthereumBlockTime:     0,
				SlashFractionValset:          types.Dec{},
				SlashFractionBatch:           types.Dec{},
				SlashFractionLogicCall:       types.Dec{},
				UnbondSlashingValsetsWindow:  0,
				SlashFractionBadEthSignature: types.Dec{},
				ValsetReward: types.Coin{
					Denom:  "",
					Amount: types.Int{},
				},
			},
			LastObservedNonce:  0,
			Valsets:            []*Valset{},
			ValsetConfirms:     []*MsgValsetConfirm{},
			Batches:            []*OutgoingTxBatch{},
			BatchConfirms:      []MsgConfirmBatch{},
			LogicCalls:         []*OutgoingLogicCall{},
			LogicCallConfirms:  []MsgConfirmLogicCall{},
			Attestations:       []Attestation{},
			DelegateKeys:       []*MsgSetOrchestratorAddress{},
			Erc20ToDenoms:      []*ERC20ToDenom{},
			UnbatchedTransfers: []*OutgoingTransferTx{},
		}, expErr: true},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			err := spec.src.ValidateBasic()
			if spec.expErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestStringToByteArray(t *testing.T) {
	specs := map[string]struct {
		testString string
		expErr     bool
	}{
		"16 bytes": {"lakjsdflaksdjfds", false},
		"32 bytes": {"lakjsdflaksdjfdslakjsdflaksdjfds", false},
		"33 bytes": {"€€€€€€€€€€€", true},
	}

	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			_, err := strToFixByteArray(spec.testString)
			if spec.expErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}
