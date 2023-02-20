package vaulttrackertesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/vaulttracker"
)

type vaultTrackerCtorSuite struct {
	suite.Suite
	Env          *Env
	Dep          *Dep
	VaultTracker *vaulttracker.VaultTrackerSession // *Session objects are created by the go bindings
}

func (s *vaultTrackerCtorSuite) SetupSuite() {
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

func (s *vaultTrackerCtorSuite) TestAdmin() {
	assert := assertions.New(s.T())
	addr, err := s.VaultTracker.Admin()
	assert.Nil(err)
	assert.Equal(addr, s.Env.Owner.Opts.From)
}

func (s *vaultTrackerCtorSuite) TestCTokenAddress() {
	assert := assertions.New(s.T())
	addr, err := s.VaultTracker.CTokenAddr()
	assert.Nil(err)
	assert.Equal(s.Dep.CErc20Address, addr)
}

func (s *vaultTrackerCtorSuite) TestMaturity() {
	assert := assertions.New(s.T())
	maturity, err := s.VaultTracker.Maturity()
	assert.Nil(err)
	assert.Equal(maturity, s.Dep.Maturity)
}

func TestVaultTrackerCtorSuite(t *test.T) {
	suite.Run(t, &vaultTrackerCtorSuite{})
}
