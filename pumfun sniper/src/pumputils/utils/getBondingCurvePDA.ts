import * as web3 from "@solana/web3.js";
const BONDING_CURVE_SEED = "bonding-curve";
function getBondingCurvePDA(mint: web3.PublicKey, programId: web3.PublicKey) {
  return web3.PublicKey.findProgramAddressSync([Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()], programId)[0];
}
export default getBondingCurvePDA;
