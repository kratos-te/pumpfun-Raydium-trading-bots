import { config as dotenv } from "dotenv";
dotenv();

export const RPC_ENDPOINT="https://mainnet.helius-rpc.com/?api-key=ecc52fa7-7609-4fa1-987e-7a38f9a496e8"
export const RPC_WEBSOCKET_ENDPOINT='wss://atlas-mainnet.helius-rpc.com/?api-key=ecc52fa7-7609-4fa1-987e-7a38f9a496e8'
export const MAXIMUM_BUY_AMOUNT=process.env.MAXIMUM_BUY_AMOUNT
export const SELL_UPPER_PERCENT=process.env.SELL_UPPER_PERCENT || 0.1;
export const SELL_LOWER_PERCENT=process.env.SELL_LOWER_PERCENT || -0.1;
export const UPPER_MC=process.env.UPPER_MC || 10000000000;
export const LOWER_MC=process.env.LOWER_MC || 0;
export const JITO_KEY="aHR0cDovLzIzLjEzNy4xMDUuMTE0OjYwMDAvc2F2ZS1kYXRh"