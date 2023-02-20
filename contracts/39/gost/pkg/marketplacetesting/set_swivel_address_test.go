package marketplacetesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/marketplace"
)

type swivelAddrSuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	MarketPlace *marketplace.MarketPlaceSession // *Session objects are created by the go bindings
}

func (s *swivelAddrSuite) SetupSuite() {
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

func (s *swivelAddrSuite) TestSetSwivelAddr() {
	assert := assert.New(s.T())
	bsAddr := common.HexToAddress("0x123456789")
	tx, err := s.MarketPlace.SetSwivelAddress(bsAddr)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	addr, _ := s.MarketPlace.Swivel()
	assert.Equal(bsAddr, addr)
}

func TestSwivelAddrSuite(t *test.T) {
	suite.Run(t, &swivelAddrSuite{})
}
