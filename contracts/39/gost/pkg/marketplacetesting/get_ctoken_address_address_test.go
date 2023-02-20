package marketplacetesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/marketplace"
)

type cTokenAddrSuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	MarketPlace *marketplace.MarketPlaceSession // *Session objects are created by the go bindings
}

func (s *cTokenAddrSuite) SetupSuite() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH)) // each of the wallets in the env will begin with this balance
	s.Dep, err = Deploy(s.Env)

	if err != nil {
		panic(err)
	}

	s.MarketPlace = &marketplace.MarketPlaceSession{
		Contract: s.Dep.MarketPlace,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *cTokenAddrSuite) TestSetCTokenAddr() {
	assert := assertions.New(s.T())
	// the swivel address must be set
	_, err := s.MarketPlace.SetSwivelAddress(s.Dep.SwivelAddress)
	assert.Nil(err)
	s.Env.Blockchain.Commit()
	// addresses can be BS in this test...
	underlying := common.HexToAddress("0x123")
	maturity := big.NewInt(123456789)
	cTokenAddr := common.HexToAddress("0x456")

	tx, err := s.MarketPlace.CreateMarket(
		underlying,
		maturity,
		cTokenAddr,
		"awesome market",
		"AM",
		18,
	)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	cTokenAddrC, err := s.MarketPlace.CTokenAddress(underlying, maturity)
	assert.Nil(err)
	assert.Equal(cTokenAddr, cTokenAddrC)
}

func TestCTokenAddrSuite(t *test.T) {
	suite.Run(t, &cTokenAddrSuite{})
}
