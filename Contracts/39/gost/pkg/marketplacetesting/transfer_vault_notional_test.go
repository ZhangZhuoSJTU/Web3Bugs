package marketplacetesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	assertions "github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/test/marketplace"
	"github.com/swivel-finance/gost/test/mocks"
)

type vaultTransferSuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	MarketPlace *marketplace.MarketPlaceSession // *Session objects are created by the go bindings
}

func (s *vaultTransferSuite) SetupTest() {
	var err error
	assert := assertions.New(s.T())

	s.Env = NewEnv(big.NewInt(ONE_ETH)) // each of the wallets in the env will begin with this balance
	s.Dep, err = Deploy(s.Env)
	assert.Nil(err)

	s.MarketPlace = &marketplace.MarketPlaceSession{
		Contract: s.Dep.MarketPlace,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	// the swivel address must be set
	_, err = s.MarketPlace.SetSwivelAddress(s.Dep.SwivelAddress)
	assert.Nil(err)
	s.Env.Blockchain.Commit()
}

func (s *vaultTransferSuite) TestVaultTransfer() {
	assert := assertions.New(s.T())

	ownerOpts := s.Env.Owner.Opts
	user1Opts := s.Env.User1.Opts

	// make a market so that a vault is deployed
	underlying := common.HexToAddress("0x234567891")
	maturity := big.NewInt(1234567)
	ctoken := common.HexToAddress("0x456")

	tx, err := s.MarketPlace.CreateMarket(
		underlying,
		maturity,
		ctoken,
		"awesome market",
		"AM",
		18,
	)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// find that vault, wrap it in a mock...
	market, err := s.MarketPlace.Markets(underlying, maturity)
	assert.Nil(err)
	assert.Equal(market.CTokenAddr, ctoken)

	vaultTrackerContract, err := mocks.NewVaultTracker(market.VaultAddr, s.Env.Blockchain)
	vaultTracker := &mocks.VaultTrackerSession{
		Contract: vaultTrackerContract,
		CallOpts: bind.CallOpts{From: ownerOpts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   ownerOpts.From,
			Signer: ownerOpts.Signer,
		},
	}

	// stub the mock vaulttracker...
	tx, err = vaultTracker.TransferNotionalFromReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	amount := big.NewInt(100)

	tx, err = s.MarketPlace.TransferVaultNotional(underlying, maturity, user1Opts.From, amount)
	assert.Nil(err)
	assert.NotNil(tx)

	s.Env.Blockchain.Commit()

	// marketplace should have called transfer with the msg.sender as owner
	transferArgs, err := vaultTracker.TransferNotionalFromCalled(ownerOpts.From)
	assert.Nil(err)
	assert.Equal(user1Opts.From, transferArgs.To)
	assert.Equal(amount, transferArgs.Amount)
}

func TestVaultTransferSuite(t *test.T) {
	suite.Run(t, &vaultTransferSuite{})
}
