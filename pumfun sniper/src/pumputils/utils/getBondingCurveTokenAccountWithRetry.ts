import * as web3 from "@solana/web3.js";
import wait from "./wait";
export default async function getBondingCurveTokenAccountWithRetry(
  connection: web3.Connection,
  bondingCurve: web3.PublicKey,
  maxRetries = 5,
  retryDelay = 1000
) {
  let accountInfo: web3.AccountInfo<Buffer> | null = null;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      accountInfo = await connection.getAccountInfo(bondingCurve);
      if (accountInfo) break;
    } catch (error) {
      console.error("Failed to get account info:", error);
    }

    retries++;
    await wait(retryDelay);
  }

  if (!accountInfo) {
    throw new Error(`Failed to get account info after ${maxRetries} retries`);
  }

  return accountInfo;
}
