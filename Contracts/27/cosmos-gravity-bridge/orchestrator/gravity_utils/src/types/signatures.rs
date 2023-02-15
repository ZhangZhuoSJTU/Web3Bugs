use clarity::Signature as EthSignature;
use clarity::{abi::Token, Address as EthAddress};
use num256::Uint256;
use std::cmp::Ordering;

/// A sortable struct of a validator and it's signatures
/// this can be used for either transaction batch or validator
/// set signatures
#[derive(PartialEq, Eq, Clone, Debug)]
pub struct GravitySignature {
    pub power: u64,
    pub eth_address: EthAddress,
    pub v: Uint256,
    pub r: Uint256,
    pub s: Uint256,
}

impl Ord for GravitySignature {
    // Alex wrote the Go sorting implementation for validator
    // sets as Greatest to Least, now this isn't the convention
    // for any standard sorting implementation and Rust doesn't
    // really like it when you implement sort yourself. It prefers
    // Ord. So here we implement Ord with the Eth address sorting
    // reversed, since they are also sorted greatest to least in
    // the Cosmos module. Then we can call .sort and .reverse and get
    // the same sorting as the Cosmos module.
    fn cmp(&self, other: &Self) -> Ordering {
        if self.power != other.power {
            self.power.cmp(&other.power)
        } else {
            self.eth_address.cmp(&other.eth_address).reverse()
        }
    }
}

impl PartialOrd for GravitySignature {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// signatures in array formats ready to be
/// submitted to the Gravity Ethereum Contract
pub struct GravitySignatureArrays {
    pub addresses: Vec<EthAddress>,
    pub powers: Vec<u64>,
    pub v: Token,
    pub r: Token,
    pub s: Token,
}

/// This function handles converting the GravitySignature type into an Ethereum
/// submittable arrays, including the finicky token encoding tricks you need to
/// perform in order to distinguish between a uint8[] and bytes32[]
pub fn to_arrays(input: Vec<GravitySignature>) -> GravitySignatureArrays {
    let mut addresses = Vec::new();
    let mut powers = Vec::new();
    let mut v = Vec::new();
    let mut r = Vec::new();
    let mut s = Vec::new();
    for val in input {
        addresses.push(val.eth_address);
        powers.push(val.power);
        v.push(val.v);
        r.push(val.r);
        s.push(val.s);
    }
    GravitySignatureArrays {
        addresses,
        powers,
        v: v.into(),
        r: r.into(),
        s: s.into(),
    }
}

#[derive(Serialize, Deserialize, Debug, Default, Clone, Eq, PartialEq, Hash)]
pub struct SigWithAddress {
    pub eth_address: EthAddress,
    pub eth_signature: EthSignature,
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::seq::SliceRandom;
    use rand::thread_rng;

    #[test]
    fn test_valset_sort() {
        let correct: [GravitySignature; 8] = [
            GravitySignature {
                power: 685294939,
                eth_address: "0x479FFc856Cdfa0f5D1AE6Fa61915b01351A7773D"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 678509841,
                eth_address: "0x6db48cBBCeD754bDc760720e38E456144e83269b"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 671724742,
                eth_address: "0x0A7254b318dd742A3086882321C27779B4B642a6"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 671724742,
                eth_address: "0x454330deAaB759468065d08F2b3B0562caBe1dD1"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 671724742,
                eth_address: "0x8E91960d704Df3fF24ECAb78AB9df1B5D9144140"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 617443955,
                eth_address: "0x3511A211A6759d48d107898302042d1301187BA9"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 291759231,
                eth_address: "0xF14879a175A2F1cEFC7c616f35b6d9c2b0Fd8326"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
            GravitySignature {
                power: 6785098,
                eth_address: "0x37A0603dA2ff6377E5C7f75698dabA8EE4Ba97B8"
                    .parse()
                    .unwrap(),
                v: 0u64.into(),
                r: 0u64.into(),
                s: 0u64.into(),
            },
        ];
        let mut rng = thread_rng();
        let mut incorrect = correct.clone();

        incorrect.shuffle(&mut rng);
        assert_ne!(incorrect, correct);

        incorrect.sort();
        incorrect.reverse();
        assert_eq!(incorrect, correct);
    }
}
