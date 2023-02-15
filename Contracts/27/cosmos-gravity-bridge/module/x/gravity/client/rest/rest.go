package rest

import (
	"fmt"

	"github.com/cosmos/cosmos-sdk/client"

	"github.com/gorilla/mux"
)

const (
	nonce                  = "nonce"
	tokenAddress           = "tokenAddress"
	denom                  = "denom"
	bech32ValidatorAddress = "bech32ValidatorAddress"
)

// Here are the routes that are actually queried by the rust
// "gravity/valset_request/{}"
// "gravity/pending_valset_requests/{}"
// "gravity/valset_requests"
// "gravity/valset_confirm/{}"
// "gravity/pending_batch_requests/{}"
// "gravity/transaction_batches/"
// "gravity/signed_batches"

// RegisterRoutes - Central function to define routes that get registered by the main application
func RegisterRoutes(cliCtx client.Context, r *mux.Router, storeName string) {

	/// Valsets

	// This endpoint gets all of the validator set confirmations for a given nonce. In order to determine if a valset is complete
	// the relayer queries the latest valsets and then compares the number of members they show versus the length of this endpoints output
	// if they match every validator has submitted a signature and we can go forward with relaying that validator set update.
	r.HandleFunc(fmt.Sprintf("/%s/valset_confirm/{%s}", storeName, nonce), allValsetConfirmsHandler(cliCtx, storeName)).Methods("GET")
	// gets the latest 5 validator set requests, used heavily by the relayer. Which hits this endpoint before checking which
	// of these last 5 have sufficient signatures to relay
	r.HandleFunc(fmt.Sprintf("/%s/valset_requests", storeName), lastValsetRequestsHandler(cliCtx, storeName)).Methods("GET")
	// Returns the last 'pending' (unsigned) validator set for a given validator address.
	r.HandleFunc(fmt.Sprintf("/%s/pending_valset_requests/{%s}", storeName, bech32ValidatorAddress), lastValsetRequestsByAddressHandler(cliCtx, storeName)).Methods("GET")
	// gets valset request by nonce, used to look up a specific valset. This is needed to lookup data about the current validator set on the contract
	// and determine what can or can not be submitted as a relayer
	r.HandleFunc(fmt.Sprintf("/%s/valset_request/{%s}", storeName, nonce), getValsetRequestHandler(cliCtx, storeName)).Methods("GET")
	// Provides the current validator set with powers and eth addresses, useful to check the current validator state
	// used to deploy the contract by the contract deployer script
	r.HandleFunc(fmt.Sprintf("/%s/current_valset", storeName), currentValsetHandler(cliCtx, storeName)).Methods("GET")

	/// Batches

	// The Ethereum signer queries this endpoint and signs whatever it returns once per loop iteration
	r.HandleFunc(fmt.Sprintf("/%s/pending_batch_requests/{%s}", storeName, bech32ValidatorAddress), lastBatchesByAddressHandler(cliCtx, storeName)).Methods("GET")
	// Gets all outgoing batches in the batch queue, up to 100
	r.HandleFunc(fmt.Sprintf("/%s/transaction_batches", storeName), lastBatchesHandler(cliCtx, storeName)).Methods("GET")
	// Gets a specific batch request from the outgoing queue by denom
	r.HandleFunc(fmt.Sprintf("/%s/transaction_batch/{%s}/{%s}", storeName, nonce, tokenAddress), batchByNonceHandler(cliCtx, storeName)).Methods("GET")
	// This endpoint gets all of the batch confirmations for a given nonce and denom In order to determine if a batch is complete
	// the relayer will compare the valset power on the contract to the number of signatures
	r.HandleFunc(fmt.Sprintf("/%s/batch_confirm/{%s}/{%s}", storeName, nonce, tokenAddress), allBatchConfirmsHandler(cliCtx, storeName)).Methods("GET")

	/// Cosmos originated assets

	// This handler lets you retrieve the ERC20 contract corresponding to a given denom
	r.HandleFunc(fmt.Sprintf("/%s/denom_to_erc20/{%s}", storeName, denom), denomToERC20Handler(cliCtx, storeName)).Methods("GET")
	// This handler lets you retrieve the denom corresponding to a given ERC20 contract
	r.HandleFunc(fmt.Sprintf("/%s/erc20_to_denom/{%s}", storeName, tokenAddress), ERC20ToDenomHandler(cliCtx, storeName)).Methods("GET")
}
