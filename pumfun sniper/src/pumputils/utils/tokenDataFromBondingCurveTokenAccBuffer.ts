import { bool, struct, u64 } from "@coral-xyz/borsh";

function tokenDataFromBondingCurveTokenAccBuffer(buffer: Buffer) {
  const structure: any = struct([
    u64("discriminator"),
    u64("virtualTokenReserves"),
    u64("virtualSolReserves"),
    u64("realTokenReserves"),
    u64("realSolReserves"),
    u64("tokenTotalSupply"),
    bool("complete"),
  ]);

  let value = structure.decode(buffer);
  return {
    discriminator: BigInt(value.discriminator),
    virtualTokenReserves: BigInt(value.virtualTokenReserves),
    virtualSolReserves: BigInt(value.virtualSolReserves),
    realTokenReserves: BigInt(value.realTokenReserves),
    realSolReserves: BigInt(value.realSolReserves),
    tokenTotalSupply: BigInt(value.tokenTotalSupply),
    complete: value.complete,
  };
}

export default tokenDataFromBondingCurveTokenAccBuffer;
