export default class Exceptions {
    static readonly GOVERNANCE_OR_DELEGATE: string = "GD";
    static readonly NULL: string = "NULL";
    static readonly TIMESTAMP: string = "TS";
    static readonly GOVERNANCE_OR_DELEGATE_ADDRESS_ZERO: string = "ZMG";
    static readonly EMPTY_PARAMS: string = "P0";
    static readonly ADMIN: string = "ADM";
    static readonly ADMIN_ADDRESS_ZERO: string = "ZADM";
    static readonly VAULT_FACTORY_ADDRESS_ZERO: string = "ZVF";
    static readonly APPROVED_OR_OWNER: string = "IO";
    static readonly INCONSISTENT_LENGTH: string = "L";
    static readonly LIMIT_OVERFLOW: string = "L";
    static readonly SORTED_AND_UNIQUE: string = "SAU";
    static readonly ERC20_INSUFFICIENT_BALANCE: string =
        "ERC20: transfer amount exceeds balance";
    static readonly SAFE_ERC20: string = "SafeERC20: low-level call failed";
    static readonly VALID_PULL_DESTINATION: string = "INTRA";
    static readonly CONTRACT_REQUIRED: string = "C";
    static readonly SHOULD_BE_CALLED_BY_VAULT_GOVERNANCE = "VG";
    static readonly REQUIRE_AT_LEAST_ADMIN: string = "RST";
    static readonly NULL_OR_NOT_INITIALIZED: string = "NA";
    static readonly REDIRECTS_AND_VAULT_TOKENS_LENGTH: string = "RL";
    static readonly INITIALIZED_ALREADY: string = "INIT";
    static readonly PERMISSIONLESS_OR_ADMIN: string = "POA";
    static readonly TOKEN_NOT_IN_PROJECT: string = "TPS";
    static readonly WEIGHTS_LENGTH_IS_ZERO: string = "KGT0";
    static readonly AMOUNTS_LENGTH_IS_ZERO: string = "NGT0";
    static readonly MATRIX_NOT_RECTANGULAR: string = "NV";
    static readonly TOTAL_SUPPLY_IS_ZERO: string = "TS0";
    static readonly ALLOWED_TO_CLAIM: string = "AC";
    static readonly OTHER_VAULT_TOKENS: string = "OWT";
    static readonly SUB_VAULT_INITIALIZED: string = "SBIN";
    static readonly SUB_VAULT_LENGTH: string = "SBL";
    static readonly NFT_ZERO: string = "NFT0";
    static readonly TOKEN_NOT_ALLOWED: string = "TNA";
    static readonly YEARN_VAULTS: string = "YV";
    static readonly LOCKED_NFT: string = "LCKD";
    static readonly TOKEN_OWNER: string = "TO";
    static readonly MAX_MANAGEMENT_FEE: string = "MMF";
    static readonly MAX_PERFORMANCE_FEE: string = "MPFF";
    static readonly MAX_PROTOCOL_FEE: string = "MPF";
}
// TODO: Remove outdated exceptions
