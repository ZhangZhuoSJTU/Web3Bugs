use super::*;
use crate::error::GravityError;
use clarity::Signature as EthSignature;
use clarity::{abi::Token, Address as EthAddress};
use deep_space::Address as CosmosAddress;

/// This represents an individual transaction being bridged over to Ethereum
/// parallel is the OutgoingTransferTx in x/gravity/types/batch.go
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BatchTransaction {
    pub id: u64,
    pub sender: CosmosAddress,
    pub destination: EthAddress,
    pub erc20_token: Erc20Token,
    pub erc20_fee: Erc20Token,
}

impl BatchTransaction {
    pub fn from_proto(
        input: gravity_proto::gravity::OutgoingTransferTx,
    ) -> Result<Self, GravityError> {
        if input.erc20_fee.is_none() || input.erc20_token.is_none() {
            return Err(GravityError::InvalidBridgeStateError(
                "Can not have tx with null erc20_token!".to_string(),
            ));
        }
        Ok(BatchTransaction {
            id: input.id,
            sender: input.sender.parse()?,
            destination: input.dest_address.parse()?,
            erc20_token: Erc20Token::from_proto(input.erc20_token.unwrap())?,
            erc20_fee: Erc20Token::from_proto(input.erc20_fee.unwrap())?,
        })
    }
}

/// the response we get when querying for a valset confirmation
#[derive(Serialize, Deserialize, Debug, Default, Clone)]
pub struct TransactionBatch {
    pub nonce: u64,
    pub batch_timeout: u64,
    pub transactions: Vec<BatchTransaction>,
    pub total_fee: Erc20Token,
    pub token_contract: EthAddress,
}

impl TransactionBatch {
    /// extracts the amounts, destinations and fees as submitted to the Ethereum contract
    /// and used for signatures
    pub fn get_checkpoint_values(&self) -> (Token, Token, Token) {
        let mut amounts = Vec::new();
        let mut destinations = Vec::new();
        let mut fees = Vec::new();
        for item in self.transactions.iter() {
            amounts.push(Token::Uint(item.erc20_token.amount.clone()));
            fees.push(Token::Uint(item.erc20_fee.amount.clone()));
            destinations.push(item.destination)
        }
        assert_eq!(amounts.len(), destinations.len());
        assert_eq!(fees.len(), destinations.len());
        (
            Token::Dynamic(amounts),
            destinations.into(),
            Token::Dynamic(fees),
        )
    }

    pub fn from_proto(
        input: gravity_proto::gravity::OutgoingTxBatch,
    ) -> Result<Self, GravityError> {
        let mut transactions = Vec::new();
        let mut running_total_fee: Option<Erc20Token> = None;
        for tx in input.transactions {
            let tx = BatchTransaction::from_proto(tx)?;
            if let Some(total_fee) = running_total_fee {
                running_total_fee = Some(Erc20Token {
                    token_contract_address: total_fee.token_contract_address,
                    amount: total_fee.amount + tx.erc20_fee.amount.clone(),
                });
            } else {
                running_total_fee = Some(tx.erc20_fee.clone())
            }
            transactions.push(tx);
        }
        if let Some(total_fee) = running_total_fee {
            Ok(TransactionBatch {
                batch_timeout: input.batch_timeout,
                nonce: input.batch_nonce,
                transactions,
                token_contract: total_fee.token_contract_address,
                total_fee,
            })
        } else {
            Err(GravityError::InvalidBridgeStateError(
                "Transaction batch containing no transactions!".to_string(),
            ))
        }
    }
}

/// the response we get when querying for a batch confirmation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BatchConfirmResponse {
    pub nonce: u64,
    pub orchestrator: CosmosAddress,
    pub token_contract: EthAddress,
    pub ethereum_signer: EthAddress,
    pub eth_signature: EthSignature,
}

impl BatchConfirmResponse {
    pub fn from_proto(
        input: gravity_proto::gravity::MsgConfirmBatch,
    ) -> Result<Self, GravityError> {
        Ok(BatchConfirmResponse {
            nonce: input.nonce,
            orchestrator: input.orchestrator.parse()?,
            token_contract: input.token_contract.parse()?,
            ethereum_signer: input.eth_signer.parse()?,
            eth_signature: input.signature.parse()?,
        })
    }
}

impl Confirm for BatchConfirmResponse {
    fn get_eth_address(&self) -> EthAddress {
        self.ethereum_signer
    }
    fn get_signature(&self) -> EthSignature {
        self.eth_signature.clone()
    }
}
