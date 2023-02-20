package rest

import (
	"fmt"
	"net/http"

	"github.com/cosmos/cosmos-sdk/client"
	"github.com/cosmos/cosmos-sdk/types/rest"
	"github.com/gorilla/mux"

	"github.com/althea-net/cosmos-gravity-bridge/module/x/gravity/types"
)

func getValsetRequestHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		nonce := vars[nonce]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/valsetRequest/%s", storeName, nonce))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset not found")
			return
		}

		var out types.Valset
		cliCtx.JSONMarshaler.MustUnmarshalJSON(res, &out)
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

// USED BY RUST
func batchByNonceHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		nonce := vars[nonce]
		denom := vars[tokenAddress]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/batch/%s/%s", storeName, nonce, denom))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset not found")
			return
		}

		var out types.OutgoingTxBatch
		cliCtx.JSONMarshaler.MustUnmarshalJSON(res, &out)
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

// USED BY RUST
func lastBatchesHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/lastBatches", storeName))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset not found")
			return
		}

		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

// gets all the confirm messages for a given validator set nonce
func allValsetConfirmsHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		nonce := vars[nonce]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/valsetConfirms/%s", storeName, nonce))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset confirms not found")
			return
		}

		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

// gets all the confirm messages for a given transaction batch
func allBatchConfirmsHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		nonce := vars[nonce]
		denom := vars[tokenAddress]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/batchConfirms/%s/%s", storeName, nonce, denom))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset confirms not found")
			return
		}

		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func lastValsetRequestsHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/lastValsetRequests", storeName))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "valset requests not found")
			return
		}

		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func lastValsetRequestsByAddressHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		operatorAddr := vars[bech32ValidatorAddress]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/lastPendingValsetRequest/%s", storeName, operatorAddr))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "no pending valset requests found")
			return
		}

		var out types.Valset
		cliCtx.JSONMarshaler.MustUnmarshalJSON(res, &out)
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func lastBatchesByAddressHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		operatorAddr := vars[bech32ValidatorAddress]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/lastPendingBatchRequest/%s", storeName, operatorAddr))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusBadRequest, err.Error())
			return
		}
		if len(res) == 0 {
			rest.WriteErrorResponse(w, http.StatusNotFound, "no pending valset requests found")
			return
		}

		var out types.OutgoingTxBatch
		cliCtx.JSONMarshaler.MustUnmarshalJSON(res, &out)
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func currentValsetHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/currentValset", storeName))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		var out types.Valset
		cliCtx.JSONMarshaler.MustUnmarshalJSON(res, &out)
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func denomToERC20Handler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		denom := vars[denom]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/DenomToERC20/%s", storeName, denom))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}

func ERC20ToDenomHandler(cliCtx client.Context, storeName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		ERC20 := vars[tokenAddress]

		res, height, err := cliCtx.Query(fmt.Sprintf("custom/%s/ERC20ToDenom/%s", storeName, ERC20))
		if err != nil {
			rest.WriteErrorResponse(w, http.StatusInternalServerError, err.Error())
			return
		}
		rest.PostProcessResponse(w, cliCtx.WithHeight(height), res)
	}
}
