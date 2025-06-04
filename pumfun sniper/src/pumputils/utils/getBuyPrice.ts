function getBuyPrice(amount: bigint, tokenData: any): bigint {
  if (amount <= 0n) {
    return 0n;
  }

  // Calculate the product of virtual reserves
  let n = tokenData.virtualSolReserves * tokenData.virtualTokenReserves;

  // Calculate the new virtual sol reserves after the purchase
  let i = tokenData.virtualSolReserves + amount;

  // Calculate the new virtual token reserves after the purchase
  let r = BigInt(n / i) + 1n;

  // Calculate the amount of tokens to be purchased
  let s = tokenData.virtualTokenReserves - r;

  // Return the minimum of the calculated tokens and real token reserves
  return s < tokenData.realTokenReserves ? s : tokenData.realTokenReserves;
}

export default getBuyPrice;
