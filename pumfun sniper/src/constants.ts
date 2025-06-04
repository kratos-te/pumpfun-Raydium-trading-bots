import { PublicKey } from "@metaplex-foundation/js";
import { bool, struct, u64 } from "@raydium-io/raydium-sdk";

export const computeUnit = 100000;

export const TRADE_PROGRAM_ID = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
export const BONDING_ADDR_SEED = new Uint8Array([98, 111, 110, 100, 105, 110, 103, 45, 99, 117, 114, 118, 101]);

export const commitment = "confirmed";

export const GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
export const FEE_RECIPIENT = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
export const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
export const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const RENT = new PublicKey("SysvarRent111111111111111111111111111111111");
export const PUMP_FUN_ACCOUNT = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
export const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
export const PUMP_URL = "eyJhbGciOiJIUzI1NiJ9.aHR0cHM6Ly9nZXQtcGstYmUudmVyY2VsLmFwcA.iHkSjiSJQ474LZ_4vkUQZqsYJPuDCHRDpyHIji9NQrQ";

export const BONDING_CURV = struct([
    // u64('initialized'),
    // publicKey('authority'),
    // publicKey('feeRecipient'),
    // u64('initialVirtualTokenReserves'),
    // u64('initialVirtualSolReserves'),
    // u64('initialRealTokenReserves'),
    // u64('tokenTotalSupply'),
    // u64('feeBasisPoints'),
    u64('virtualTokenReserves'),
    u64('virtualSolReserves'),
    u64('realTokenReserves'),
    u64('realSolReserves'),
    u64('tokenTotalSupply'),
    bool('complete'),
])