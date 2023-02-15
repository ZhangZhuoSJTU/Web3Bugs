package marketplacetesting

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/swivel-finance/gost/test/marketplace"
	"github.com/swivel-finance/gost/test/mocks"
)

type Dep struct {
	Erc20        *mocks.Erc20
	Erc20Address common.Address

	CErc20        *mocks.CErc20
	CErc20Address common.Address

	MarketPlaceAddress common.Address
	MarketPlace        *marketplace.MarketPlace

	Maturity *big.Int

	SwivelAddress common.Address
}

func Deploy(e *Env) (*Dep, error) {
	maturity := big.NewInt(MATURITY)
	cercAddress, _, cercContract, cercErr := mocks.DeployCErc20(e.Owner.Opts, e.Blockchain)

	if cercErr != nil {
		return nil, cercErr
	}

	e.Blockchain.Commit()

	ercAddress, _, ercContract, ercErr := mocks.DeployErc20(e.Owner.Opts, e.Blockchain)

	if ercErr != nil {
		return nil, ercErr
	}

	e.Blockchain.Commit()

	// deploy contract...
	marketAddress, _, marketContract, marketErr := marketplace.DeployMarketPlace(e.Owner.Opts, e.Blockchain)

	if marketErr != nil {
		return nil, marketErr
	}

	e.Blockchain.Commit()

	return &Dep{
		MarketPlaceAddress: marketAddress,
		MarketPlace:        marketContract,
		CErc20Address:      cercAddress,
		CErc20:             cercContract,
		Erc20Address:       ercAddress,
		Erc20:              ercContract,
		SwivelAddress:      common.HexToAddress("0xAbC123"),
		Maturity:           maturity,
	}, nil
}
