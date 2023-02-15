package swiveltesting

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/swivel-finance/gost/test/fakes"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/swivel"
)

// TODO mock for marketplace...
type Dep struct {
	SigFakeAddress     common.Address
	SigFake            *fakes.SigFake // fake sig lib test contract
	HashFakeAddress    common.Address
	HashFake           *fakes.HashFake // fake hash lib test contract
	Erc20Address       common.Address
	Erc20              *mocks.Erc20 // mock erc20
	CErc20Address      common.Address
	CErc20             *mocks.CErc20 // mock erc20
	MarketPlaceAddress common.Address
	MarketPlace        *mocks.MarketPlace // mock marketplace
	Maturity           *big.Int
	SwivelAddress      common.Address
	Swivel             *swivel.Swivel
}

func Deploy(e *Env) (*Dep, error) {
	maturity := big.NewInt(MATURITY)
	// deploy the fakes so we can access the libs from tests
	sigAddress, _, sigContract, sigErr := fakes.DeploySigFake(e.Owner.Opts, e.Blockchain)

	if sigErr != nil {
		return nil, sigErr
	}

	e.Blockchain.Commit()

	hashAddress, _, hashContract, hashErr := fakes.DeployHashFake(e.Owner.Opts, e.Blockchain)

	if hashErr != nil {
		return nil, hashErr
	}

	e.Blockchain.Commit()

	// deploy the two mock tokens.
	ercAddress, _, ercContract, ercErr := mocks.DeployErc20(e.Owner.Opts, e.Blockchain)

	if ercErr != nil {
		return nil, ercErr
	}

	e.Blockchain.Commit()

	cercAddress, _, cercContract, cercErr := mocks.DeployCErc20(e.Owner.Opts, e.Blockchain)

	if cercErr != nil {
		return nil, cercErr
	}

	e.Blockchain.Commit()

	marketAddress, _, marketContract, marketErr := mocks.DeployMarketPlace(e.Owner.Opts, e.Blockchain)

	if marketErr != nil {
		return nil, marketErr
	}

	e.Blockchain.Commit()

	// deploy swivel contract...
	swivelAddress, _, swivelContract, swivelErr := swivel.DeploySwivel(e.Owner.Opts, e.Blockchain, marketAddress)

	// TODO call marketPlace swivel contract address setter when implemented...

	if swivelErr != nil {
		return nil, swivelErr
	}

	e.Blockchain.Commit()

	return &Dep{
		SigFakeAddress:     sigAddress,
		SigFake:            sigContract,
		HashFakeAddress:    hashAddress,
		HashFake:           hashContract,
		Erc20Address:       ercAddress,
		Erc20:              ercContract,
		CErc20Address:      cercAddress,
		CErc20:             cercContract,
		MarketPlaceAddress: marketAddress,
		MarketPlace:        marketContract,
		Maturity:           maturity,
		SwivelAddress:      swivelAddress,
		Swivel:             swivelContract,
	}, nil
}
