package vaulttrackertesting

import (
	// "context"
	// "github.com/ethereum/go-ethereum/common"
	"math/big"
	test "testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/vaulttracker"
)

type redeemInterestSuite struct {
	suite.Suite
	Env          *Env
	Dep          *Dep
	CErc20       *mocks.CErc20Session
	VaultTracker *vaulttracker.VaultTrackerSession
}

func (s *redeemInterestSuite) SetupTest() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH)) // each of the wallets in the env will begin with this balance
	s.Dep, err = Deploy(s.Env)
	if err != nil {
		panic(err)
	}

	err = s.Env.Blockchain.AdjustTime(0) // set bc timestamp to 0
	if err != nil {
		panic(err)
	}
	s.Env.Blockchain.Commit()

	s.CErc20 = &mocks.CErc20Session{
		Contract: s.Dep.CErc20,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	s.VaultTracker = &vaulttracker.VaultTrackerSession{
		Contract: s.Dep.VaultTracker,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *redeemInterestSuite) TestRedeemInterestNotMatured() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vault, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(vault.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vault.Notional.Cmp(ZERO), 0)
	assert.Equal(vault.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner with no vault
	caller := s.Env.Owner.Opts.From
	amount1 := big.NewInt(10000000)
	redeemable1 := ZERO
	tx, err = s.VaultTracker.AddNotional(caller, amount1)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount1, vault.Notional)
	assert.Equal(rate1, vault.ExchangeRate)
	assert.Equal(vault.Redeemable.Cmp(redeemable1), 0)

	rate2 := big.NewInt(723456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	amount2 := big.NewInt(20000000)
	redeemable2 := big.NewInt(48600000)

	// call AddNotional for Owner which already has vault and market is not matured
	tx, err = s.VaultTracker.AddNotional(caller, amount1)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount2, vault.Notional)
	assert.Equal(rate2, vault.ExchangeRate)
	assert.Equal(redeemable2, vault.Redeemable)

	rate3 := big.NewInt(823456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate3)
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	// redeem interest using rate3
	tx, err = s.VaultTracker.RedeemInterest(caller)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// receipt, err := s.Env.Blockchain.TransactionReceipt(context.Background(), tx.Hash())
	// assert.Nil(err)
	// assert.NotNil(receipt)

	// logs := receipt.Logs
	// assert.NotNil(logs)
	// assert.Equal(1, len(logs))

	// assert.Equal(REDEEM_INTEREST_EVENT_SIG, logs[0].Topics[0].Hex())
	// assert.Equal(caller.Hex(), common.HexToAddress(logs[0].Topics[1].Hex()).String())
	// assert.Equal(big.NewInt(51364505), logs[0].Topics[2].Big())

	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount2, vault.Notional)
	assert.Equal(rate3, vault.ExchangeRate)
	assert.Equal(vault.Redeemable.Cmp(ZERO), 0)
}

func (s *redeemInterestSuite) TestRedeemInterestMatured() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vault, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(vault.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vault.Notional.Cmp(ZERO), 0)
	assert.Equal(vault.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner with no vault
	caller := s.Env.Owner.Opts.From
	amount1 := big.NewInt(10000000)
	redeemable1 := ZERO
	tx, err = s.VaultTracker.AddNotional(caller, amount1)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount1, vault.Notional)
	assert.Equal(rate1, vault.ExchangeRate)
	assert.Equal(vault.Redeemable.Cmp(redeemable1), 0)

	rate2 := big.NewInt(723456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	amount2 := big.NewInt(20000000)
	redeemable2 := big.NewInt(48600000)

	// call AddNotional for Owner which already has vault and market is not matured
	tx, err = s.VaultTracker.AddNotional(caller, amount1)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount2, vault.Notional)
	assert.Equal(rate2, vault.ExchangeRate)
	assert.Equal(redeemable2, vault.Redeemable)

	rate3 := big.NewInt(823456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate3)
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	// move past the maturity
	err = s.Env.Blockchain.AdjustTime(MATURITY * time.Second)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	// call mature
	tx, err = s.VaultTracker.MatureVault()
	assert.Nil(err)
	assert.NotNil(tx)

	rate4 := big.NewInt(923456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate4)
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	// redeem interest using rate3 (maturityRate)
	tx, err = s.VaultTracker.RedeemInterest(caller)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// receipt, err := s.Env.Blockchain.TransactionReceipt(context.Background(), tx.Hash())
	// assert.Nil(err)
	// assert.NotNil(receipt)

	// logs := receipt.Logs
	// assert.NotNil(logs)
	// assert.Equal(1, len(logs))

	// assert.Equal(REDEEM_INTEREST_EVENT_SIG, logs[0].Topics[0].Hex())
	// assert.Equal(caller.Hex(), common.HexToAddress(logs[0].Topics[1].Hex()).String())
	// assert.Equal(big.NewInt(51364505), logs[0].Topics[2].Big())

	vault, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vault)
	assert.Equal(amount2, vault.Notional)
	assert.Equal(rate4, vault.ExchangeRate)
	assert.Equal(vault.Redeemable.Cmp(ZERO), 0)
}

func TestRedeemInterestSuite(t *test.T) {
	suite.Run(t, &redeemInterestSuite{})
}
