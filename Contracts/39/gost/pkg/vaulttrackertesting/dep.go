package vaulttrackertesting

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/swivel-finance/gost/test/mocks"
	"github.com/swivel-finance/gost/test/vaulttracker"
)

type Dep struct {
	CErc20        *mocks.CErc20
	CErc20Address common.Address

	SwivelAddress common.Address

	VaultTracker        *vaulttracker.VaultTracker
	VaultTrackerAddress common.Address

	Maturity *big.Int
}

func Deploy(e *Env) (*Dep, error) {
	maturity := big.NewInt(MATURITY)
	cercAddress, _, cercContract, cercErr := mocks.DeployCErc20(e.Owner.Opts, e.Blockchain)

	if cercErr != nil {
		return nil, cercErr
	}

	e.Blockchain.Commit()

	// vaultTracker expects a swivel address passed to it
	swivelAddress := common.HexToAddress("0xAbC123")

	// deploy contract...
	trackerAddress, _, trackerContract, trackerErr := vaulttracker.DeployVaultTracker(
		e.Owner.Opts,
		e.Blockchain,
		maturity,
		cercAddress,
		swivelAddress,
	)

	if trackerErr != nil {
		return nil, trackerErr
	}

	e.Blockchain.Commit()

	return &Dep{
		SwivelAddress:       swivelAddress,
		VaultTrackerAddress: trackerAddress,
		VaultTracker:        trackerContract,
		Maturity:            maturity,
		CErc20:              cercContract,
		CErc20Address:       cercAddress,
	}, nil
}
