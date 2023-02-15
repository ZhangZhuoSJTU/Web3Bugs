package marketplacetesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/marketplace"
	"github.com/swivel-finance/gost/test/mocks"
)

type createMarketSuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	MarketPlace *marketplace.MarketPlaceSession // *Session objects are created by the go bindings
}

func (s *createMarketSuite) SetupSuite() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH)) // each of the wallets in the env will begin with this balance
	s.Dep, err = Deploy(s.Env)

	if err != nil {
		panic(err)
	}

	// binding owner to both, kind of why it exists - but could be any of the env wallets
	s.MarketPlace = &marketplace.MarketPlaceSession{
		Contract: s.Dep.MarketPlace,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *createMarketSuite) TestCreateMarket18Decimals() {
	assert := assert.New(s.T())
	// the swivel address must be set
	_, err := s.MarketPlace.SetSwivelAddress(s.Dep.SwivelAddress)
	assert.Nil(err)
	s.Env.Blockchain.Commit()
	// addresses can be BS in this test...
	underlying := common.HexToAddress("0x123")
	maturity := big.NewInt(123456789)
	ctoken := common.HexToAddress("0x456")

	tx, err := s.MarketPlace.CreateMarket(
		underlying,
		maturity,
		ctoken,
		"awesome market",
		"AM",
		uint8(18),
	)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should be able to fetch the market now...
	market, err := s.MarketPlace.Markets(underlying, maturity)
	assert.Nil(err)
	assert.Equal(market.CTokenAddr, ctoken)
	assert.NotEqual(market.ZcTokenAddr, common.HexToAddress("0x0"))
	assert.NotEqual(market.VaultAddr, common.HexToAddress("0x0"))

	zcTokenContract, err := mocks.NewZcToken(market.ZcTokenAddr, s.Env.Blockchain)
	zcToken := &mocks.ZcTokenSession{
		Contract: zcTokenContract,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	decimals, err := zcToken.Decimals()
	assert.Equal(decimals, uint8(18))
}

func (s *createMarketSuite) TestCreateMarket6Decimals() {
	assert := assert.New(s.T())
	// the swivel address must be set
	_, err := s.MarketPlace.SetSwivelAddress(s.Dep.SwivelAddress)
	assert.Nil(err)
	s.Env.Blockchain.Commit()
	// addresses can be BS in this test...
	underlying := common.HexToAddress("0x234")
	maturity := big.NewInt(123456781)
	ctoken := common.HexToAddress("0x567")

	tx, err := s.MarketPlace.CreateMarket(
		underlying,
		maturity,
		ctoken,
		"awesomer market",
		"ARM",
		uint8(6),
	)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should be able to fetch the market now...
	market, err := s.MarketPlace.Markets(underlying, maturity)
	assert.Nil(err)
	assert.Equal(market.CTokenAddr, ctoken)
	assert.NotEqual(market.ZcTokenAddr, common.HexToAddress("0x0"))
	assert.NotEqual(market.VaultAddr, common.HexToAddress("0x0"))

	zcTokenContract, err := mocks.NewZcToken(market.ZcTokenAddr, s.Env.Blockchain)
	zcToken := &mocks.ZcTokenSession{
		Contract: zcTokenContract,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	decimals, err := zcToken.Decimals()
	assert.Equal(decimals, uint8(6))
}

func TestCreateMarketSuite(t *test.T) {
	suite.Run(t, &createMarketSuite{})
}
