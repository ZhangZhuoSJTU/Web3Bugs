package swiveltesting

import (
	"math/big"
	test "testing"

	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/swivel-finance/gost/internal/helpers"
	"github.com/swivel-finance/gost/test/fakes"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/swivel"
)

// yeah, just make it an acronym...
type EZFZISuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	Erc20       *mocks.Erc20Session
	MarketPlace *mocks.MarketPlaceSession
	Swivel      *swivel.SwivelSession
}

func (s *EZFZISuite) SetupTest() {
	var err error

	s.Env = NewEnv(big.NewInt(ONE_ETH))
	s.Dep, err = Deploy(s.Env)

	if err != nil {
		panic(err)
	}

	s.Erc20 = &mocks.Erc20Session{
		Contract: s.Dep.Erc20,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	s.MarketPlace = &mocks.MarketPlaceSession{
		Contract: s.Dep.MarketPlace,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}

	// binding owner to both, kind of why it exists - but could be any of the env wallets
	s.Swivel = &swivel.SwivelSession{
		Contract: s.Dep.Swivel,
		CallOpts: bind.CallOpts{From: s.Env.Owner.Opts.From, Pending: false},
		TransactOpts: bind.TransactOpts{
			From:   s.Env.Owner.Opts.From,
			Signer: s.Env.Owner.Opts.Signer,
		},
	}
}

func (s *EZFZISuite) TestEZFZI() {
	assert := assert.New(s.T())

	// stub underlying (erc20) transferfrom to return true
	tx, err := s.Erc20.TransferFromReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// and the marketplace api methods...
	tx, err = s.MarketPlace.P2pZcTokenExchangeReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// hashed order...
	orderKey := helpers.GenBytes32("order")
	principal := big.NewInt(5000)
	principal = principal.Mul(principal, big.NewInt(1e18))
	premium := big.NewInt(50)
	premium = premium.Mul(premium, big.NewInt(1e18))
	maturity := big.NewInt(10000)
	expiry := big.NewInt(20000)

	// TODO preparing an order _may_ be relocated to a helper. Possibly per package? Discuss...
	hashOrder := fakes.HashOrder{
		Key:        orderKey,
		Maker:      s.Env.User1.Opts.From,
		Underlying: s.Dep.Erc20Address,
		Vault:      false,
		Exit:       false,
		Principal:  principal,
		Premium:    premium,
		Maturity:   maturity,
		Expiry:     expiry,
	}

	// signature...
	orderHash, err := s.Dep.HashFake.OrderTest(nil, hashOrder)
	assert.Nil(err)
	assert.NotNil(orderHash)

	// put the hashed order together with the eip712 domain and hash those
	separator, _ := s.Swivel.Domain()
	messageHash, err := s.Dep.HashFake.MessageTest(nil, separator, orderHash)
	assert.Nil(err)
	assert.NotNil(messageHash)

	// sign it with User1 private key
	sig, err := crypto.Sign(messageHash[:], s.Env.User1.PK)
	assert.Nil(err)
	assert.NotNil(sig)

	// get the sig components
	vrs, err := s.Dep.SigFake.SplitTest(nil, sig)
	assert.Nil(err)
	assert.NotNil(vrs)

	// see sig_test.go
	if vrs.V < 27 {
		vrs.V += 27
	}

	// the order passed to the swivel contract must be of the swivel package type...
	order := swivel.HashOrder{
		Key:        orderKey,
		Maker:      s.Env.User1.Opts.From,
		Underlying: s.Dep.Erc20Address,
		Vault:      false,
		Exit:       false,
		Principal:  principal,
		Premium:    premium,
		Maturity:   maturity,
		Expiry:     expiry,
	}

	// like order the signature components must ref swivel
	components := swivel.SigComponents{
		V: vrs.V,
		R: vrs.R,
		S: vrs.S,
	}

	// call it (finally)...
	amount := big.NewInt(25) // 1/2 the premium
	amount = amount.Mul(amount, big.NewInt(1e18))
	// initiate wants slices...
	orders := []swivel.HashOrder{order}
	amounts := []*big.Int{amount}
	componentses := []swivel.SigComponents{components} // yeah, i liek it...

	// vault false && exit false will force the call to EZFZI
	tx, err = s.Swivel.Exit(orders, amounts, componentses)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should have a filled amount for orderKey
	amt, err := s.Swivel.Filled(orderHash)
	assert.Equal(amt, amount)

	// first call to utoken transferfrom 'from' should be maker here...
	// TODO this call will now be overwritten by a 2nd call with the same From, re-instate this test when the hash-key-fix goes in
	// args, err := s.Erc20.TransferFromCalled(order.Maker)
	// assert.Nil(err)
	// assert.NotNil(args)
	// assert.Equal(args.To, s.Env.Owner.Opts.From)
	// assert.Equal(args.Amount.Cmp(amt), 1) // amount should be greater than the passed in filled premium

	// this is the 2nd call to transferfrom with from as maker where the fee is transferred
	args, err := s.Erc20.TransferFromCalled(order.Maker)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, s.Dep.SwivelAddress)      // fee goes to the swivel contract
	assert.Equal(args.Amount.Cmp(big.NewInt(0)), 1) // fee should be something...
	// s.T().Log(args.Amount)

	// market zctoken transfer from call...
	zcTransferArgs, err := s.MarketPlace.P2pZcTokenExchangeCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(zcTransferArgs)
	assert.Equal(zcTransferArgs.Maturity, order.Maturity)
	assert.Equal(zcTransferArgs.Amount.Cmp(amt), 1) // .Amount is greater than passed in filled prem (like above)
	assert.Equal(zcTransferArgs.Two, order.Maker)
	assert.Equal(zcTransferArgs.One, s.Env.Owner.Opts.From)
}

func TestEZFZISuite(t *test.T) {
	suite.Run(t, &EZFZISuite{})
}
