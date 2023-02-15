Possible optimizations:

1. Bit packing in checkpoint hashing:

   - Bitpack the powers and the address into one bytes32
   - Might be a 50% savings, since they are now effectively in two bytes32's
   - This might represent a 50k gas savings per checkpoint, since each checkpoint is 100k

2. Remove "\x19Ethereum Signed Message:\n32" crap from signature verification
   - This would remove one hashing per validator for a total of 20k gas with 25 signatures

Could be possible to save \$1.20 off of updateValset at 50gwei
