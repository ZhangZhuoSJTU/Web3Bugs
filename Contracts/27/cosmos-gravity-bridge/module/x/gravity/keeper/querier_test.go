package keeper

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/cosmos/cosmos-sdk/codec"
	sdk "github.com/cosmos/cosmos-sdk/types"
	gethcommon "github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

//nolint: exhaustivestruct
func TestQueryValsetConfirm(t *testing.T) {
	var (
		nonce                                       = uint64(1)
		myValidatorCosmosAddr, _                    = sdk.AccAddressFromBech32("cosmos1ees2tqhhhm9ahlhceh2zdguww9lqn2ckukn86l")
		myValidatorEthereumAddr  gethcommon.Address = gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(50)}, 20))
	)
	input := CreateTestEnv(t)
	ctx := input.Context
	input.GravityKeeper.SetValsetConfirm(ctx, types.MsgValsetConfirm{
		Nonce:        nonce,
		Orchestrator: myValidatorCosmosAddr.String(),
		EthAddress:   myValidatorEthereumAddr.String(),
		Signature:    "alksdjhflkasjdfoiasjdfiasjdfoiasdj",
	})

	specs := map[string]struct {
		srcNonce string
		srcAddr  string
		expErr   bool
		expResp  []byte
	}{
		"all good": {
			srcNonce: "1",
			srcAddr:  myValidatorCosmosAddr.String(),
			expResp:  []byte(`{"type":"gravity/MsgValsetConfirm", "value":{"eth_address":"0x3232323232323232323232323232323232323232", "nonce": "1", "orchestrator": "cosmos1ees2tqhhhm9ahlhceh2zdguww9lqn2ckukn86l",  "signature": "alksdjhflkasjdfoiasjdfiasjdfoiasdj"}}`),
		},
		"unknown nonce": {
			srcNonce: "999999",
			srcAddr:  myValidatorCosmosAddr.String(),
		},
		"invalid address": {
			srcNonce: "1",
			srcAddr:  "not a valid addr",
			expErr:   true,
		},
		"invalid nonce": {
			srcNonce: "not a valid nonce",
			srcAddr:  myValidatorCosmosAddr.String(),
			expErr:   true,
		},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			got, err := queryValsetConfirm(ctx, []string{spec.srcNonce, spec.srcAddr}, input.GravityKeeper)
			if spec.expErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if spec.expResp == nil {
				assert.Nil(t, got)
				return
			}
			assert.JSONEq(t, string(spec.expResp), string(got))
		})
	}
}

//nolint: exhaustivestruct
func TestAllValsetConfirmsBynonce(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	addrs := []string{
		"cosmos1u508cfnsk2nhakv80vdtq3nf558ngyvldkfjj9",
		"cosmos1krtcsrxhadj54px0vy6j33pjuzcd3jj8kmsazv",
		"cosmos1u94xef3cp9thkcpxecuvhtpwnmg8mhlja8hzkd",
	}
	// seed confirmations
	for i := 0; i < 3; i++ {
		addr, _ := sdk.AccAddressFromBech32(addrs[i])
		msg := types.MsgValsetConfirm{}
		msg.EthAddress = gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(i + 1)}, 20)).String()
		msg.Nonce = uint64(1)
		msg.Orchestrator = addr.String()
		msg.Signature = fmt.Sprintf("signature %d", i+1)
		input.GravityKeeper.SetValsetConfirm(ctx, msg)
	}

	specs := map[string]struct {
		srcNonce string
		expErr   bool
		expResp  []byte
	}{
		"all good": {
			srcNonce: "1",
			expResp: []byte(`[
      {"eth_address":"0x0202020202020202020202020202020202020202", "nonce": "1", "orchestrator": "cosmos1krtcsrxhadj54px0vy6j33pjuzcd3jj8kmsazv", "signature": "signature 2"},
	  {"eth_address":"0x0303030303030303030303030303030303030303", "nonce": "1", "orchestrator": "cosmos1u94xef3cp9thkcpxecuvhtpwnmg8mhlja8hzkd", "signature": "signature 3"},
	  {"eth_address":"0x0101010101010101010101010101010101010101", "nonce": "1", "orchestrator": "cosmos1u508cfnsk2nhakv80vdtq3nf558ngyvldkfjj9", "signature": "signature 1"}
]`),
		},
		"unknown nonce": {
			srcNonce: "999999",
			expResp:  nil,
		},
		"invalid nonce": {
			srcNonce: "not a valid nonce",
			expErr:   true,
		},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			got, err := queryAllValsetConfirms(ctx, spec.srcNonce, input.GravityKeeper)
			if spec.expErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			if spec.expResp == nil {
				assert.Nil(t, got)
				return
			}
			assert.JSONEq(t, string(spec.expResp), string(got))
		})
	}
}

// TODO: Check failure modes
//nolint: exhaustivestruct
func TestLastValsetRequests(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context
	// seed with maxValsetRequestsReturns + 1 requests
	for i := 0; i < maxValsetRequestsReturned+1; i++ {
		var validators []sdk.ValAddress
		for j := 0; j <= i; j++ {
			// add an validator each block
			valAddr := bytes.Repeat([]byte{byte(j)}, sdk.AddrLen)
			input.GravityKeeper.SetEthAddressForValidator(ctx, valAddr, gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(j + 1)}, 20)).String())
			validators = append(validators, valAddr)
		}
		input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(validators...)
		ctx = ctx.WithBlockHeight(int64(100 + i))
		input.GravityKeeper.SetValsetRequest(ctx)
	}

	specs := map[string]struct {
		expResp []byte
	}{ // Expect only maxValsetRequestsReturns back
		"limit at 5": {
			expResp: []byte(`[
{
  "nonce": "6",
  "height": "105",
  "reward_amount": "0",
  "reward_token": "0x0000000000000000000000000000000000000000",
  "members": [
    {
      "power": "715827882",
      "ethereum_address": "0x0101010101010101010101010101010101010101"
    },
    {
      "power": "715827882",
      "ethereum_address": "0x0202020202020202020202020202020202020202"
    },
    {
      "power": "715827882",
      "ethereum_address": "0x0303030303030303030303030303030303030303"
    },
    {
      "power": "715827882",
      "ethereum_address": "0x0404040404040404040404040404040404040404"
    },
    {
      "power": "715827882",
      "ethereum_address": "0x0505050505050505050505050505050505050505"
    },
    {
      "power": "715827882",
      "ethereum_address": "0x0606060606060606060606060606060606060606"
    }
  ]
},
{
  "nonce": "5",
  "height": "104",
  "reward_amount": "0",
  "reward_token": "0x0000000000000000000000000000000000000000",
  "members": [
    {
      "power": "858993459",
      "ethereum_address": "0x0101010101010101010101010101010101010101"
    },
    {
      "power": "858993459",
      "ethereum_address": "0x0202020202020202020202020202020202020202"
    },
    {
      "power": "858993459",
      "ethereum_address": "0x0303030303030303030303030303030303030303"
    },
    {
      "power": "858993459",
      "ethereum_address": "0x0404040404040404040404040404040404040404"
    },
    {
      "power": "858993459",
      "ethereum_address": "0x0505050505050505050505050505050505050505"
    }
  ]
},
{
  "nonce": "4",
  "height": "103",
  "reward_amount": "0",
  "reward_token": "0x0000000000000000000000000000000000000000",
  "members": [
    {
      "power": "1073741823",
      "ethereum_address": "0x0101010101010101010101010101010101010101"
    },
    {
      "power": "1073741823",
      "ethereum_address": "0x0202020202020202020202020202020202020202"
    },
    {
      "power": "1073741823",
      "ethereum_address": "0x0303030303030303030303030303030303030303"
    },
    {
      "power": "1073741823",
      "ethereum_address": "0x0404040404040404040404040404040404040404"
    }
  ]
},
{
  "nonce": "3",
  "height": "102",
  "reward_amount": "0",
  "reward_token": "0x0000000000000000000000000000000000000000",
  "members": [
    {
      "power": "1431655765",
      "ethereum_address": "0x0101010101010101010101010101010101010101"
    },
    {
      "power": "1431655765",
      "ethereum_address": "0x0202020202020202020202020202020202020202"
    },
    {
      "power": "1431655765",
      "ethereum_address": "0x0303030303030303030303030303030303030303"
    }
  ]
},
{
  "nonce": "2",
  "height": "101",
  "reward_amount": "0",
  "reward_token": "0x0000000000000000000000000000000000000000",
  "members": [
    {
      "power": "2147483647",
      "ethereum_address": "0x0101010101010101010101010101010101010101"
    },
    {
      "power": "2147483647",
      "ethereum_address": "0x0202020202020202020202020202020202020202"
    }
  ]
}
]`),
		},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			got, err := lastValsetRequests(ctx, input.GravityKeeper)
			require.NoError(t, err)
			assert.JSONEq(t, string(spec.expResp), string(got), string(got))
		})
	}
}

//nolint: exhaustivestruct
// TODO: check that it doesn't accidently return a valset that HAS been signed
// Right now it is basically just testing that any valset comes back
func TestPendingValsetRequests(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	// seed with requests
	for i := 0; i < 6; i++ {
		var validators []sdk.ValAddress
		for j := 0; j <= i; j++ {
			// add an validator each block
			valAddr := bytes.Repeat([]byte{byte(j)}, sdk.AddrLen)
			input.GravityKeeper.SetEthAddressForValidator(ctx, valAddr, gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(j + 1)}, 20)).String())
			validators = append(validators, valAddr)
		}
		input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(validators...)
		ctx = ctx.WithBlockHeight(int64(100 + i))
		input.GravityKeeper.SetValsetRequest(ctx)
	}

	specs := map[string]struct {
		expResp []byte
	}{
		"find valset": {
			expResp: []byte(`[
                                  {
                                    "nonce": "6",
                                    "members": [
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      },
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0202020202020202020202020202020202020202"
                                      },
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0303030303030303030303030303030303030303"
                                      },
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0404040404040404040404040404040404040404"
                                      },
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0505050505050505050505050505050505050505"
                                      },
                                      {
                                        "power": "715827882",
                                        "ethereum_address": "0x0606060606060606060606060606060606060606"
                                      }
                                    ],
                                    "height": "105",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  },
                                  {
                                    "nonce": "5",
                                    "members": [
                                      {
                                        "power": "858993459",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      },
                                      {
                                        "power": "858993459",
                                        "ethereum_address": "0x0202020202020202020202020202020202020202"
                                      },
                                      {
                                        "power": "858993459",
                                        "ethereum_address": "0x0303030303030303030303030303030303030303"
                                      },
                                      {
                                        "power": "858993459",
                                        "ethereum_address": "0x0404040404040404040404040404040404040404"
                                      },
                                      {
                                        "power": "858993459",
                                        "ethereum_address": "0x0505050505050505050505050505050505050505"
                                      }
                                    ],
                                    "height": "104",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  },
                                  {
                                    "nonce": "4",
                                    "members": [
                                      {
                                        "power": "1073741823",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      },
                                      {
                                        "power": "1073741823",
                                        "ethereum_address": "0x0202020202020202020202020202020202020202"
                                      },
                                      {
                                        "power": "1073741823",
                                        "ethereum_address": "0x0303030303030303030303030303030303030303"
                                      },
                                      {
                                        "power": "1073741823",
                                        "ethereum_address": "0x0404040404040404040404040404040404040404"
                                      }
                                    ],
                                    "height": "103",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  },
                                  {
                                    "nonce": "3",
                                    "members": [
                                      {
                                        "power": "1431655765",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      },
                                      {
                                        "power": "1431655765",
                                        "ethereum_address": "0x0202020202020202020202020202020202020202"
                                      },
                                      {
                                        "power": "1431655765",
                                        "ethereum_address": "0x0303030303030303030303030303030303030303"
                                      }
                                    ],
                                    "height": "102",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  },
                                  {
                                    "nonce": "2",
                                    "members": [
                                      {
                                        "power": "2147483647",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      },
                                      {
                                        "power": "2147483647",
                                        "ethereum_address": "0x0202020202020202020202020202020202020202"
                                      }
                                    ],
                                    "height": "101",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  },
                                  {
                                    "nonce": "1",
                                    "members": [
                                      {
                                        "power": "4294967295",
                                        "ethereum_address": "0x0101010101010101010101010101010101010101"
                                      }
                                    ],
                                    "height": "100",
									"reward_amount": "0",
                                    "reward_token": "0x0000000000000000000000000000000000000000"
                                  }
                                ]`),
		},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			var valAddr sdk.AccAddress = bytes.Repeat([]byte{byte(1)}, sdk.AddrLen)
			got, err := lastPendingValsetRequest(ctx, valAddr.String(), input.GravityKeeper)
			require.NoError(t, err)
			assert.JSONEq(t, string(spec.expResp), string(got), string(got))
		})
	}
}

//nolint: exhaustivestruct
// TODO: check that it actually returns a batch that has NOT been signed, not just any batch
func TestLastPendingBatchRequest(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	// seed with valset requests and eth addresses to make validators
	// that we will later use to lookup batches to be signed
	for i := 0; i < 6; i++ {
		var validators []sdk.ValAddress
		for j := 0; j <= i; j++ {
			// add an validator each block
			// TODO: replace with real SDK addresses
			valAddr := bytes.Repeat([]byte{byte(j)}, sdk.AddrLen)
			input.GravityKeeper.SetEthAddressForValidator(ctx, valAddr, gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(j + 1)}, 20)).String())
			validators = append(validators, valAddr)
		}
		input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(validators...)
		input.GravityKeeper.SetValsetRequest(ctx)
	}

	createTestBatch(t, input)

	specs := map[string]struct {
		expResp []byte
	}{
		"find batch": {
			expResp: []byte(`{
	"type": "gravity/OutgoingTxBatch",
	"value": {
	"batch_nonce": "1",
	"block": "1234567",
	"transactions": [
		{
		"id": "2",
		"sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
		"dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
		"erc20_token": {
			"amount": "101",
			"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		},
		"erc20_fee": {
			"amount": "3",
			"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		}
		},
		{
		"id": "3",
		"sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
		"dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
		"erc20_token": {
			"amount": "102",
			"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		},
		"erc20_fee": {
			"amount": "2",
			"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		}
		}
	],
	"token_contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
	}
}
			`,
			)},
	}
	for msg, spec := range specs {
		t.Run(msg, func(t *testing.T) {
			var valAddr sdk.AccAddress = bytes.Repeat([]byte{byte(1)}, sdk.AddrLen)
			got, err := lastPendingBatchRequest(ctx, valAddr.String(), input.GravityKeeper)
			require.NoError(t, err)
			assert.JSONEq(t, string(spec.expResp), string(got), string(got))
		})
	}
}

//nolint: exhaustivestruct
func createTestBatch(t *testing.T, input TestInput) {
	var (
		mySender            = bytes.Repeat([]byte{1}, sdk.AddrLen)
		myReceiver          = "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934"
		myTokenContractAddr = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		now                 = time.Now().UTC()
	)
	// mint some voucher first
	allVouchers := sdk.Coins{types.NewERC20Token(99999, myTokenContractAddr).GravityCoin()}
	err := input.BankKeeper.MintCoins(input.Context, types.ModuleName, allVouchers)
	require.NoError(t, err)

	// set senders balance
	input.AccountKeeper.NewAccountWithAddress(input.Context, mySender)
	err = input.BankKeeper.SetBalances(input.Context, mySender, allVouchers)
	require.NoError(t, err)

	// add some TX to the pool
	for i, v := range []uint64{2, 3, 2, 1} {
		amount := types.NewERC20Token(uint64(i+100), myTokenContractAddr).GravityCoin()
		fee := types.NewERC20Token(v, myTokenContractAddr).GravityCoin()
		_, err = input.GravityKeeper.AddToOutgoingPool(input.Context, mySender, myReceiver, amount, fee)
		require.NoError(t, err)
		// Should create:
		// 1: amount 100, fee 2
		// 2: amount 101, fee 3
		// 3: amount 102, fee 2
		// 4: amount 103, fee 1
	}
	// when
	input.Context = input.Context.WithBlockTime(now)

	// tx batch size is 2, so that some of them stay behind
	_, err = input.GravityKeeper.BuildOutgoingTXBatch(input.Context, myTokenContractAddr, 2)
	require.NoError(t, err)
	// Should have 2 and 3 from above
	// 1 and 4 should be unbatched
}

//nolint: exhaustivestruct
func TestQueryAllBatchConfirms(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	var (
		tokenContract    = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		validatorAddr, _ = sdk.AccAddressFromBech32("cosmos1mgamdcs9dah0vn0gqupl05up7pedg2mvupe6hh")
	)

	input.GravityKeeper.SetBatchConfirm(ctx, &types.MsgConfirmBatch{
		Nonce:         1,
		TokenContract: tokenContract,
		EthSigner:     "0xf35e2cc8e6523d683ed44870f5b7cc785051a77d",
		Orchestrator:  validatorAddr.String(),
		Signature:     "signature",
	})

	batchConfirms, err := queryAllBatchConfirms(ctx, "1", tokenContract, input.GravityKeeper)
	require.NoError(t, err)

	expectedJSON := []byte(`[{"eth_signer":"0xf35e2cc8e6523d683ed44870f5b7cc785051a77d", "nonce":"1", "signature":"signature", "token_contract":"0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", "orchestrator":"cosmos1mgamdcs9dah0vn0gqupl05up7pedg2mvupe6hh"}]`)

	assert.JSONEq(t, string(expectedJSON), string(batchConfirms), "json is equal")
}

//nolint: exhaustivestruct
func TestQueryLogicCalls(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context
	k := input.GravityKeeper
	var (
		logicContract            = "0x510ab76899430424d209a6c9a5b9951fb8a6f47d"
		payload                  = []byte("fake bytes")
		tokenContract            = "0x7580bfe88dd3d07947908fae12d95872a260f2d8"
		invalidationId           = []byte("GravityTesting")
		invalidationNonce uint64 = 1
	)

	// seed with valset requests and eth addresses to make validators
	// that we will later use to lookup calls to be signed
	for i := 0; i < 6; i++ {
		var validators []sdk.ValAddress
		for j := 0; j <= i; j++ {
			// add an validator each block
			// TODO: replace with real SDK addresses
			valAddr := bytes.Repeat([]byte{byte(j)}, sdk.AddrLen)
			input.GravityKeeper.SetEthAddressForValidator(ctx, valAddr, gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(j + 1)}, 20)).String())
			validators = append(validators, valAddr)
		}
		input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(validators...)
	}

	token := []*types.ERC20Token{{
		Contract: tokenContract,
		Amount:   sdk.NewIntFromUint64(5000),
	}}

	call := types.OutgoingLogicCall{
		Transfers:            token,
		Fees:                 token,
		LogicContractAddress: logicContract,
		Payload:              payload,
		Timeout:              10000,
		InvalidationId:       invalidationId,
		InvalidationNonce:    uint64(invalidationNonce),
	}
	k.SetOutgoingLogicCall(ctx, &call)

	res := k.GetOutgoingLogicCall(ctx, invalidationId, invalidationNonce)

	require.Equal(t, call, *res)

	_, err := lastLogicCallRequests(ctx, k)
	require.NoError(t, err)

	var valAddr sdk.AccAddress = bytes.Repeat([]byte{byte(1)}, sdk.AddrLen)
	_, err = lastPendingLogicCallRequest(ctx, valAddr.String(), k)
	require.NoError(t, err)

	require.NoError(t, err)
}

//nolint: exhaustivestruct
func TestQueryLogicCallsConfirms(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context
	k := input.GravityKeeper
	var (
		logicContract            = "0x510ab76899430424d209a6c9a5b9951fb8a6f47d"
		payload                  = []byte("fake bytes")
		tokenContract            = "0x7580bfe88dd3d07947908fae12d95872a260f2d8"
		invalidationId           = []byte("GravityTesting")
		invalidationNonce uint64 = 1
	)

	// seed with valset requests and eth addresses to make validators
	// that we will later use to lookup calls to be signed
	for i := 0; i < 6; i++ {
		var validators []sdk.ValAddress
		for j := 0; j <= i; j++ {
			// add an validator each block
			// TODO: replace with real SDK addresses
			valAddr := bytes.Repeat([]byte{byte(j)}, sdk.AddrLen)
			input.GravityKeeper.SetEthAddressForValidator(ctx, valAddr, gethcommon.BytesToAddress(bytes.Repeat([]byte{byte(j + 1)}, 20)).String())
			validators = append(validators, valAddr)
		}
		input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(validators...)
	}

	token := []*types.ERC20Token{{
		Contract: tokenContract,
		Amount:   sdk.NewIntFromUint64(5000),
	}}

	call := types.OutgoingLogicCall{
		Transfers:            token,
		Fees:                 token,
		LogicContractAddress: logicContract,
		Payload:              payload,
		Timeout:              10000,
		InvalidationId:       invalidationId,
		InvalidationNonce:    uint64(invalidationNonce),
	}
	k.SetOutgoingLogicCall(ctx, &call)

	var valAddr sdk.AccAddress = bytes.Repeat([]byte{byte(1)}, sdk.AddrLen)

	confirm := types.MsgConfirmLogicCall{
		InvalidationId:    hex.EncodeToString(invalidationId),
		InvalidationNonce: 1,
		EthSigner:         "test",
		Orchestrator:      valAddr.String(),
		Signature:         "test",
	}

	k.SetLogicCallConfirm(ctx, &confirm)

	res := k.GetLogicConfirmByInvalidationIDAndNonce(ctx, invalidationId, 1)
	assert.Equal(t, len(res), 1)
}

//nolint: exhaustivestruct
// TODO: test that it gets the correct batch, not just any batch.
// Check with multiple nonces and tokenContracts
func TestQueryBatch(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	var (
		tokenContract = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
	)

	createTestBatch(t, input)

	batch, err := queryBatch(ctx, "1", tokenContract, input.GravityKeeper)
	require.NoError(t, err)

	expectedJSON := []byte(`{
		"type": "gravity/OutgoingTxBatch",
		"value": {
		  "transactions": [
			{
			  "erc20_fee": {
				"amount": "3",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "101",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "2"
			},
			{
			  "erc20_fee": {
				"amount": "2",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "102",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "3"
			}
		  ],
		  "batch_nonce": "1",
		  "block": "1234567",
		  "token_contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		}
	  }
	  `)

	// TODO: this test is failing on the empty representation of valset members
	assert.JSONEq(t, string(expectedJSON), string(batch), string(batch))
}

//nolint: exhaustivestruct
func TestLastBatchesRequest(t *testing.T) {
	input := CreateTestEnv(t)
	ctx := input.Context

	createTestBatch(t, input)
	createTestBatch(t, input)

	lastBatches, err := lastBatchesRequest(ctx, input.GravityKeeper)
	require.NoError(t, err)

	expectedJSON := []byte(`[
		{
		  "transactions": [
			{
			  "erc20_fee": {
				"amount": "3",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "101",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "6"
			},
			{
			  "erc20_fee": {
				"amount": "2",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "102",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "7"
			}
		  ],
		  "batch_nonce": "2",
		  "block": "1234567",
		  "token_contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		},
		{
		  "transactions": [
			{
			  "erc20_fee": {
				"amount": "3",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "101",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "2"
			},
			{
			  "erc20_fee": {
				"amount": "2",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "dest_address": "0x320915BD0F1bad11cBf06e85D5199DBcAC4E9934",
			  "erc20_token": {
				"amount": "102",
				"contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
			  },
			  "sender": "cosmos1qyqszqgpqyqszqgpqyqszqgpqyqszqgpjnp7du",
			  "id": "3"
			}
		  ],
		  "batch_nonce": "1",
		  "block": "1234567",
		  "token_contract": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
		}
	  ]
	  `)

	assert.JSONEq(t, string(expectedJSON), string(lastBatches), "json is equal")
}

//nolint: exhaustivestruct
// tests setting and querying eth address and orchestrator addresses
func TestQueryCurrentValset(t *testing.T) {
	var (
		ethAddress                = "0xb462864E395d88d6bc7C5dd5F3F5eb4cc2599255"
		valAddress sdk.ValAddress = bytes.Repeat([]byte{0x2}, sdk.AddrLen)
	)
	input := CreateTestEnv(t)
	input.GravityKeeper.StakingKeeper = NewStakingKeeperMock(valAddress)
	ctx := input.Context
	input.GravityKeeper.SetEthAddressForValidator(ctx, valAddress, ethAddress)

	currentValset := input.GravityKeeper.GetCurrentValset(ctx)

	bridgeVal := types.BridgeValidator{EthereumAddress: ethAddress, Power: 4294967295}
	expectedValset := types.NewValset(1, 1234567, []*types.BridgeValidator{&bridgeVal}, sdk.NewIntFromUint64(0), "0x0000000000000000000000000000000000000000")
	assert.Equal(t, expectedValset, currentValset)
}

//nolint: exhaustivestruct
func TestQueryERC20ToDenom(t *testing.T) {
	var (
		erc20 = "0xb462864E395d88d6bc7C5dd5F3F5eb4cc2599255"
		denom = "uatom"
	)
	response := types.QueryERC20ToDenomResponse{
		Denom:            denom,
		CosmosOriginated: true,
	}
	input := CreateTestEnv(t)
	ctx := input.Context
	input.GravityKeeper.setCosmosOriginatedDenomToERC20(ctx, denom, erc20)

	queriedDenom, err := queryERC20ToDenom(ctx, erc20, input.GravityKeeper)
	require.NoError(t, err)
	correctBytes, err := codec.MarshalJSONIndent(types.ModuleCdc, response)
	require.NoError(t, err)

	assert.Equal(t, correctBytes, queriedDenom)
}

//nolint: exhaustivestruct
func TestQueryDenomToERC20(t *testing.T) {
	var (
		erc20 = "0xb462864E395d88d6bc7C5dd5F3F5eb4cc2599255"
		denom = "uatom"
	)
	response := types.QueryDenomToERC20Response{
		Erc20:            erc20,
		CosmosOriginated: true,
	}
	input := CreateTestEnv(t)
	ctx := input.Context
	input.GravityKeeper.setCosmosOriginatedDenomToERC20(ctx, denom, erc20)

	queriedERC20, err := queryDenomToERC20(ctx, denom, input.GravityKeeper)
	require.NoError(t, err)

	correctBytes, err := codec.MarshalJSONIndent(types.ModuleCdc, response)
	require.NoError(t, err)

	assert.Equal(t, correctBytes, queriedERC20)
}

//nolint: exhaustivestruct
func TestQueryPendingSendToEth(t *testing.T) {
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

	// CREATE FIRST BATCH
	// ==================

	// add some TX to the pool
	for i, v := range []uint64{2, 3, 2, 1} {
		amount := types.NewERC20Token(uint64(i+100), myTokenContractAddr).GravityCoin()
		fee := types.NewERC20Token(v, myTokenContractAddr).GravityCoin()
		_, err := input.GravityKeeper.AddToOutgoingPool(ctx, mySender, myReceiver, amount, fee)
		require.NoError(t, err)
		// Should create:
		// 1: amount 100, fee 2
		// 2: amount 101, fee 3
		// 3: amount 102, fee 2
		// 4: amount 104, fee 1
	}

	// when
	ctx = ctx.WithBlockTime(now)

	// tx batch size is 2, so that some of them stay behind
	// Should contain 2 and 3 from above
	_, err := input.GravityKeeper.BuildOutgoingTXBatch(ctx, myTokenContractAddr, 2)
	require.NoError(t, err)

	// Should receive 1 and 4 unbatched, 2 and 3 batched in response
	response, err := queryPendingSendToEth(ctx, mySender.String(), input.GravityKeeper)
	require.NoError(t, err)
	expectedJSON := []byte(`{
  "transfers_in_batches": [
    {
      "id": "2",
      "sender": "cosmos1ahx7f8wyertuus9r20284ej0asrs085case3kn",
      "dest_address": "0xd041c41EA1bf0F006ADBb6d2c9ef9D425dE5eaD7",
      "erc20_token": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "101"
      },
      "erc20_fee": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "3"
      }
    },
    {
      "id": "3",
      "sender": "cosmos1ahx7f8wyertuus9r20284ej0asrs085case3kn",
      "dest_address": "0xd041c41EA1bf0F006ADBb6d2c9ef9D425dE5eaD7",
      "erc20_token": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "102"
      },
      "erc20_fee": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "2"
      }
    }
  ],
  "unbatched_transfers": [
    {
      "id": "1",
      "sender": "cosmos1ahx7f8wyertuus9r20284ej0asrs085case3kn",
      "dest_address": "0xd041c41EA1bf0F006ADBb6d2c9ef9D425dE5eaD7",
      "erc20_token": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "100"
      },
      "erc20_fee": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "2"
      }
    },
    {
      "id": "4",
      "sender": "cosmos1ahx7f8wyertuus9r20284ej0asrs085case3kn",
      "dest_address": "0xd041c41EA1bf0F006ADBb6d2c9ef9D425dE5eaD7",
      "erc20_token": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "103"
      },
      "erc20_fee": {
        "contract": "0x429881672B9AE42b8EbA0E26cD9C73711b891Ca5",
        "amount": "1"
      }
    }
  ]}
	  `)

	assert.JSONEq(t, string(expectedJSON), string(response), "json is equal")
}
