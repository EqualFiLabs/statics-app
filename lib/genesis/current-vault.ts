import { parseAbi } from "viem";

export const currentGenesisVaultAbi = parseAbi([
  "function quoteGenesisPurchase() view returns ((uint256 staticsPrice, uint256 reserveBuyIn, uint256 nativeFee, uint256 requiredNative, bool epochActive) quote)",
  "function quoteGenesisRedemption() view returns ((uint256 staticsPayout, uint256 reservePayout, bool epochActive) quote)",
  "function vaultAccounting() view returns ((uint256 vaultPrice, uint256 maximumSupply, uint256 mintedSupply, uint256 vaultInventory, uint256 circulatingGenesis, uint256 tokenBacking, uint256 grossBacking, uint256 outstandingGenesisCredit, uint256 requiredBacking, uint256 tokenCustody, uint256 reserveETH, uint256 nativeCustody, uint256 genesisEpochEnd, bool epochActive, uint256 reserveBackingPerGenesis) accounting)",
  "function isVaultInventory(uint256 tokenId) view returns (bool)",
]);
