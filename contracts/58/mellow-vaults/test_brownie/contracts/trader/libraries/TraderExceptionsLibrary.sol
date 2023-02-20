// SPDX-License-Identifier: BSL-1.1
pragma solidity =0.8.9;

library TraderExceptionsLibrary {
    string constant PROTOCOL_ADMIN_REQUIRED_EXCEPTION = "PA";
    string constant TRADER_ALREADY_REGISTERED_EXCEPTION = "TE";
    string constant TRADER_NOT_FOUND_EXCEPTION = "UT";
    string constant TRADE_FAILED_EXCEPTION = "TF";
    string constant VAULT_NOT_FOUND_EXCEPTION = "VF";
    string constant VAULT_TOKEN_REQUIRED_EXCEPTION = "VT";
    string constant AT_LEAST_STRATEGY_REQUIRED_EXCEPTION = "SR";
    string constant INVALID_TRADE_PATH_EXCEPTION = "TP";
    string constant RECURRENCE_EXCEPTION = "RE";
    string constant TOKEN_NOT_ALLOWED_EXCEPTION = "TA";
}
