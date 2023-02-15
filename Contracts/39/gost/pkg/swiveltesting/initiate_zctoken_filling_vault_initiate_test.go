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
type IZFVISuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	Erc20       *mocks.Erc20Session
	CErc20      *mocks.CErc20Session
	MarketPlace *mocks.MarketPlaceSession
	Swivel      *swivel.SwivelSession
}

func (s *IZFVISuite) SetupTest() {
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

	s.CErc20 = &mocks.CErc20Session{
		Contract: s.Dep.CErc20,
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

func (s *IZFVISuite) TestIZFVI() {
	assert := assert.New(s.T())

	// stub underlying (erc20) transferfrom to return true
	tx, err := s.Erc20.TransferFromReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// and approve
	tx, err = s.Erc20.ApproveReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// and the marketplace api methods...
	tx, err = s.MarketPlace.CTokenAddressReturns(s.Dep.CErc20Address) // must use the actual dep addr here
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	tx, err = s.MarketPlace.CustodialInitiateReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// and the ctoken mint
	tx, err = s.CErc20.MintReturns(big.NewInt(0))
	assert.NotNil(tx)
	assert.Nil(err)
	s.Env.Blockchain.Commit()

	// hashed order...
	orderKey := helpers.GenBytes32("order")
	principal := big.NewInt(1000)
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
		Vault:      true,
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
		Vault:      true,
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
	amount := big.NewInt(25)
	amount = amount.Mul(amount, big.NewInt(1e18))
	// initiate wants slices...
	orders := []swivel.HashOrder{order}
	amounts := []*big.Int{amount}
	componentses := []swivel.SigComponents{components} // yeah, i liek it...

	// vault true && exit false will force the call to IZFVI
	tx, err = s.Swivel.Initiate(orders, amounts, componentses)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should have a filled amount for orderKey
	amt, err := s.Swivel.Filled(orderHash)
	assert.Equal(amt, amount)

	// first call to utoken transferfrom 'from' should be maker here...
	args, err := s.Erc20.TransferFromCalled(order.Maker)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, s.Env.Owner.Opts.From)
	assert.Equal(args.Amount.Cmp(big.NewInt(0)), 1) // amount is pFilled here so should be > 0

	// second call will be keyed by owner...
	args, err = s.Erc20.TransferFromCalled(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, s.Dep.SwivelAddress)
	// the amount here is the "a" + fee, thus it should be GT the original amount
	assert.Equal(1, args.Amount.Cmp(amt))

	// call to utoken approve...
	arg, err := s.Erc20.ApproveCalled(s.Dep.CErc20Address)
	assert.Nil(err)
	assert.NotNil(arg)
	// the arg here should be the passed "a"
	assert.Equal(arg, amt)

	// the call to ctoken mint, don't reuse arg as they should actually both be "a"
	mintArg, err := s.CErc20.MintCalled()
	assert.Nil(err)
	assert.NotNil(mintArg)
	assert.Equal(mintArg, amt)

	// mint zctoken call...
	fillingArgs, err := s.MarketPlace.CustodialInitiateCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(fillingArgs)
	assert.Equal(fillingArgs.Maturity, order.Maturity)
	assert.Equal(fillingArgs.Amount, amt)
	assert.Equal(fillingArgs.Two, order.Maker)
	assert.Equal(fillingArgs.One, s.Env.Owner.Opts.From)
}

func TestIZFVISuite(t *test.T) {
	suite.Run(t, &IZFVISuite{})
}
