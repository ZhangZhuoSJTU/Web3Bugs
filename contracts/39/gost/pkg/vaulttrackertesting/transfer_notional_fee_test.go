package vaulttrackertesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/vaulttracker"
)

type transferNotionalFeeSuite struct {
	suite.Suite
	Env          *Env
	Dep          *Dep
	CErc20       *mocks.CErc20Session
	VaultTracker *vaulttracker.VaultTrackerSession
}

func (s *transferNotionalFeeSuite) SetupTest() {
	var err error
	assert := assertions.New(s.T())

	s.Env = NewEnv(big.NewInt(ONE_ETH))
	s.Dep, err = Deploy(s.Env)
	assert.Nil(err)

	err = s.Env.Blockchain.AdjustTime(0) // set bc timestamp to 0
	assert.Nil(err)
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

func (s *transferNotionalFeeSuite) TestTransferNotionalFee() {
	assert := assertions.New(s.T())

	rate1 := big.NewInt(123456789)
	tx, err := s.CErc20.ExchangeRateCurrentReturns(rate1)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// user needs funds in their vault
	userVaultAmt := big.NewInt(1000)
	userFee := big.NewInt(500)

	tx, err = s.VaultTracker.AddNotional(s.Env.User1.Opts.From, userVaultAmt)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// transfer from user to swivel, which will have no vault up til now...
	tx, err = s.VaultTracker.TransferNotionalFee(s.Env.User1.Opts.From, userFee)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	swiVault, err := s.VaultTracker.Vaults(s.Dep.SwivelAddress)
	assert.Nil(err)
	assert.NotNil(swiVault)
	assert.Equal(swiVault.Notional, userFee)
	// s.T().Log(swiVault.Notional)

	userVault, err := s.VaultTracker.Vaults(s.Env.User1.Opts.From)
	assert.Nil(err)
	assert.NotNil(userVault)
	assert.Equal(userFee, userVault.Notional)
}

func TestTrackerTransferNotionalFeeSuite(t *test.T) {
	suite.Run(t, &transferNotionalFeeSuite{})
}
