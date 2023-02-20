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
type IVFVESuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	Erc20       *mocks.Erc20Session
	MarketPlace *mocks.MarketPlaceSession
	Swivel      *swivel.SwivelSession
}

func (s *IVFVESuite) SetupTest() {
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

func (s *IVFVESuite) TestIVFVE() {
	assert := assert.New(s.T())

	// stub underlying (erc20) transferfrom to return true
	tx, err := s.Erc20.TransferFromReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// and the marketplace api methods...
	tx, err = s.MarketPlace.P2pVaultExchangeReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	tx, err = s.MarketPlace.TransferVaultNotionalFeeReturns(true)
	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// hashed order...
	orderKey := helpers.GenBytes32("order")
	principal := big.NewInt(5000)
	premium := big.NewInt(50)
	maturity := big.NewInt(10000)
	expiry := big.NewInt(20000)

	// TODO preparing an order _may_ be relocated to a helper. Possibly per package? Discuss...
	hashOrder := fakes.HashOrder{
		Key:        orderKey,
		Maker:      s.Env.User1.Opts.From,
		Underlying: s.Dep.Erc20Address,
		Vault:      true,
		Exit:       true,
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
		Exit:       true,
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
	// initiate wants slices...
	orders := []swivel.HashOrder{order}
	amounts := []*big.Int{amount}
	componentses := []swivel.SigComponents{components} // yeah, i liek it...

	// vault false && exit true will force the call to IZFZE
	tx, err = s.Swivel.Initiate(orders, amounts, componentses)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should have a filled amount for orderKey
	amt, err := s.Swivel.Filled(orderHash)
	assert.Equal(amt, amount)

	// first call to utoken transferfrom 'from' should be sender here...
	args, err := s.Erc20.TransferFromCalled(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, order.Maker)
	assert.Equal(amt, args.Amount) // should be "a" here

	// market notional transfer from call...
	notionalTransferArgs, err := s.MarketPlace.P2pVaultExchangeCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(notionalTransferArgs)
	assert.Equal(notionalTransferArgs.Maturity, order.Maturity)
	// log the .Amount here to check the math...
	assert.Equal(notionalTransferArgs.Amount.Cmp(big.NewInt(0)), 1) // it's pFilled, so should be > 0 at the least...
	assert.Equal(notionalTransferArgs.One, order.Maker)
	assert.Equal(notionalTransferArgs.Two, s.Env.Owner.Opts.From)

	// transfer fee call...
	feeTransferArgs, err := s.MarketPlace.TransferVaultNotionalFeeCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(feeTransferArgs)
	assert.Equal(feeTransferArgs.Amount, big.NewInt(6)) // 6.25 will be truncated to 6
}

func TestIVFVESuite(t *test.T) {
	suite.Run(t, &IVFVESuite{})
}
