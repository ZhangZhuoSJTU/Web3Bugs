package vaulttrackertesting

import (
	"math/big"
	test "testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/vaulttracker"
)

// NOTE: the transferNotional method was removed in favor of only having transferNotionalFrom.
// Keeping this spec here however, and just changing the reference.

type transferSuite struct {
	suite.Suite
	Env          *Env
	Dep          *Dep
	CErc20       *mocks.CErc20Session
	VaultTracker *vaulttracker.VaultTrackerSession // *Session objects are created by the go bindings
}

func (s *transferSuite) SetupTest() {
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

	// binding owner to both, kind of why it exists - but could be any of the env wallets
	s.VaultTracker = &vaulttracker.VaultTrackerSession{
		Contract: s.Dep.VaultTracker,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *transferSuite) TestTransferFailRequireAmount() {
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

	// call AddNotional for Owner with no vault and add "small" amount
	caller := s.Env.Owner.Opts.From
	amount1 := big.NewInt(1)
	tx, err = s.VaultTracker.AddNotional(caller, amount1)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// call RemoveNotional for Owner with vault amount lower than removal amount
	// caller = s.Env.Owner.Opts.From
	amount2 := big.NewInt(1000)
	tx, err = s.VaultTracker.TransferNotionalFrom(caller, s.Env.User1.Opts.From, amount2)
	assert.NotNil(err)
	assert.Regexp("amount exceeds available balance", err.Error())
	assert.Nil(tx)

	s.Env.Blockchain.Commit()
}

func (s *transferSuite) TestTransferNotMaturedNotExistingVault() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vaultO, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultO.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultO.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner
	callerO := s.Env.Owner.Opts.From
	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vaultO, err = s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1000), vaultO.Notional)
	assert.Equal(rate1, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)

	rate2 := big.NewInt(223456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(2000), vaultO.Notional)
	assert.Equal(rate2, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(810)), 0)

	// no vault found for User1
	vaultU, err := s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultU.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultU.ExchangeRate.Cmp(ZERO), 0)

	rate3 := big.NewInt(323456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate3)
	assert.Nil(err)
	assert.NotNil(tx)

	// call Transfer Owner -> User1
	transferAmount := big.NewInt(500)
	tx, err = s.VaultTracker.TransferNotionalFrom(callerO, s.Env.User1.Opts.From, transferAmount)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1500), vaultO.Notional)
	assert.Equal(rate3, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(1705)), 0)

	vaultU, err = s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(big.NewInt(500), vaultU.Notional)
	assert.Equal(rate3, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
}

func (s *transferSuite) TestTransferNotMaturedExistingVault() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vaultO, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultO.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultO.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner
	callerO := s.Env.Owner.Opts.From
	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1000), vaultO.Notional)
	assert.Equal(rate1, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)

	rate2 := big.NewInt(223456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(2000), vaultO.Notional)
	assert.Equal(rate2, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(810)), 0)

	// no vault found for User1
	vaultU, err := s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultU.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultU.ExchangeRate.Cmp(ZERO), 0)

	rate3 := big.NewInt(323456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate3)
	assert.Nil(err)
	assert.NotNil(tx)

	// call AddNotional for User1
	callerU := s.Env.User1.Opts.From
	notionalAmountU := big.NewInt(2000)
	tx, err = s.VaultTracker.AddNotional(callerU, notionalAmountU)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for User1
	vaultU, err = s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(notionalAmountU, vaultU.Notional)
	assert.Equal(rate3, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)

	// call Transfer Owner -> User1
	transferAmount := big.NewInt(500)
	tx, err = s.VaultTracker.TransferNotionalFrom(callerO, callerU, transferAmount)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1500), vaultO.Notional)
	assert.Equal(rate3, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(1705)), 0)

	vaultU, err = s.VaultTracker.Vaults(callerU)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(big.NewInt(2500), vaultU.Notional)
	assert.Equal(rate3, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
}

func (s *transferSuite) TestTransferMaturedNotExistingVault() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vaultO, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultO.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultO.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner
	callerO := s.Env.Owner.Opts.From
	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1000), vaultO.Notional)
	assert.Equal(rate1, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)

	rate2 := big.NewInt(223456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(2000), vaultO.Notional)
	assert.Equal(rate2, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(810)), 0)

	// no vault found for User1
	vaultU, err := s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultU.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultU.ExchangeRate.Cmp(ZERO), 0)

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

	s.Env.Blockchain.Commit()

	// call Transfer Owner -> User1
	transferAmount := big.NewInt(500)
	tx, err = s.VaultTracker.TransferNotionalFrom(callerO, s.Env.User1.Opts.From, transferAmount)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1500), vaultO.Notional)
	assert.Equal(rate3, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(6180)), 0)

	vaultU, err = s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(big.NewInt(500), vaultU.Notional)
	assert.Equal(rate3, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
}

func (s *transferSuite) TestTransferMaturedExistingVault() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// no vault found for Owner
	vaultO, err := s.VaultTracker.Vaults(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultO.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultO.ExchangeRate.Cmp(ZERO), 0)

	// call AddNotional for Owner
	callerO := s.Env.Owner.Opts.From
	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for Owner
	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1000), vaultO.Notional)
	assert.Equal(rate1, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(ZERO), 0)

	rate2 := big.NewInt(223456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate2)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	tx, err = s.VaultTracker.AddNotional(callerO, big.NewInt(1000))
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(2000), vaultO.Notional)
	assert.Equal(rate2, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(810)), 0)

	// no vault found for User1
	vaultU, err := s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)
	assert.Equal(vaultU.Notional.Cmp(ZERO), 0)
	assert.Equal(vaultU.ExchangeRate.Cmp(ZERO), 0)

	rate3 := big.NewInt(323456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate3)
	assert.Nil(err)
	assert.NotNil(tx)

	// call AddNotional for User1
	callerU := s.Env.User1.Opts.From
	notionalAmountU := big.NewInt(2000)
	tx, err = s.VaultTracker.AddNotional(callerU, notionalAmountU)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// found vault for User1
	vaultU, err = s.VaultTracker.Vaults(callerU)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(notionalAmountU, vaultU.Notional)
	assert.Equal(rate3, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(ZERO), 0)

	rate4 := big.NewInt(823456789)
	tx, err = s.CErc20.ExchangeRateCurrentReturns(rate4)
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

	s.Env.Blockchain.Commit()

	// call Transfer Owner -> User1
	transferAmount := big.NewInt(500)
	tx, err = s.VaultTracker.TransferNotionalFrom(callerO, callerU, transferAmount)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	vaultO, err = s.VaultTracker.Vaults(callerO)
	assert.Nil(err)
	assert.NotNil(vaultO)
	assert.Equal(big.NewInt(1500), vaultO.Notional)
	assert.Equal(rate4, vaultO.ExchangeRate)
	assert.Equal(vaultO.Redeemable.Cmp(big.NewInt(6180)), 0)

	vaultU, err = s.VaultTracker.Vaults(callerU)
	assert.Nil(err)
	assert.NotNil(vaultU)
	assert.Equal(big.NewInt(2500), vaultU.Notional)
	assert.Equal(rate4, vaultU.ExchangeRate)
	assert.Equal(vaultU.Redeemable.Cmp(big.NewInt(3091)), 0)
}

func TestTrackerTransferSuite(t *test.T) {
	suite.Run(t, &transferSuite{})
}
