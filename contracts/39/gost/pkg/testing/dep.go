package testing

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/swivel-finance/gost/test/fakes"
	"github.com/swivel-finance/gost/test/mocks"
)

type Dep struct {
	SigFakeAddress  common.Address
	SigFake         *fakes.SigFake // fake sig lib test contract
	HashFakeAddress common.Address
	HashFake        *fakes.HashFake // fake hash lib test contract
	Erc20Address    common.Address
	Erc20           *mocks.Erc20
	CErc20Address   common.Address
	CErc20          *mocks.CErc20
}

func Deploy(e *Env) (*Dep, error) {
	// deploying the lib testing contract "fakes"
	// NOTE these _could_ be moved into their own package as they are not needed
	// for swivel to operate. TODO
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

	// deploy marketplace contract... TODO we likely give the marketplace address to swivel...
	// marketAddress, _, marketContract, marketErr := swivel.DeployMarketPlace(e.Owner.Opts, e.Blockchain)

	// if marketErr != nil {
	// return nil, marketErr
	// }

	// e.Blockchain.Commit()

	// deploy swivel contract...
	// swivelAddress, _, swivelContract, swivelErr := swivel.DeploySwivel(e.Owner.Opts, e.Blockchain)

	// if swivelErr != nil {
	// return nil, swivelErr
	// }

	// e.Blockchain.Commit()

	return &Dep{
		SigFakeAddress:  sigAddress,
		SigFake:         sigContract,
		HashFakeAddress: hashAddress,
		HashFake:        hashContract,
		Erc20Address:    ercAddress,
		Erc20:           ercContract,
		CErc20Address:   cercAddress,
		CErc20:          cercContract,
	}, nil
}
