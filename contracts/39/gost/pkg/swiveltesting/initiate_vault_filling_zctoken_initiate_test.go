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
type IVFZISuite struct {
	suite.Suite
	Env         *Env
	Dep         *Dep
	Erc20       *mocks.Erc20Session
	CErc20      *mocks.CErc20Session
	MarketPlace *mocks.MarketPlaceSession
	Swivel      *swivel.SwivelSession
}

func (s *IVFZISuite) SetupTest() {
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

func (s *IVFZISuite) TestMarketPlaceAddress() {
	assert := assert.New(s.T())
	addr, err := s.Swivel.MarketPlace()
	assert.Nil(err)
	assert.Equal(addr, s.Dep.MarketPlaceAddress)
}

func (s *IVFZISuite) TestIVFZI() {
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

	tx, err = s.MarketPlace.TransferVaultNotionalFeeReturns(true)
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
	principal := big.NewInt(5000)
	premium := big.NewInt(50)
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
	// initiate wants slices...
	orders := []swivel.HashOrder{order}
	amounts := []*big.Int{amount}
	componentses := []swivel.SigComponents{components} // yeah, i liek it...

	// vault && exit false will force the call to IVFZI
	tx, err = s.Swivel.Initiate(orders, amounts, componentses)

	// change the internal method to public (recompile) and call directly this way if needed...
	// tx, err = s.Swivel.InitiateVaultFillingZcTokenInitiate(order, amount, components)

	assert.Nil(err)
	assert.NotNil(tx)
	s.Env.Blockchain.Commit()

	// we should have a filled amount for orderKey
	amt, err := s.Swivel.Filled(orderHash)
	assert.Equal(amt, amount)

	// first call to utoken transferfrom 'from' should be owner here...
	args, err := s.Erc20.TransferFromCalled(s.Env.Owner.Opts.From)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, order.Maker)
	assert.Equal(args.Amount.Cmp(amount), 0)

	// second call will be keyed by order.Maker
	args, err = s.Erc20.TransferFromCalled(order.Maker)
	assert.Nil(err)
	assert.NotNil(args)
	assert.Equal(args.To, s.Dep.SwivelAddress)
	// the amount here is the "principalFilled"
	pFilled := args.Amount                      // log this if you want to check the math (2500 in this test)
	assert.Equal(pFilled.Cmp(big.NewInt(0)), 1) // should be > 0 regardless

	// call to utoken approve...
	arg, err := s.Erc20.ApproveCalled(s.Dep.CErc20Address)
	assert.Nil(err)
	assert.NotNil(arg)
	// the arg here should be the pFilled
	assert.Equal(arg, pFilled)

	// the call to ctoken mint, don't reuse arg as they should actually both be pFilled
	mintArg, err := s.CErc20.MintCalled()
	assert.Nil(err)
	assert.NotNil(mintArg)
	assert.Equal(mintArg, pFilled)

	// mint zctoken call...
	fillingArgs, err := s.MarketPlace.CustodialInitiateCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(fillingArgs)
	assert.Equal(fillingArgs.Maturity, order.Maturity)
	assert.Equal(fillingArgs.Amount, pFilled)
	assert.Equal(fillingArgs.One, order.Maker)
	assert.Equal(fillingArgs.Two, s.Env.Owner.Opts.From)

	// transfer fee call...
	feeTransferArgs, err := s.MarketPlace.TransferVaultNotionalFeeCalled(order.Underlying)
	assert.Nil(err)
	assert.NotNil(feeTransferArgs)
	assert.Equal(feeTransferArgs.Amount, big.NewInt(6)) // 6.25 will be truncated to 6
}

func TestIVFZISuite(t *test.T) {
	suite.Run(t, &IVFZISuite{})
}
