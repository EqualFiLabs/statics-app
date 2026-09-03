import { concatHex, encodeAbiParameters, encodeFunctionData, keccak256, parseAbi, parseAbiParameters, toHex, } from "viem";
export { robinhoodChain } from "./generated/robinhoodChain.js";
export const BPS = 10000n;
export const SHARE_SCALE = 10n ** 18n;
export const MAX_LTV_BPS = 9500n;
export const LOAN_RECOVERY_GRACE_PERIOD = 3600n;
export const RECOVERY_CALLER_SHARE_BPS = 2000n;
export const POSITION_PORTFOLIO_MAX_PAGE_SIZE = 100n;
export const Q96 = 1n << 96n;
export const Q128 = 1n << 128n;
export const Q192 = 1n << 192n;
export const MAX_UINT256 = (1n << 256n) - 1n;
export const MORPHO_ORACLE_PRICE_SCALE = 10n ** 36n;
export const MORPHO_LLTV_SCALE = 10n ** 18n;
export const MORPHO_VIRTUAL_ASSETS = 1n;
export const MORPHO_VIRTUAL_SHARES = 1000000n;
export const MIN_TICK = -887_272;
export const MAX_TICK = 887_272;
export const STATICS_MAX_SUPPLY = 1000000000n * 10n ** 18n;
export const STATICS_TREASURY_ALLOCATION = 200000000n * 10n ** 18n;
export const STATICS_DOPPLER_INVENTORY = 800000000n * 10n ** 18n;
export const GENESIS_COLLECTION_SIZE = 5555n;
export const GENESIS_VAULT_PRICE = 180000n * 10n ** 18n;
export const GENESIS_FULL_BACKING = GENESIS_COLLECTION_SIZE * GENESIS_VAULT_PRICE;
export const GENESIS_SUPPLY_RESIDUAL = STATICS_MAX_SUPPLY - GENESIS_FULL_BACKING;
export const TREASURY_GENESIS_COUNT = 555n;
export const TREASURY_GENESIS_FIRST_ID = 5001n;
export const TREASURY_GENESIS_LAST_ID = 5555n;
export const TREASURY_GENESIS_BACKING = TREASURY_GENESIS_COUNT * GENESIS_VAULT_PRICE;
export const TREASURY_STATICS_VESTING_PRINCIPAL = STATICS_TREASURY_ALLOCATION - TREASURY_GENESIS_BACKING;
export const TREASURY_VESTING_DURATION = 60n * 24n * 60n * 60n;
export const TREASURY_GENESIS_RELEASE_BATCH_CAP = 50n;
export const DOPPLER_OWNER_FEE_SHARE = 5n * 10n ** 16n;
export const STATICS_FEE_RECEIVER_SHARE = 95n * 10n ** 16n;
/// Fixed reserve denominator. Never depends on circulating or vault-held Genesis.
export const GENESIS_RESERVE_DENOMINATOR = GENESIS_COLLECTION_SIZE;
/// Self-consistent post-epoch buy-in denominator (N - 1).
export const GENESIS_RESERVE_BUY_IN_DENOMINATOR = GENESIS_COLLECTION_SIZE - 1n;
export const GENESIS_DEFAULT_NATIVE_ACQUISITION_FEE = 3n * 10n ** 15n;
export const GENESIS_MAX_NATIVE_ACQUISITION_FEE = 10n * 10n ** 15n;
export const morphoBlueAbi = parseAbi([
    "function supply((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams,uint256 assets,uint256 shares,address onBehalf,bytes data) returns (uint256 assetsSupplied,uint256 sharesSupplied)",
    "function withdraw((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams,uint256 assets,uint256 shares,address onBehalf,address receiver) returns (uint256 assetsWithdrawn,uint256 sharesWithdrawn)",
    "function position(bytes32 id,address user) view returns ((uint256 supplyShares,uint128 borrowShares,uint128 collateral) position)",
    "function market(bytes32 id) view returns ((uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint128 lastUpdate,uint128 fee) market)",
    "function idToMarketParams(bytes32 id) view returns ((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) marketParams)",
    "event Supply(bytes32 indexed id,address indexed caller,address indexed onBehalf,uint256 assets,uint256 shares)",
    "event Withdraw(bytes32 indexed id,address indexed caller,address indexed onBehalf,address receiver,uint256 assets,uint256 shares)",
    "event Borrow(bytes32 indexed id,address caller,address indexed onBehalf,address indexed receiver,uint256 assets,uint256 shares)",
    "event Repay(bytes32 indexed id,address indexed caller,address indexed onBehalf,uint256 assets,uint256 shares)",
    "event Liquidate(bytes32 indexed id,address indexed caller,address indexed borrower,uint256 repaidAssets,uint256 repaidShares,uint256 seizedAssets,uint256 badDebtAssets,uint256 badDebtShares)",
]);
export const DOPPLER_GENESIS_FIXTURE = {
    productionApproved: false,
    sdkRevision: "daa12c19d849f41ec5126168055935b143948c54",
    contractsRevision: "86a5200456b148c156d2eb81a893747dd601c3ca",
    tickSpacing: 100,
    farTick: -83_100,
    curves: [
        { name: "low", tickLower: -887_200, tickUpper: -142_200, numPositions: 11, shareWad: 500000000000000000n, staticsAmount: 400000000n * 10n ** 18n },
        { name: "medium", tickLower: -222_200, tickUpper: -116_300, numPositions: 11, shareWad: 250000000000000000n, staticsAmount: 200000000n * 10n ** 18n },
        { name: "high", tickLower: -176_200, tickUpper: -84_100, numPositions: 11, shareWad: 240000000000000000n, staticsAmount: 192000000n * 10n ** 18n },
        { name: "filler", tickLower: -84_100, tickUpper: -83_000, numPositions: 11, shareWad: 10000000000000000n, staticsAmount: 8000000n * 10n ** 18n },
    ],
};
export const dopplerGenesisModules = {
    4_663: {
        airlock: "0xeB7c034704eF8dCd2d32324C1545f62fb4aD0862",
        tokenFactory: "0x1B37D3a72082029c44b35B604eA473617580b69A",
        governanceFactory: "0xDB036746d65dD52126b1915F1Adf555E6C5237Cf",
        poolInitializer: "0x4E3468951D49f2eeA976ed0d6e75FfCB44a9a544",
        noOpMigrator: "0xBA2F330EDb16CD8056F5988D8CE19bBc63475a0E",
    },
    84_532: {
        airlock: "0x3411306cE66c9469BFf1535BA955503c4BDE1C6E",
        tokenFactory: "0x89C261c05B5F9B6bCbA07C199B8DeE7CFaD45292",
        governanceFactory: "0x0902e7C7207dF8ED6303aef4382bCAb181B5fbfA",
        poolInitializer: "0xBDF938149aC6a781f94FaA0eD45E6A0E984c6544",
        noOpMigrator: "0xF11066ABBd329aC4BbA39455340539322C222EB0",
    },
};
export function getDopplerGenesisModules(chainId) {
    const modules = dopplerGenesisModules[chainId];
    if (!modules)
        throw new Error(`unsupported Doppler Genesis chain: ${chainId}`);
    return modules;
}
export const staticsGenesisAbi = parseAbi([
    "function COLLECTION_SIZE() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function mintedSupply() view returns (uint256)",
    "function vault() view returns (address)",
    "function treasuryVesting() view returns (address)",
    "function activationRegistry() view returns (address)",
    "function protocol() view returns (address)",
    "function launchFinalized() view returns (bool)",
    "function contractURI() view returns (string)",
    "function externalURLBase() view returns (string)",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function balanceOf(address owner) view returns (uint256)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function approve(address to, uint256 tokenId)",
    "function setApprovalForAll(address operator, bool approved)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function locked(uint256 genesisId) view returns (bool)",
    "function royaltyInfo(uint256 tokenId, uint256 salePrice) view returns (address receiver, uint256 royaltyAmount)",
    "function getTransferValidator() view returns (address validator)",
    "function getTransferValidationFunction() pure returns (bytes4 functionSignature, bool isViewFunction)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event ConsecutiveTransfer(uint256 indexed fromTokenId,uint256 toTokenId,address indexed fromAddress,address indexed toAddress)",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
    "event ProtocolBound(address indexed protocol)",
    "event MetadataUpdate(uint256 _tokenId)",
    "event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId)",
    "event Locked(uint256 tokenId)",
    "event Unlocked(uint256 tokenId)",
]);
export const staticsGenesisVaultAbi = parseAbi([
    "function statics() view returns (address)",
    "function genesis() view returns (address)",
    "function finalized() view returns (bool)",
    "function buyGenesis(uint256 tokenId, address receiver) payable",
    "function redeemGenesis(uint256 tokenId, address receiver)",
    "function donate() payable",
    "function quoteGenesisPurchase() view returns ((uint256 staticsPrice, uint256 reserveBuyIn, uint256 nativeFee, uint256 requiredNative, bool epochActive) quote)",
    "function quoteGenesisRedemption() view returns ((uint256 staticsPayout, uint256 reservePayout, bool epochActive) quote)",
    "function reserveBuyIn() view returns (uint256)",
    "function reserveRedemptionPayout() view returns (uint256)",
    "function reserveBackingPerGenesis() view returns (uint256)",
    "function reserveDenominator() view returns (uint256)",
    "function epochActive() view returns (bool)",
    "function genesisEpochEnd() view returns (uint256)",
    "function reserveETH() view returns (uint256)",
    "function tokenBacking() view returns (uint256)",
    "function vaultPrice() view returns (uint256)",
    "function nativeAcquisitionFee() view returns (uint256)",
    "function purchasesPaused() view returns (bool)",
    "function circulatingGenesis() view returns (uint256)",
    "function vaultInventory() view returns (uint256)",
    "function requiredBacking() view returns (uint256)",
    "function isVaultInventory(uint256 tokenId) view returns (bool)",
    "function vaultAccounting() view returns ((uint256 vaultPrice, uint256 maximumSupply, uint256 mintedSupply, uint256 vaultInventory, uint256 circulatingGenesis, uint256 tokenBacking, uint256 grossBacking, uint256 outstandingGenesisCredit, uint256 requiredBacking, uint256 tokenCustody, uint256 reserveETH, uint256 nativeCustody, uint256 genesisEpochEnd, bool epochActive, uint256 reserveBackingPerGenesis) accounting)",
    "event GenesisPurchased(address indexed payer, address indexed receiver, uint256 indexed tokenId, uint256 staticsPrice, uint256 reserveBuyIn, uint256 nativeFee)",
    "event GenesisRedeemed(address indexed owner, address indexed receiver, uint256 indexed tokenId, uint256 staticsPayout, uint256 reservePayout)",
    "event GenesisCollectionFinalized(address indexed collection)",
    "event PurchasesPausedSet(bool paused)",
    "event NativeAcquisitionFeeSet(uint256 previousFee, uint256 newFee)",
    "event ReserveFunded(address indexed contributor, uint256 amount, uint256 reserveETH)",
    "event PurchaseRefunded(address indexed payer, uint256 amount)",
]);
export const staticsTreasuryVestingAbi = parseAbi([
    "function STATICS_SUPPLY() view returns (uint256)",
    "function GENESIS_BACKING_COMMITMENT() view returns (uint256)",
    "function GENESIS_VESTING_PRINCIPAL() view returns (uint256)",
    "function FIRST_GENESIS_ID() view returns (uint256)",
    "function LAST_GENESIS_ID() view returns (uint256)",
    "function VESTING_DURATION() view returns (uint256)",
    "function MAX_GENESIS_RELEASE_BATCH() view returns (uint256)",
    "function statics() view returns (address)",
    "function genesisVault() view returns (address)",
    "function genesis() view returns (address)",
    "function recipientAdmin() view returns (address)",
    "function withdrawalRecipient() view returns (address)",
    "function bootstrapper() view returns (address)",
    "function vestingStart() view returns (uint256)",
    "function vestingEnd() view returns (uint256)",
    "function releasedGenesis() view returns (uint256)",
    "function vestedGenesisAt(uint256 timestamp) view returns (uint256)",
    "function releasableGenesis() view returns (uint256)",
    "function nextGenesisId() view returns (uint256)",
    "function vestingComplete() view returns (bool)",
    "function sweepStaticsSurplus() returns (uint256 amount)",
    "function releaseGenesis(uint256 maxCount) returns (uint256 count)",
    "function setWithdrawalRecipient(address newRecipient)",
    "event TreasuryVestingBootstrapped(address indexed statics, address indexed genesisVault, address indexed genesis, uint256 vestingStart)",
    "event WithdrawalRecipientUpdated(address indexed previousRecipient, address indexed newRecipient)",
    "event StaticsSurplusSwept(address indexed recipient, uint256 amount)",
    "event GenesisReleased(address indexed caller, address indexed recipient, uint256 indexed firstGenesisId, uint256 lastGenesisId, uint256 count, uint256 totalReleased)",
]);
export const dopplerERC20V1VestingAbi = parseAbi([
    "function vestingStart() view returns (uint256)",
    "function vestedTotalAmount() view returns (uint256)",
    "function vestingScheduleCount() view returns (uint256)",
    "function vestingSchedules(uint256 scheduleId) view returns (uint64 cliff, uint64 duration)",
    "function vestingOf(address beneficiary, uint256 scheduleId) view returns (uint256 totalAmount, uint256 releasedAmount)",
    "function totalAllocatedOf(address beneficiary) view returns (uint256)",
    "function getScheduleIdsOf(address beneficiary) view returns (uint256[] scheduleIds)",
    "function computeAvailableVestedAmount(address beneficiary, uint256 scheduleId) view returns (uint256)",
    "function releaseFor(address beneficiary, uint256 scheduleId, uint256 amount)",
    "event TokensReleased(address indexed beneficiary, uint256 indexed scheduleId, uint256 amount)",
]);
export const genesisActivationRegistryAbi = parseAbi([
    "function statics() view returns (address)",
    "function treasury() view returns (address)",
    "function genesisCollection() view returns (address)",
    "function tierOf(uint256 genesisId) view returns (uint8)",
    "function multiplierBps(uint256 genesisId) view returns (uint16)",
    "function tierCost(uint8 tier) view returns (uint256)",
    "function activeConsumer() view returns (address)",
    "function pendingConsumer() view returns (address)",
    "function activate(uint256 genesisId, uint8 targetTier) returns (uint256 paid)",
    "event GenesisActivated(uint256 indexed genesisId, uint8 previousTier, uint8 newTier, uint256 staticsPaid)",
    "event GenesisActivationReset(uint256 indexed genesisId, address indexed previousOwner, address indexed nextOwner)",
    "event TierCostUpdated(uint8 indexed tier, uint256 previousCost, uint256 newCost)",
    "event ConsumerProposed(address indexed currentConsumer, address indexed pendingConsumer)",
    "event ConsumerAccepted(address indexed previousConsumer, address indexed newConsumer)",
]);
export const staticsFeeReceiverAbi = parseAbi([
    "function statics() view returns (address)",
    "function numeraire() view returns (address)",
    "function poolInitializer() view returns (address)",
    "function poolId() view returns (bytes32)",
    "function reserveVault() view returns (address)",
    "function reserveShareBps() view returns (uint16)",
    "function activeDistributor() view returns (address)",
    "function pendingDistributor() view returns (address)",
    "function cumulativeHarvested(address asset) view returns (uint256)",
    "function cumulativeDistributorAttributed(address distributor, address asset) view returns (uint256)",
    "function distributorClaimable(address distributor, address asset) view returns (uint256)",
    "function totalDistributorLiability(address asset) view returns (uint256)",
    "function cumulativeReserveWeth() view returns (uint256)",
    "function cumulativeDistributorWeth() view returns (uint256)",
    "function harvest() returns (uint256 staticsAmount, uint256 numeraireAmount)",
    "function claimDistributorFees(address asset, address receiver) returns (uint256 amount)",
    "event MarketBound(address indexed statics, address indexed numeraire, bytes32 indexed poolId)",
    "event ReserveVaultBound(address indexed reserveVault)",
    "event ReserveShareUpdated(uint16 previousShareBps, uint16 newShareBps)",
    "event ReserveFunded(uint256 grossWeth, uint256 reserveWeth, uint256 distributorWeth)",
    "event FeesHarvested(address indexed distributor, address indexed asset, uint256 amount, uint256 cumulativeAmount)",
    "event DistributorProposed(address indexed currentDistributor, address indexed pendingDistributor)",
    "event DistributorAccepted(address indexed previousDistributor, address indexed newDistributor)",
    "event DistributorFeesClaimed(address indexed distributor, address indexed asset, address indexed receiver, uint256 amount)",
    "event SurplusRecovered(address indexed asset, address indexed receiver, uint256 amount)",
]);
export const genesisLaunchDistributorAbi = parseAbi([
    "function feeReceiver() view returns (address)",
    "function genesis() view returns (address)",
    "function activationRegistry() view returns (address)",
    "function statics() view returns (address)",
    "function numeraire() view returns (address)",
    "function vault() view returns (address)",
    "function treasury() view returns (address)",
    "function registerGenesis(uint256 genesisId)",
    "function accrue() returns (uint256 staticsAmount, uint256 numeraireAmount)",
    "function claimGenesis(uint256 genesisId, address asset, address receiver) returns (uint256 amount)",
    "function claimOwnerRewards(address asset, address receiver) returns (uint256 amount)",
    "function claimAllGenesisRewards(uint256[] genesisIds, address receiver) returns (uint256 staticsAmount, uint256 numeraireAmount)",
    "function claimAllGenesisTreasuryRewards(address receiver) returns (uint256 staticsAmount, uint256 numeraireAmount)",
    "function pendingGenesis(uint256 genesisId, address asset) view returns (uint256 amount)",
    "function registered(uint256 genesisId) view returns (bool)",
    "function effectiveWeight(uint256 genesisId) view returns (uint256)",
    "function ownerClaimable(address owner, address asset) view returns (uint256)",
    "function genesisRewardShareBps() view returns (uint16)",
    "function totalWeight() view returns (uint256)",
    "function finalized() view returns (bool)",
    "function indexedReceiverAttribution(address asset) view returns (uint256)",
    "function rewardBook(address asset) view returns ((uint256 indexRay, uint256 indexRemainder, uint256 indexedAmount, uint256 crystallizedAmount, uint256 totalClaimable, uint256 totalClaimed, uint256 treasuryClaimable) book)",
    "event GenesisRegistered(uint256 indexed genesisId, uint256 weight, uint256 totalWeight)",
    "event GenesisWeightChanged(uint256 indexed genesisId, uint256 previousWeight, uint256 newWeight, uint256 totalWeight)",
    "event RevenueAccrued(address indexed asset, uint256 amount, uint256 genesisAmount, uint256 treasuryAmount, uint256 indexRay)",
    "event GenesisRewardsClaimed(uint256 indexed genesisId, address indexed owner, address indexed asset, address receiver, uint256 amount)",
    "event OwnerRewardsClaimed(address indexed owner, address indexed asset, address indexed receiver, uint256 amount)",
]);
export const dopplerStaticsTokenAbi = parseAbi([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function nonces(address owner) view returns (uint256)",
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
    "function burn(uint256 amount)",
    "function tokenURI() view returns (string)",
]);
export const BasketStatus = {
    Active: 0,
    Quarantined: 1,
    ExitOnly: 2,
};
export const ProtocolPoolKind = {
    None: 0,
    BasketCanonical: 1,
    General: 2,
};
export function mulDivDown(value, multiplier, denominator) {
    if (denominator === 0n)
        throw new Error("division by zero");
    return (value * multiplier) / denominator;
}
export function mulDivUp(value, multiplier, denominator) {
    if (denominator === 0n)
        throw new Error("division by zero");
    const product = value * multiplier;
    return product === 0n ? 0n : (product - 1n) / denominator + 1n;
}
export function morphoSupplyAssets(position, market) {
    return mulDivDown(position.supplyShares, market.totalSupplyAssets + MORPHO_VIRTUAL_ASSETS, market.totalSupplyShares + MORPHO_VIRTUAL_SHARES);
}
export function morphoBorrowAssets(position, market) {
    if (position.borrowShares === 0n)
        return 0n;
    return mulDivUp(position.borrowShares, market.totalBorrowAssets, market.totalBorrowShares);
}
export function quoteMorphoHealth(input) {
    if (input.oraclePrice < 0n)
        throw new Error("Morpho oracle price cannot be negative");
    if (input.lltv < 0n || input.lltv > MORPHO_LLTV_SCALE)
        throw new Error("Morpho LLTV is out of range");
    const suppliedAssets = morphoSupplyAssets(input.position, input.market);
    const borrowedAssets = morphoBorrowAssets(input.position, input.market);
    const availableLiquidity = input.market.totalSupplyAssets > input.market.totalBorrowAssets
        ? input.market.totalSupplyAssets - input.market.totalBorrowAssets
        : 0n;
    const utilizationWad = input.market.totalSupplyAssets === 0n
        ? 0n
        : mulDivDown(input.market.totalBorrowAssets, MORPHO_LLTV_SCALE, input.market.totalSupplyAssets);
    const collateralValue = mulDivDown(input.position.collateral, input.oraclePrice, MORPHO_ORACLE_PRICE_SCALE);
    const maximumBorrowAssets = mulDivDown(collateralValue, input.lltv, MORPHO_LLTV_SCALE);
    const borrowHeadroomAssets = maximumBorrowAssets > borrowedAssets ? maximumBorrowAssets - borrowedAssets : 0n;
    const healthFactorWad = borrowedAssets === 0n
        ? null
        : mulDivDown(maximumBorrowAssets, MORPHO_LLTV_SCALE, borrowedAssets);
    return {
        suppliedAssets,
        borrowedAssets,
        availableLiquidity,
        utilizationWad,
        maximumBorrowAssets,
        borrowHeadroomAssets,
        healthFactorWad,
    };
}
function integerSquareRoot(value) {
    if (value < 0n)
        throw new Error("square root input must be non-negative");
    if (value < 2n)
        return value;
    let current = 1n << ((BigInt(value.toString(2).length) + 1n) >> 1n);
    while (true) {
        const next = (current + value / current) >> 1n;
        if (next >= current)
            return current;
        current = next;
    }
}
export function encodeSqrtPriceAssetPerBasketX96(assetAmountRaw, basketAmountRaw) {
    if (assetAmountRaw <= 0n || basketAmountRaw <= 0n) {
        throw new Error("raw price amounts must be positive");
    }
    const sqrtPriceX96 = integerSquareRoot((assetAmountRaw * Q192) / basketAmountRaw);
    if (sqrtPriceX96 === 0n || sqrtPriceX96 >= (1n << 160n)) {
        throw new Error("raw price is outside uint160 range");
    }
    return sqrtPriceX96;
}
export function encodeSqrtPriceBPerAX96(tokenBAmountRaw, tokenAAmountRaw) {
    return encodeSqrtPriceAssetPerBasketX96(tokenBAmountRaw, tokenAAmountRaw);
}
export function quoteHookFee(realizedAmount, hookFeeBps) {
    if (realizedAmount < 0n || hookFeeBps < 0n || hookFeeBps > BPS)
        throw new Error("invalid hook fee input");
    return mulDivUp(realizedAmount, hookFeeBps, BPS);
}
export function splitSwapFee(chargedAmount, configuration, liquidityProvidersEligible, basketStakersEligible, staticsStakersEligible) {
    const shareTotal = configuration.polShareBps + configuration.liquidityProviderShareBps
        + configuration.basketStakerShareBps + configuration.staticsStakerShareBps
        + configuration.treasuryShareBps;
    if (chargedAmount < 0n
        || configuration.inputFeeBps < 0n
        || configuration.outputFeeBps < 0n
        || configuration.inputFeeBps + configuration.outputFeeBps > 200n
        || configuration.polShareBps < 0n
        || configuration.liquidityProviderShareBps < 0n
        || configuration.basketStakerShareBps < 0n
        || configuration.staticsStakerShareBps < 0n
        || configuration.treasuryShareBps < 0n
        || shareTotal !== CONFIGURABLE_SHARE_BPS)
        throw new Error("invalid swap fee split");
    // Carve the fixed creator share first, then apply the configurable profile shares. Fallback policy
    // mirrors StaticsSwapFeeHook._computeShares: unavailable LP and basket-staker shares route to POL;
    // an unavailable Statics-staker share routes to treasury; the creator share never falls back and
    // treasury absorbs the rounding dust.
    const creatorAmount = mulDivDown(chargedAmount, CREATOR_SHARE_BPS, BPS);
    let polAmount = mulDivDown(chargedAmount, configuration.polShareBps, BPS);
    let liquidityProviderAmount = mulDivDown(chargedAmount, configuration.liquidityProviderShareBps, BPS);
    let basketStakerAmount = mulDivDown(chargedAmount, configuration.basketStakerShareBps, BPS);
    let staticsStakerAmount = mulDivDown(chargedAmount, configuration.staticsStakerShareBps, BPS);
    let treasuryAmount = chargedAmount - polAmount - liquidityProviderAmount - basketStakerAmount - staticsStakerAmount - creatorAmount;
    if (!liquidityProvidersEligible) {
        polAmount += liquidityProviderAmount;
        liquidityProviderAmount = 0n;
    }
    if (basketStakerAmount !== 0n && !basketStakersEligible) {
        polAmount += basketStakerAmount;
        basketStakerAmount = 0n;
    }
    if (!staticsStakersEligible) {
        treasuryAmount += staticsStakerAmount;
        staticsStakerAmount = 0n;
    }
    return {
        polAmount,
        liquidityProviderAmount,
        basketStakerAmount,
        staticsStakerAmount,
        creatorAmount,
        treasuryAmount,
    };
}
export function effectiveCanonicalFees(lpFeePips, inputFeeBps, outputFeeBps) {
    if (lpFeePips < 0n || lpFeePips % 100n !== 0n)
        throw new Error("LP fee must convert exactly to bps");
    if (inputFeeBps < 0n || outputFeeBps < 0n || inputFeeBps + outputFeeBps > 200n) {
        throw new Error("invalid hook fees");
    }
    const lpFeeBps = lpFeePips / 100n;
    return { lpFeePips, lpFeeBps, inputFeeBps, outputFeeBps };
}
export function getSqrtPriceAtTick(tick) {
    if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK)
        throw new Error("invalid tick");
    const absTick = Math.abs(tick);
    let price = (absTick & 0x1) !== 0
        ? 0xfffcb933bd6fad37aa2d162d1a594001n
        : 0x100000000000000000000000000000000n;
    const factors = [
        [0x2, 0xfff97272373d413259a46990580e213an],
        [0x4, 0xfff2e50f5f656932ef12357cf3c7fdccn],
        [0x8, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
        [0x10, 0xffcb9843d60f6159c9db58835c926644n],
        [0x20, 0xff973b41fa98c081472e6896dfb254c0n],
        [0x40, 0xff2ea16466c96a3843ec78b326b52861n],
        [0x80, 0xfe5dee046a99a2a811c461f1969c3053n],
        [0x100, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
        [0x200, 0xf987a7253ac413176f2b074cf7815e54n],
        [0x400, 0xf3392b0822b70005940c7a398e4b70f3n],
        [0x800, 0xe7159475a2c29b7443b29c7fa6e889d9n],
        [0x1000, 0xd097f3bdfd2022b8845ad8f792aa5825n],
        [0x2000, 0xa9f746462d870fdf8a65dc1f90e061e5n],
        [0x4000, 0x70d869a156d2a1b890bb3df62baf32f7n],
        [0x8000, 0x31be135f97d08fd981231505542fcfa6n],
        [0x10000, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
        [0x20000, 0x5d6af8dedb81196699c329225ee604n],
        [0x40000, 0x2216e584f5fa1ea926041bedfe98n],
        [0x80000, 0x48a170391f7dc42444e8fa2n],
    ];
    for (const [mask, factor] of factors) {
        if ((absTick & mask) !== 0)
            price = (price * factor) >> 128n;
    }
    if (tick > 0)
        price = MAX_UINT256 / price;
    return (price + ((1n << 32n) - 1n)) >> 32n;
}
function amount0Delta(sqrtPriceA, sqrtPriceB, liquidity) {
    const [lower, upper] = sqrtPriceA <= sqrtPriceB
        ? [sqrtPriceA, sqrtPriceB]
        : [sqrtPriceB, sqrtPriceA];
    if (lower === 0n)
        throw new Error("invalid sqrt price");
    return mulDivUp(mulDivUp(liquidity << 96n, upper - lower, upper), 1n, lower);
}
function amount1Delta(sqrtPriceA, sqrtPriceB, liquidity) {
    const difference = sqrtPriceA <= sqrtPriceB
        ? sqrtPriceB - sqrtPriceA
        : sqrtPriceA - sqrtPriceB;
    return mulDivUp(liquidity, difference, Q96);
}
export function quoteRangeAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity) {
    if (tickLower >= tickUpper || liquidity <= 0n || liquidity > ((1n << 128n) - 1n)) {
        throw new Error("invalid liquidity range");
    }
    const sqrtLower = getSqrtPriceAtTick(tickLower);
    const sqrtUpper = getSqrtPriceAtTick(tickUpper);
    if (sqrtPriceX96 <= sqrtLower)
        return { amount0: amount0Delta(sqrtLower, sqrtUpper, liquidity), amount1: 0n };
    if (sqrtPriceX96 < sqrtUpper) {
        return {
            amount0: amount0Delta(sqrtPriceX96, sqrtUpper, liquidity),
            amount1: amount1Delta(sqrtLower, sqrtPriceX96, liquidity),
        };
    }
    return { amount0: 0n, amount1: amount1Delta(sqrtLower, sqrtUpper, liquidity) };
}
export function maximumLiquidityForAmounts(sqrtPriceX96, tickLower, tickUpper, amount0Max, amount1Max) {
    if (amount0Max < 0n || amount1Max < 0n || (amount0Max === 0n && amount1Max === 0n)) {
        throw new Error("invalid liquidity amounts");
    }
    let low = 0n;
    let high = (1n << 128n) - 1n;
    while (low < high) {
        const midpoint = (low + high + 1n) >> 1n;
        const amounts = quoteRangeAmounts(sqrtPriceX96, tickLower, tickUpper, midpoint);
        if (amounts.amount0 <= amount0Max && amounts.amount1 <= amount1Max)
            low = midpoint;
        else
            high = midpoint - 1n;
    }
    return low;
}
export function pendingLpFees(liquidity, currentFeeGrowth0X128, currentFeeGrowth1X128, lastFeeGrowth0X128, lastFeeGrowth1X128) {
    const growth0 = (currentFeeGrowth0X128 - lastFeeGrowth0X128) & MAX_UINT256;
    const growth1 = (currentFeeGrowth1X128 - lastFeeGrowth1X128) & MAX_UINT256;
    return {
        amount0: mulDivDown(liquidity, growth0, Q128),
        amount1: mulDivDown(liquidity, growth1, Q128),
    };
}
export function decodePositionInfo(info) {
    const signed24 = (value) => {
        const masked = value & 0xffffffn;
        return Number(masked >= 0x800000n ? masked - 0x1000000n : masked);
    };
    return {
        tickLower: signed24(info >> 8n),
        tickUpper: signed24(info >> 32n),
        hasSubscriber: (info & 0xffn) !== 0n,
    };
}
export function positionSalt(tokenId) {
    if (tokenId < 0n || tokenId > MAX_UINT256)
        throw new Error("invalid token ID");
    return toHex(tokenId, { size: 32 });
}
export function backingAtSupply(bundleAmount, supply) {
    return mulDivUp(bundleAmount, supply, SHARE_SCALE);
}
export function selectFeeShares(tiers, actionShares) {
    let selected = 0n;
    let selectedThreshold = 0n;
    let found = false;
    for (const tier of tiers) {
        if (tier.minActionShares <= actionShares && (!found || tier.minActionShares >= selectedThreshold)) {
            selected = tier.feeShares;
            selectedThreshold = tier.minActionShares;
            found = true;
        }
    }
    return selected;
}
export function quoteMint(snapshot, shares) {
    if (shares <= 0n)
        throw new Error("shares must be positive");
    const feeShares = selectFeeShares(snapshot.mintFeeTiers, shares);
    return snapshot.constituents.map((constituent) => {
        const baseAmount = backingAtSupply(constituent.bundleAmount, snapshot.totalSupply + shares)
            - backingAtSupply(constituent.bundleAmount, snapshot.totalSupply);
        const feeAmount = mulDivUp(constituent.bundleAmount, feeShares, SHARE_SCALE);
        return {
            asset: constituent.asset,
            baseAmount,
            feeAmount,
            amountIn: baseAmount + feeAmount,
        };
    });
}
export function quoteRedeem(snapshot, shares) {
    if (shares <= 0n || shares > snapshot.totalSupply)
        throw new Error("invalid shares");
    const feeShares = selectFeeShares(snapshot.redemptionFeeTiers, shares);
    return snapshot.constituents.map((constituent) => {
        const baseAmount = backingAtSupply(constituent.bundleAmount, snapshot.totalSupply)
            - backingAtSupply(constituent.bundleAmount, snapshot.totalSupply - shares);
        if (baseAmount > constituent.vaultBalance)
            throw new Error(`insufficient vault balance for ${constituent.asset}`);
        const feeAmount = mulDivUp(constituent.bundleAmount, feeShares, SHARE_SCALE);
        return {
            asset: constituent.asset,
            baseAmount,
            feeAmount,
            amountOut: feeAmount < baseAmount ? baseAmount - feeAmount : 0n,
        };
    });
}
export function quoteBorrow(snapshot, sharesIn) {
    if (sharesIn <= 0n)
        throw new Error("shares must be positive");
    if (snapshot.ltvBps > MAX_LTV_BPS)
        throw new Error("LTV exceeds protocol maximum");
    const feeShares = mulDivUp(sharesIn, snapshot.originationFeeBps, BPS);
    if (feeShares >= sharesIn)
        throw new Error("fee consumes shares");
    const collateralShares = sharesIn - feeShares;
    const debtShares = mulDivUp(collateralShares, snapshot.ltvBps, BPS);
    const penaltyShares = mulDivUp(debtShares, snapshot.recoveryPenaltyBps, BPS);
    if (debtShares + penaltyShares > collateralShares) {
        throw new Error("debt and recovery penalty exceed collateral");
    }
    const principals = snapshot.constituents.map(({ asset, bundleAmount }) => ({
        asset,
        amount: mulDivDown(bundleAmount, debtShares, SHARE_SCALE),
    }));
    if (!principals.some(({ amount }) => amount !== 0n))
        throw new Error("zero principal");
    return { feeShares, collateralShares, debtShares, penaltyShares, principals };
}
export function quoteRecovery(snapshot, loan) {
    if (loan.basketId !== snapshot.basketId)
        throw new Error("loan and basket do not match");
    if (loan.assets.length !== snapshot.constituents.length || loan.principals.length !== loan.assets.length) {
        throw new Error("loan constituent lengths do not match");
    }
    const burnShares = loan.debtShares + loan.penaltyShares;
    if (burnShares > loan.collateralShares || burnShares > snapshot.totalSupply) {
        throw new Error("invalid recovery shares");
    }
    const callerAmounts = [];
    const protocolAmounts = [];
    for (let index = 0; index < snapshot.constituents.length; index += 1) {
        const constituent = snapshot.constituents[index];
        if (loan.assets[index]?.toLowerCase() !== constituent.asset.toLowerCase()) {
            throw new Error("loan constituent order does not match");
        }
        const backingRemoved = backingAtSupply(constituent.bundleAmount, snapshot.totalSupply)
            - backingAtSupply(constituent.bundleAmount, snapshot.totalSupply - burnShares);
        const principal = loan.principals[index];
        if (principal > backingRemoved)
            throw new Error("principal exceeds recovered backing");
        const penaltyAmount = backingRemoved - principal;
        const callerAmount = mulDivDown(penaltyAmount, RECOVERY_CALLER_SHARE_BPS, BPS);
        callerAmounts.push(callerAmount);
        protocolAmounts.push(penaltyAmount - callerAmount);
    }
    return {
        recoverableAt: loan.maturity + LOAN_RECOVERY_GRACE_PERIOD,
        burnShares,
        unlockedShares: loan.collateralShares - burnShares,
        assets: loan.assets,
        callerAmounts,
        protocolAmounts,
    };
}
export function quoteBorrowAndProvideLiquidity(snapshot, sharesIn, poolInputs, maxInputSlippageBps = 0n) {
    if (poolInputs.length !== snapshot.constituents.length)
        throw new Error("one pool per constituent is required");
    if (maxInputSlippageBps < 0n || maxInputSlippageBps > BPS)
        throw new Error("invalid input slippage");
    const borrow = quoteBorrow(snapshot, sharesIn);
    if (borrow.feeShares > snapshot.totalSupply)
        throw new Error("origination fee exceeds current supply");
    const seen = new Set();
    const quotedPools = poolInputs.map((input) => {
        const assetKey = input.asset.toLowerCase();
        if (seen.has(assetKey))
            throw new Error(`duplicate pool asset ${input.asset}`);
        seen.add(assetKey);
        if (!snapshot.constituents.some(({ asset }) => asset.toLowerCase() === assetKey)) {
            throw new Error(`asset is not a basket constituent ${input.asset}`);
        }
        const currency0 = input.currency0.toLowerCase();
        const currency1 = input.currency1.toLowerCase();
        const basket = snapshot.basketToken.toLowerCase();
        if (!((currency0 === basket && currency1 === assetKey)
            || (currency1 === basket && currency0 === assetKey)))
            throw new Error(`invalid canonical pair for ${input.asset}`);
        if (input.tickLower % 10 !== 0 || input.tickUpper % 10 !== 0 || input.deadline <= 0n) {
            throw new Error(`invalid canonical liquidity input for ${input.asset}`);
        }
        const { amount0, amount1 } = quoteRangeAmounts(input.sqrtPriceX96, input.tickLower, input.tickUpper, input.liquidity);
        const basketIsCurrency0 = currency0 === basket;
        const basketAmount = basketIsCurrency0 ? amount0 : amount1;
        const assetAmount = basketIsCurrency0 ? amount1 : amount0;
        if (basketAmount === 0n || assetAmount === 0n)
            throw new Error(`range must require both currencies for ${input.asset}`);
        return { input, amount0, amount1, basketAmount, assetAmount };
    });
    const basketSharesMinted = quotedPools.reduce((total, pool) => total + pool.basketAmount, 0n);
    const mintInputs = quoteMint({ ...snapshot, totalSupply: snapshot.totalSupply - borrow.feeShares }, basketSharesMinted);
    const poolAssetAmounts = snapshot.constituents.map(({ asset }) => ({
        asset,
        amount: quotedPools.find((pool) => pool.input.asset.toLowerCase() === asset.toLowerCase())?.assetAmount ?? 0n,
    }));
    const totalPrincipalRequirements = snapshot.constituents.map(({ asset }, index) => {
        const mintAmount = mintInputs[index]?.amountIn ?? 0n;
        const poolAmount = poolAssetAmounts[index]?.amount ?? 0n;
        const principal = borrow.principals[index]?.amount ?? 0n;
        const amount = mintAmount + poolAmount;
        if (amount > principal)
            throw new Error(`insufficient borrowed principal for ${asset}`);
        return { asset, amount, refund: principal - amount };
    });
    const cap = (amount) => mulDivUp(amount, BPS + maxInputSlippageBps, BPS);
    const pools = quotedPools.map(({ input, amount0, amount1 }) => ({
        asset: input.asset,
        tickLower: input.tickLower,
        tickUpper: input.tickUpper,
        liquidity: input.liquidity,
        amount0Max: cap(amount0),
        amount1Max: cap(amount1),
        deadline: input.deadline,
    }));
    return { borrow, basketSharesMinted, mintInputs, poolAssetAmounts, totalPrincipalRequirements, pools };
}
export function quoteExtension(snapshot, principals) {
    return principals.map(({ asset, amount }) => ({
        asset,
        amount: mulDivUp(amount, snapshot.extensionFeeBps, BPS),
    }));
}
export function allowsExposureIncrease(status) {
    return status === BasketStatus.Active;
}
export const staticsAbi = parseAbi([
    "function createBasket((string name,string symbol,address[] assets,uint256[] bundleAmounts,(uint256 minActionShares,uint256 feeShares)[] mintFeeTiers,(uint256 minActionShares,uint256 feeShares)[] redemptionFeeTiers,uint16 flashFeeBps,uint16 originationFeeBps,uint16 extensionFeeBps,uint16 ltvBps,uint16 recoveryPenaltyBps,uint40 loanDuration) params,(uint160 sqrtPriceAssetPerBasketX96,uint256 pairedAssetAmount)[] pools,uint256[] maxAmountsIn,uint256 launchDeadline) payable returns (uint256 basketId,address token)",
    "function mint(uint256 basketId,uint256 shares,address receiver,uint256[] maxAmountsIn) returns (uint256[] amountsIn)",
    "function redeem(uint256 basketId,uint256 shares,address receiver,uint256[] minAmountsOut) returns (uint256[] amountsOut)",
    "function quoteMint(uint256 basketId,uint256 shares) view returns (uint256[] amountsIn)",
    "function quoteRedeem(uint256 basketId,uint256 shares) view returns (uint256[] amountsOut)",
    "function basket(uint256 basketId) view returns ((address token,address creator,uint8 status,address[] assets,uint256[] bundleAmounts,(uint256 minActionShares,uint256 feeShares)[] mintFeeTiers,(uint256 minActionShares,uint256 feeShares)[] redemptionFeeTiers,uint16 flashFeeBps,uint16 originationFeeBps,uint16 extensionFeeBps,uint16 ltvBps,uint16 recoveryPenaltyBps,uint40 loanDuration) result)",
    "function basketStatus(uint256 basketId) view returns (uint8)",
    "function basketCount() view returns (uint256)",
    "function basketIdOf(address token) view returns (uint256 basketId,bool exists)",
    "function vaultBalance(uint256 basketId,address asset) view returns (uint256)",
    "function feeSharesFor(uint256 basketId,bool mintAction,uint256 actionShares) view returns (uint256 feeShares)",
    "function createAndDepositBasketCollateral(uint256 basketId,uint256 shares,address receiver) payable returns (uint256 positionId)",
    "function depositBasketCollateral(uint256 positionId,uint256 basketId,uint256 shares)",
    "function withdrawBasketCollateral(uint256 positionId,uint256 basketId,uint256 shares,address receiver)",
    "function createAndMintBasketCollateral(uint256 basketId,uint256 shares,address receiver,uint256[] maxAmountsIn) payable returns (uint256 positionId,uint256[] amountsIn)",
    "function mintBasketCollateral(uint256 positionId,uint256 basketId,uint256 shares,uint256[] maxAmountsIn) returns (uint256[] amountsIn)",
    "function redeemBasketCollateral(uint256 positionId,uint256 basketId,uint256 shares,address receiver,uint256[] minAmountsOut) returns (uint256[] amountsOut)",
    "function basketCollateralPosition(uint256 positionId,uint256 basketId) view returns ((uint256 depositedShares,uint256 lockedShares,uint256 withdrawableAfterBlock) position)",
    "function getBasketRewardAssets(uint256 basketId) view returns (address[] assets)",
    "function getBasketRewards(uint256 positionId,uint256 basketId) view returns (address[] assets,uint256[] amounts)",
    "function claimBasketRewards(uint256 positionId,uint256 basketId,address receiver) returns (address[] assets,uint256[] amounts)",
    "function basketRewardState(uint256 basketId,address asset) view returns ((uint256 totalEligibleShares,uint256 indexRay,uint256 indexedReserve,uint256 crystallizedReserve,uint256 totalClaimable) state)",
    "function createAndStake(uint256 amount,address receiver,address[] rewardAssets) payable returns (uint256 positionId)",
    "function stake(uint256 positionId,uint256 amount)",
    "function unstake(uint256 positionId,uint256 amount,address receiver)",
    "function optInRewardAssets(uint256 positionId,address[] assets)",
    "function optOutRewardAssets(uint256 positionId,address[] assets)",
    "function claimRewards(uint256 positionId,address[] assets,address receiver,uint256[] minAmountsOut) returns (uint256[] amountsOut)",
    "function distributeTreasuryFees(address asset) returns (uint256 amount)",
    "function pendingRewards(uint256 positionId,address[] assets) view returns (uint256[] amounts)",
    "function stakePosition(uint256 positionId) view returns ((uint256 stakedBalance,uint16 rewardMultiplierBps,uint256 claimAssetCount,uint256 optedInAssetCount) position)",
    "function rewardAsset(address asset) view returns ((uint256 eligibleStake,uint256 eligibleWeight,uint256 pendingStake,uint256 pendingWeight,uint256 indexRay,uint256 indexedReserve,uint256 totalClaimable) state)",
    "function positionRewardAssets(uint256 positionId) view returns (address[] assets)",
    "function isRewardAssetOptedIn(uint256 positionId,address asset) view returns (bool)",
    "function rewardSelection(uint256 positionId,address asset) view returns ((bool selected,uint256 eligibleStake,uint256 eligibleWeight,uint256 pendingStake,uint256 pendingWeight,uint40 eligibleAt) selection)",
    "function maxRewardAssetsPerPosition() pure returns (uint256)",
    "function rewardEligibilityDelay() pure returns (uint256)",
    "function rewardEligibilityBucketSize() pure returns (uint256)",
    "function stakingToken() view returns (address)",
    "function totalStaked() view returns (uint256)",
    "function treasuryAccrued(address asset) view returns (uint256)",
    "function canAccrueStakerRewards(address asset) view returns (bool)",
    "function checkpointRewardAssets(address[] assets)",
    "function rewardBookNeedsCheckpoint(address asset) view returns (bool)",
    "function locked(uint256 positionId) view returns (bool)",
    "function genesisCollection() view returns (address)",
    "function linkedPosition(uint256 genesisId) view returns (uint256)",
    "function linkedGenesis(uint256 positionId) view returns (uint256)",
    "function linkGenesis(uint256 positionId,uint256 genesisId)",
    "function unlinkGenesis(uint256 positionId,uint256 genesisId)",
    "function genesisRecoveryVault() view returns (address)",
    "function genesisRecoveryAsset() view returns (address)",
    "function genesisRecoveryReady() view returns (bool)",
    "function genesisIntegrationReady() view returns (bool)",
    "function registerGenesis(uint256 genesisId)",
    "function accrueGenesisRewards() returns (uint256 staticsAmount,uint256 numeraireAmount)",
    "function claimGenesisRewards(uint256 genesisId,address asset,address receiver) returns (uint256 amount)",
    "function claimGenesisOwnerRewards(address asset,address receiver) returns (uint256 amount)",
    "function claimGenesisTreasuryRewards(address asset,address receiver) returns (uint256 amount)",
    "function claimAllGenesisRewards(uint256[] genesisIds,address receiver) returns (uint256 staticsAmount,uint256 numeraireAmount)",
    "function claimAllGenesisTreasuryRewards(address receiver) returns (uint256 staticsAmount,uint256 numeraireAmount)",
    "function setGenesisRewardShareBps(uint16 newShareBps)",
    "function pendingGenesisRewards(uint256 genesisId,address asset) view returns (uint256 amount)",
    "function genesisRewardBook(address asset) view returns ((uint256 indexRay,uint256 indexRemainder,uint256 indexedAmount,uint256 crystallizedAmount,uint256 totalClaimable,uint256 totalClaimed,uint256 treasuryClaimable) book)",
    "function genesisRegistered(uint256 genesisId) view returns (bool)",
    "function genesisEffectiveWeight(uint256 genesisId) view returns (uint256)",
    "function genesisTotalWeight() view returns (uint256)",
    "function genesisRewardShareBps() view returns (uint16)",
    "function genesisOwnerClaimable(address owner,address asset) view returns (uint256)",
    "function pendingGenesisRecovery() view returns (uint256)",
    "function genesisRewardCustodyAccount() pure returns (bytes32)",
    "function deployMorphoCollateral(uint256 positionId,bytes32 marketId,uint256 assets)",
    "function recallMorphoCollateral(uint256 positionId,bytes32 marketId,uint256 assets)",
    "function withdrawUntrackedMorphoCollateral(uint256 positionId,bytes32 marketId,uint256 assets,address receiver)",
    "function borrowMorphoUsd(uint256 positionId,bytes32 marketId,uint256 assets,uint256 maxBorrowShares,address receiver) returns (uint256 assetsBorrowed,uint256 sharesBorrowed)",
    "function repayMorphoUsd(uint256 positionId,bytes32 marketId,uint256 assets,uint256 shares,uint256 maxAssets) returns (uint256 assetsRepaid,uint256 sharesRepaid)",
    "function syncMorpho(uint256 positionId,bytes32 marketId) returns (uint256 trackedLoss)",
    "function liquidateMorphoAndSync(uint256 positionId,bytes32 marketId,uint256 seizedAssets,uint256 repaidShares,uint256 maxRepayAssets,uint256 minSeizedAssets,address receiver) returns (uint256 assetsSeized,uint256 assetsRepaid)",
    "function claimMorphoSyncBounties(address[] assets,address receiver) returns (uint256[] amounts)",
    "function morpho() view returns (address)",
    "function morphoUsdStx() view returns (address)",
    "function morphoAccount(uint256 positionId) view returns (address account,bool deployed)",
    "function morphoMarket(bytes32 marketId) view returns (((address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) params,uint8 kind,uint8 mode,uint256 basketId) config)",
    "function morphoPositionMarket(uint256 positionId,bytes32 marketId) view returns ((uint256 trackedCollateral,uint256 actualCollateral,uint256 untrackedSurplus,uint256 borrowShares,bool debtActive) position)",
    "function morphoMarketIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (bytes32[] marketIds,uint256 nextCursor)",
    "function enforceMorphoAccountEmpty(uint256 positionId) view",
    "function morphoSyncBountyBps() view returns (uint16)",
    "function morphoSyncBounty(address keeper,address asset) view returns (uint256)",
    "event MorphoCollateralDeployed(uint256 indexed positionId,bytes32 indexed marketId,uint256 assets)",
    "event MorphoCollateralRecalled(uint256 indexed positionId,bytes32 indexed marketId,uint256 assets)",
    "event MorphoSurplusWithdrawn(uint256 indexed positionId,bytes32 indexed marketId,address indexed receiver,uint256 assets)",
    "event MorphoBorrowed(uint256 indexed positionId,bytes32 indexed marketId,address indexed receiver,uint256 assets,uint256 shares)",
    "event MorphoRepaid(uint256 indexed positionId,bytes32 indexed marketId,uint256 assets,uint256 shares)",
    "event MorphoSynchronized(uint256 indexed positionId,bytes32 indexed marketId,address indexed keeper,uint256 previousTracked,uint256 actualCollateral,uint256 trackedLoss)",
    "event MorphoSyncBountyClaimed(address indexed keeper,address indexed asset,address indexed receiver,uint256 amount)",
    "function creatorRewardCredit(address creator,address asset) view returns (uint256)",
    "function partnerAccrued(address recipient,address asset) view returns (uint256)",
    "function partnerRecipient() view returns (address)",
    "function partnerDistributionTipBps() view returns (uint16)",
    "function protocolRevenueLiabilities(address asset) view returns (uint256 creator,uint256 partner)",
    "function distributePartnerRevenue(address recipient,address asset) returns (uint256 distributed,uint256 tip)",
    "function borrow(uint256 positionId,uint256 basketId,uint256 sharesIn,address receiver) returns (uint256 loanId,uint256[] principals)",
    "function repay(uint256 loanId)",
    "function extend(uint256 loanId,uint256[] grossAmountsIn) returns (uint256[] receivedAmounts)",
    "function recover(uint256 loanId)",
    "function quoteBorrow(uint256 basketId,uint256 sharesIn) view returns ((uint256 feeShares,uint256 collateralShares,uint256 debtShares,uint256 penaltyShares,address[] assets,uint256[] principals) result)",
    "function quoteRecovery(uint256 loanId) view returns ((uint256 recoverableAt,uint256 burnShares,uint256 unlockedShares,address[] assets,uint256[] callerAmounts,uint256[] protocolAmounts) result)",
    "function quoteExtension(uint256 loanId) view returns (address[] assets,uint256[] requiredFees)",
    "function loan(uint256 loanId) view returns ((uint256 positionId,uint256 basketId,uint256 collateralShares,uint256 feeShares,uint256 debtShares,uint256 penaltyShares,uint40 maturity,address[] assets,uint256[] principals) result)",
    "function outstandingPrincipal(uint256 basketId,address asset) view returns (uint256)",
    "function recoveryGracePeriod() view returns (uint256)",
    "function flashLoan(uint256 basketId,uint256 shares,address receiver,bytes data)",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner,address operator) view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function createPosition(address receiver) payable returns (uint256 positionId)",
    "function positionCreationFee() view returns (uint256 amount)",
    "function setPositionCreationFee(uint256 amount)",
    "function closePosition(uint256 positionId)",
    "function nextPositionId() view returns (uint256)",
    "function activeLegCount(uint256 positionId) view returns (uint256)",
    "function positionInitializing(uint256 positionId) view returns (bool)",
    "function positionCount(address owner) view returns (uint256)",
    "function positionsOfOwner(address owner,uint256 cursor,uint256 limit) view returns (uint256[] positionIds,uint256 nextCursor)",
    "function syncPositionOwnerIndex(uint256 positionId)",
    "function positionState(uint256 tokenId) view returns ((bool exists,uint256 stateNonce,uint256 activeLegCount,uint256 unresolvedObligationCount) state)",
    "function isLegActive(uint256 tokenId,bytes32 legKey) view returns (bool)",
    "function isPositionClosable(uint256 tokenId) view returns (bool)",
    "function positionPortfolioCounts(uint256 positionId) view returns ((uint256 basketCount,uint256 loanCount,uint256 liquidityPositionCount,uint256 globalRewardAssetCount,uint256 riskSeriesCount) counts)",
    "function basketIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] basketIds,uint256 nextCursor)",
    "function loanIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] loanIds,uint256 nextCursor)",
    "function liquidityPositionIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] tokenIds,uint256 nextCursor)",
    "function globalRewardAssetsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (address[] assets,uint256 nextCursor)",
    "function riskSeriesIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] seriesIds,uint256 nextCursor)",
    "function quarantineBasket(uint256 basketId)",
    "function releaseBasketQuarantine(uint256 basketId)",
    "function decommissionBasket(uint256 basketId)",
    "function depositETH(address staticsDollarReceiver,address shareReceiver,uint256 minStaticsDollar,uint256 minShares) payable returns (uint256 seriesId,uint256 staticsDollarMinted,uint256 sharesMinted)",
    "function depositWETH(uint256 wethAmount,address staticsDollarReceiver,address shareReceiver,uint256 minStaticsDollar,uint256 minShares) returns (uint256 seriesId,uint256 staticsDollarMinted,uint256 sharesMinted)",
    "function recombineToWETH(uint256 seriesId,uint256 staticsDollarAmount,uint256 maxSharesIn,address receiver,uint256 minWETHOut) returns (uint8 status,uint256 wethOut)",
    "function recombineToWETHWithPermit(uint256 seriesId,uint256 staticsDollarAmount,uint256 maxSharesIn,address receiver,uint256 minWETHOut,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitSignature) returns (uint8 status,uint256 wethOut)",
    "function recombineToETH(uint256 seriesId,uint256 staticsDollarAmount,uint256 maxSharesIn,address receiver,uint256 minETHOut) returns (uint8 status,uint256 ethOut)",
    "function recombineToETHWithPermit(uint256 seriesId,uint256 staticsDollarAmount,uint256 maxSharesIn,address receiver,uint256 minETHOut,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitSignature) returns (uint8 status,uint256 ethOut)",
    "function pool() view returns (address)",
    "function weth() view returns (address)",
    "function staticsDollar() view returns (address)",
    "function staticsDollarRisk() view returns (address)",
    "function wethProfileId() pure returns (uint256)",
    "function previewPeggedMint(uint256 profileId,uint256 staticsDollarAmount) view returns ((uint256 profileId,address collateralToken,uint256 staticsDollarMinted,uint256 principalCollateral,uint256 feeAmount,uint256 totalCollateralIn,uint256 priceWad) preview)",
    "function mintPegged(uint256 profileId,uint256 staticsDollarAmount,uint256 maximumCollateralIn,address staticsDollarReceiver) returns (uint256 collateralIn)",
    "function mintPeggedWithPermit(uint256 profileId,uint256 staticsDollarAmount,uint256 maximumCollateralIn,address staticsDollarReceiver,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitSignature) returns (uint256 collateralIn)",
    "function quoteMintPeggedAndRecombine(uint256 peggedProfileId,uint256 volatileProfileId,uint256 seriesId,uint256 riskAmount) view returns ((bool eligible,uint8 exitStatus,address peggedCollateralToken,address volatileCollateralToken,uint256 staticsDollarAmount,uint256 peggedCollateralPrincipal,uint256 peggedMintFee,uint256 totalPeggedCollateralIn,uint256 volatileCollateralOut,uint256 volatileRecombinationFee) quote)",
    "function mintPeggedAndRecombine(uint256 peggedProfileId,uint256 volatileProfileId,uint256 seriesId,uint256 riskAmount,uint256 maximumPeggedCollateralIn,uint256 minimumVolatileCollateralOut,address receiver) returns (uint8 status,uint256 peggedCollateralIn,uint256 volatileCollateralOut)",
    "function mintPeggedAndRecombineWithPermit(uint256 peggedProfileId,uint256 volatileProfileId,uint256 seriesId,uint256 riskAmount,uint256 maximumPeggedCollateralIn,uint256 minimumVolatileCollateralOut,address receiver,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitSignature) returns (uint8 status,uint256 peggedCollateralIn,uint256 volatileCollateralOut)",
    "function previewPeggedRedemption(uint256 profileId,uint256 staticsDollarAmount) view returns ((uint256 profileId,address collateralToken,uint256 staticsDollarBurned,uint256 grossCollateral,uint256 feeAmount,uint256 collateralOut,uint256 priceWad) preview)",
    "function redeemPegged(uint256 profileId,uint256 staticsDollarAmount,uint256 minimumCollateralOut,address receiver) returns (uint8 status,uint256 collateralOut)",
    "function redeemPeggedWithPermit(uint256 profileId,uint256 staticsDollarAmount,uint256 minimumCollateralOut,address receiver,(uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s) permitSignature) returns (uint8 status,uint256 collateralOut)",
    "function peggedRedemptionStatus() view returns (uint8 status,uint256 unhealthyProfileBitmap,uint256 totalSeniorDeficitWad,uint256 recoveryAvailableAt)",
    "function peggedProtocolRevenue(uint256 profileId,address token) view returns (uint256 amount)",
    "function claimPeggedProtocolRevenue(uint256 profileId,uint256 amount,address receiver) returns (uint256 spent,uint256 received)",
    "function installCanonicalPoolIntegration(address poolManager,address hook)",
    "function canonicalPool(uint256 basketId,address asset) view returns ((bytes32 poolId,address basketToken,address asset,address currency0,address currency1,address hook,uint24 lpFee,int24 tickSpacing,int24 spotTick) pool)",
    "function quotePool((address tokenA,address tokenB,int24 tickSpacing,uint160 sqrtPriceBPerAX96,(uint16 inputFeeBps,uint16 outputFeeBps) feeRate,address creator,uint256 nonce,uint256 deadline) params) view returns (((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,bytes32 poolId,uint160 sqrtPriceX96,(uint16 inputFeeBps,uint16 outputFeeBps) feeRate,uint256 creationFee,bytes32 authorizationDigest) quote)",
    "function createPool((address tokenA,address tokenB,int24 tickSpacing,uint160 sqrtPriceBPerAX96,(uint16 inputFeeBps,uint16 outputFeeBps) feeRate,address creator,uint256 nonce,uint256 deadline) params,bytes creatorAuthorization) payable returns (bytes32 poolId)",
    "function invalidatePoolCreationNonce(uint256 nonce)",
    "function setPoolCreationFee(uint256 amount)",
    "function setProtocolPoolFeeRate(bytes32 poolId,(uint16 inputFeeBps,uint16 outputFeeBps) feeRate)",
    "function setBasketFeeAllocation((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function setGeneralFeeAllocation((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function decommissionGeneralPool(bytes32 poolId) returns (uint256 amount0,uint256 amount1)",
    "function replaceLiquidityManager(address newManager)",
    "function protocolPool(bytes32 poolId) view returns ((bytes32 poolId,(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint8 kind,bool decommissioned,uint256 basketId,address basketAsset,address creator,uint128 permanentLiquidity) pool)",
    "function isProtocolPool(bytes32 poolId) view returns (bool registered)",
    "function poolCreationFee() view returns (uint256 amount)",
    "function isPoolCreationNonceUsed(address creator,uint256 nonce) view returns (bool used)",
    "function basketFeeAllocation() view returns ((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function generalFeeAllocation() view returns ((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function protocolPoolFeeRate(bytes32 poolId) view returns ((uint16 inputFeeBps,uint16 outputFeeBps) feeRate)",
    "function protocolPoolCreator(bytes32 poolId) view returns (address creator)",
    "function routeProtocolSwapFees(bytes32 poolId,address asset,(uint256 liquidityProvider,uint256 basketStaker,uint256 staticsStaker,uint256 creator,uint256 treasury) distribution)",
    "function claimCreatorRevenue(address asset,address receiver,uint256 minReceived) returns (uint256 amount,uint256 received)",
    "function creatorRevenue(address creator,address asset) view returns (uint256 amount)",
    "function totalCreatorRevenue(address asset) view returns (uint256 amount)",
    "function liquidityIntegration() view returns (address poolManager,address hook,bool installed)",
    "function installLiquidityManager(address manager)",
    "function setSwapFeeConfiguration((uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) configuration)",
    "function swapFeeConfiguration() view returns ((uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) configuration)",
    "function setCanonicalPoolFeeConfiguration(uint256 basketId,address asset,(uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) configuration)",
    "function clearCanonicalPoolFeeConfiguration(uint256 basketId,address asset)",
    "function canonicalPoolFeeConfiguration(uint256 basketId,address asset) view returns ((uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps,bool overridden) configuration)",
    "function liquidityManager() view returns (address manager,bool installed)",
    "function unwindBasketLiquidity(uint256 basketId,address asset)",
    "function basketLiquidityUnwound(uint256 basketId,address asset) view returns (bool unwound)",
    "function borrowAndProvideLiquidity(uint256 positionId,uint256 basketId,uint256 sharesIn,(address asset,int24 tickLower,int24 tickUpper,uint256 liquidity,uint256 amount0Max,uint256 amount1Max,uint256 deadline)[] pools,address lpRecipient) returns (uint256 loanId,uint256[] v4TokenIds)",
    "function borrowAndStakeLiquidity(uint256 positionId,uint256 basketId,uint256 sharesIn,(address asset,int24 tickLower,int24 tickUpper,uint256 liquidity,uint256 amount0Max,uint256 amount1Max,uint256 deadline)[] pools) returns (uint256 loanId,uint256[] v4TokenIds)",
    "function stakeLiquidityPosition(uint256 positionId,uint256 tokenId)",
    "function activateLiquidityPosition(uint256 tokenId)",
    "function increaseStakedLiquidity(uint256 positionId,uint256 tokenId,(uint256 liquidityDelta,uint256 amount0Max,uint256 amount1Max,uint256 deadline) request,address refundReceiver) returns (uint256 spent0,uint256 spent1,uint256 refund0,uint256 refund1)",
    "function unstakeLiquidityPosition(uint256 positionId,uint256 tokenId,address receiver)",
    "function claimLiquidityRewards(uint256 positionId,uint256 tokenId,address receiver,uint256 minAmount0,uint256 minAmount1) returns (uint256 amount0,uint256 amount1)",
    "function stakedLiquidityPosition(uint256 tokenId) view returns ((uint256 positionId,uint256 basketId,address asset,bytes32 poolId,address currency0,address currency1,uint256 eligibleLiquidity,uint256 pendingLiquidity,uint256 eligibleAtBlock,uint256 claimable0,uint256 claimable1,bool staked) position)",
    "function poolLiquidityRewards(bytes32 poolId) view returns ((uint256 totalEligibleLiquidity,uint256 index0Ray,uint256 index1Ray,uint256 indexRemainder0,uint256 indexRemainder1,uint256 indexed0,uint256 indexed1,uint256 crystallized0,uint256 crystallized1,uint256 totalClaimable0,uint256 totalClaimable1) pool)",
    "function pendingLiquidityRewards(uint256 positionId,uint256 tokenId) view returns (address currency0,uint256 amount0,address currency1,uint256 amount1)",
    "function canAccrueLiquidityRewards(bytes32 poolId) view returns (bool)",
    "function canAccrueBasketRewards(bytes32 poolId) view returns (bool)",
    "function treasury() view returns (address)",
    "function creationFee() view returns (uint256 amount)",
    "event PeggedMintedAndRecombined(address indexed caller,address indexed receiver,uint256 indexed peggedProfileId,uint256 volatileProfileId,uint256 seriesId,uint256 riskSharesBurned,uint256 peggedCollateralIn,uint256 staticsDollarMintedAndBurned,uint256 volatileCollateralOut)",
    "event PeggedMintAndRecombineDeferred(address indexed caller,address indexed receiver,uint256 indexed peggedProfileId,uint256 volatileProfileId,uint256 seriesId,uint8 status,uint256 unhealthyProfileBitmap)",
    "event BasketCreated(uint256 indexed basketId,address indexed token,address indexed creator,string name,string symbol)",
    "event BasketConfigured(uint256 indexed basketId,address[] assets,uint256[] bundleAmounts,uint16 flashFeeBps,uint16 originationFeeBps,uint16 extensionFeeBps,uint16 ltvBps,uint16 recoveryPenaltyBps,uint40 loanDuration)",
    "event BasketFeeTiersConfigured(uint256 indexed basketId,bool indexed mintAction,uint256[] minActionShares,uint256[] feeShares)",
    "event BasketLaunched(uint256 indexed basketId,address indexed token,address indexed creator,uint256 basketShares,uint256 poolCount)",
    "event BasketMinted(uint256 indexed basketId,address indexed payer,address indexed receiver,uint256 shares)",
    "event BasketRedeemed(uint256 indexed basketId,address indexed owner,address indexed receiver,uint256 shares)",
    "event PositionCreated(uint256 indexed positionId,address indexed owner)",
    "event PositionClosed(uint256 indexed positionId)",
    "event PositionCreationFeeSet(uint256 previousAmount,uint256 newAmount)",
    "event PositionCreationFeePaid(uint256 indexed positionId,address indexed treasury,uint256 amount)",
    "event PositionOwnerIndexSynced(uint256 indexed positionId,address indexed owner)",
    "event MetadataUpdate(uint256 tokenId)",
    "event BatchMetadataUpdate(uint256 fromTokenId,uint256 toTokenId)",
    "event PositionLegAttached(uint256 indexed tokenId,bytes32 indexed legKey,address indexed moduleAuthority,bytes32 moduleType,bytes32 localPositionId,uint256 stateNonce)",
    "event PositionLegDetached(uint256 indexed tokenId,bytes32 indexed legKey,uint256 stateNonce)",
    "event PositionStateChanged(uint256 indexed tokenId,uint256 stateNonce,uint256 activeLegCount,uint256 unresolvedObligationCount)",
    "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
    "event BasketCollateralDeposited(uint256 indexed positionId,uint256 indexed basketId,address indexed payer,uint256 shares)",
    "event BasketCollateralWithdrawn(uint256 indexed positionId,uint256 indexed basketId,address indexed receiver,uint256 shares)",
    "event BasketCollateralRedeemed(uint256 indexed positionId,uint256 indexed basketId,address indexed receiver,uint256 shares)",
    "event LoanOriginated(uint256 indexed loanId,uint256 indexed positionId,uint256 indexed basketId,address operator,address receiver,uint256 sharesIn,uint256 feeShares,uint256 collateralShares,uint256 debtShares,uint256 penaltyShares,uint40 maturity)",
    "event LoanRepaid(uint256 indexed loanId,uint256 indexed positionId,address indexed payer)",
    "event LoanExtended(uint256 indexed loanId,uint40 maturity)",
    "event LoanExtensionFeePaid(uint256 indexed loanId,address indexed asset,uint256 requiredFee,uint256 receivedFee)",
    "event LoanRecovered(uint256 indexed loanId,uint256 indexed positionId,address indexed caller,uint256 burnedShares,uint256 unlockedShares)",
    "event RecoveryPenaltyDistributed(uint256 indexed loanId,address indexed asset,uint256 callerAmount,uint256 callerReceived,uint256 protocolAmount)",
    "event StakingPositionCreated(uint256 indexed positionId,address indexed owner,uint256 amount)",
    "event Staked(uint256 indexed positionId,address indexed payer,uint256 amount,uint256 totalPositionStake)",
    "event Unstaked(uint256 indexed positionId,address indexed receiver,uint256 amount,uint256 totalPositionStake)",
    "event GlobalFeeAccrued(address indexed asset,uint256 grossFee,uint256 stakerAmount,uint256 treasuryAmount,uint256 indexRay)",
    "event RewardClaimed(uint256 indexed positionId,address indexed receiver,address indexed asset,uint256 amount)",
    "event TreasuryFeesDistributed(address indexed asset,address indexed treasury,uint256 amount)",
    "event RewardAssetOptedIn(uint256 indexed positionId,address indexed asset,uint256 actualPendingStake,uint256 effectivePendingWeight,uint40 eligibleAt)",
    "event RewardStakeScheduled(uint256 indexed positionId,address indexed asset,uint256 actualPendingStake,uint256 effectivePendingWeight,uint40 eligibleAt)",
    "event RewardBucketMatured(address indexed asset,uint40 indexed eligibleAt,uint256 actualStake,uint256 effectiveWeight,uint256 totalActualEligibleStake,uint256 totalEffectiveEligibleWeight,uint256 indexRay)",
    "event PositionRewardEligibilityActivated(uint256 indexed positionId,address indexed asset,uint256 actualStake,uint256 effectiveWeight,uint40 eligibleAt,uint256 activationIndexRay)",
    "event RewardAssetOptedOut(uint256 indexed positionId,address indexed asset,uint256 removedActualEligibleStake,uint256 removedActualPendingStake,uint256 removedEffectiveEligibleWeight,uint256 removedEffectivePendingWeight)",
    "event PositionRewardWeightChanged(uint256 indexed positionId,address indexed asset,uint16 previousMultiplierBps,uint16 newMultiplierBps,uint256 effectiveEligibleWeight,uint256 effectivePendingWeight)",
    "event RewardAssetDustRouted(address indexed asset,uint256 amount)",
    "event RewardBookCheckpointed(address indexed asset)",
    "event PositionRewardSettled(uint256 indexed positionId,address indexed asset,uint256 amount)",
    "event GenesisLinked(uint256 indexed positionId,uint256 indexed genesisId,address indexed owner,uint16 multiplierBps)",
    "event GenesisUnlinked(uint256 indexed positionId,uint256 indexed genesisId,address indexed owner,uint16 previousMultiplierBps)",
    "event GenesisRegistered(uint256 indexed genesisId,uint256 weight,uint256 totalWeight)",
    "event GenesisWeightChanged(uint256 indexed genesisId,uint256 previousWeight,uint256 newWeight,uint256 totalWeight)",
    "event GenesisRevenueAccrued(address indexed asset,uint256 amount,uint256 genesisAmount,uint256 treasuryAmount,uint256 indexRay)",
    "event GenesisRewardsClaimed(uint256 indexed genesisId,address indexed owner,address indexed asset,address receiver,uint256 amount)",
    "event GenesisOwnerRewardsClaimed(address indexed owner,address indexed asset,address indexed receiver,uint256 amount)",
    "event GenesisTreasuryRewardsClaimed(address indexed asset,address indexed receiver,uint256 amount)",
    "event PartnerRevenueAccrued(address indexed recipient,address indexed asset,uint256 amount)",
    "event PartnerRevenueDistributed(address indexed recipient,address indexed asset,address indexed caller,uint256 grossAmount,uint256 distributedAmount,uint256 tip)",
    "event LiquidityIntegrationInstalled(address indexed poolManager,address indexed hook)",
    "event CanonicalPoolInitialized(uint256 indexed basketId,address indexed asset,bytes32 indexed poolId,address currency0,address currency1,uint160 sqrtPriceX96,int24 tick)",
    "event ProtocolPoolCreated(bytes32 indexed poolId,address indexed creator,address indexed currency0,address currency1,int24 tickSpacing,uint16 inputFeeBps,uint16 outputFeeBps,uint160 sqrtPriceX96,int24 tick)",
    "event PoolCreationFeeSet(uint256 amount)",
    "event PoolCreationNonceInvalidated(address indexed creator,uint256 indexed nonce)",
    "event ProtocolPoolFeeRateSet(bytes32 indexed poolId,uint16 inputFeeBps,uint16 outputFeeBps)",
    "event BasketFeeAllocationSet(uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps)",
    "event GeneralFeeAllocationSet(uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps)",
    "event GeneralPoolDecommissioned(bytes32 indexed poolId,address indexed currency0,address indexed currency1,uint256 amount0,uint256 amount1)",
    "event CreatorRevenueAccrued(bytes32 indexed poolId,address indexed creator,address indexed asset,uint256 amount)",
    "event CreatorRevenueClaimed(address indexed creator,address indexed asset,address indexed receiver,uint256 amount,uint256 received)",
    "event LiquidityManagerReplaced(address indexed oldManager,address indexed newManager)",
    "event LiquidityManagerInstalled(address indexed manager)",
    "event CanonicalPoolSyncedToManager(uint256 indexed basketId,address indexed asset,bytes32 indexed poolId,address manager)",
    "event SwapFeeConfigurationChanged((uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) configuration)",
    "event CanonicalPoolFeeConfigurationSet(uint256 indexed basketId,address indexed asset,bytes32 indexed poolId,uint16 inputFeeBps,uint16 outputFeeBps,uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps)",
    "event CanonicalPoolFeeConfigurationCleared(uint256 indexed basketId,address indexed asset,bytes32 indexed poolId)",
    "event PermanentLiquidityTreasuryAccrued(uint256 indexed basketId,address indexed sourcePoolAsset,address indexed rewardAsset,uint256 amount)",
    "event BasketLiquidityUnwound(uint256 indexed basketId,address indexed asset,bytes32 indexed poolId,uint256 constituentReleased,uint256 basketTokensBurned)",
    "event BorrowedLiquidityPositionMinted(uint256 indexed loanId,uint256 indexed basketId,address indexed asset,uint256 v4TokenId,address recipient,uint256 liquidity,uint256 spent0,uint256 spent1,uint256 refund0,uint256 refund1)",
    "event BorrowedLiquidityProvided(uint256 indexed loanId,uint256 indexed positionId,uint256 indexed basketId,address operator,address lpRecipient,uint256 sharesIn,uint256 basketSharesMinted,uint256[] v4TokenIds)",
    "event BorrowedLiquidityStaked(uint256 indexed loanId,uint256 indexed positionId,uint256 indexed basketId,address operator,address beneficiary,uint256 sharesIn,uint256 basketSharesMinted,uint256[] v4TokenIds)",
    "event BasketRewardAccrued(uint256 indexed basketId,address indexed asset,uint256 amount,uint256 indexRay)",
    "event BasketRewardSettled(uint256 indexed positionId,uint256 indexed basketId,address indexed asset,uint256 amount)",
    "event BasketRewardClaimed(uint256 indexed positionId,uint256 indexed basketId,address indexed asset,address receiver,uint256 amount)",
    "event BasketRewardDustRouted(uint256 indexed basketId,address indexed asset,uint256 amount)",
    "event LiquidityPositionStaked(uint256 indexed positionId,uint256 indexed tokenId,bytes32 indexed poolId,uint256 liquidity,uint256 eligibleAtBlock)",
    "event LiquidityPositionActivated(uint256 indexed positionId,uint256 indexed tokenId,bytes32 indexed poolId,uint256 liquidity)",
    "event StakedLiquidityIncreased(uint256 indexed positionId,uint256 indexed tokenId,bytes32 indexed poolId,uint256 liquidityDelta,uint256 spent0,uint256 spent1,uint256 refund0,uint256 refund1,uint256 eligibleAtBlock)",
    "event LiquidityPositionUnstaked(uint256 indexed positionId,uint256 indexed tokenId,bytes32 indexed poolId,address receiver)",
    "event LiquidityRewardAccrued(bytes32 indexed poolId,address indexed asset,uint256 amount,uint256 indexRay)",
    "event LiquidityRewardSettled(uint256 indexed positionId,uint256 indexed tokenId,address indexed asset,uint256 amount)",
    "event LiquidityRewardClaimed(uint256 indexed positionId,uint256 indexed tokenId,address indexed asset,address receiver,uint256 amount)",
]);
export const staticsPositionPortfolioAbi = parseAbi([
    "function positionPortfolioCounts(uint256 positionId) view returns ((uint256 basketCount,uint256 loanCount,uint256 liquidityPositionCount,uint256 globalRewardAssetCount,uint256 riskSeriesCount) counts)",
    "function basketIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] basketIds,uint256 nextCursor)",
    "function loanIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] loanIds,uint256 nextCursor)",
    "function liquidityPositionIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] tokenIds,uint256 nextCursor)",
    "function globalRewardAssetsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (address[] assets,uint256 nextCursor)",
    "function riskSeriesIdsOfPosition(uint256 positionId,uint256 cursor,uint256 limit) view returns (uint256[] seriesIds,uint256 nextCursor)",
]);
export const staticsPositionPortfolioErrorAbi = parseAbi([
    "error InvalidPortfolioPageSize(uint256 requested,uint256 maximum)",
]);
export const staticsSwapFeeHookAbi = parseAbi([
    "function staticsDiamond() view returns (address)",
    "function poolManager() view returns (address)",
    "function defaultFeeRate() view returns (uint16 inputFeeBps,uint16 outputFeeBps)",
    "function setDefaultFeeRate(uint16 inputFeeBps,uint16 outputFeeBps)",
    "function setPoolFeeRate(bytes32 poolId,uint16 inputFeeBps,uint16 outputFeeBps)",
    "function clearPoolFeeRate(bytes32 poolId)",
    "function poolFeeRate(bytes32 poolId) view returns ((uint16 inputFeeBps,uint16 outputFeeBps,bool overridden) rate)",
    "function basketFeeAllocation() view returns ((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function generalFeeAllocation() view returns ((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function setBasketFeeAllocation((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function setGeneralFeeAllocation((uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps) allocation)",
    "function registerPool((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint8 kind,address creator) returns (bytes32 poolId)",
    "function decommissionPool((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key)",
    "function poolDecommissioned(bytes32 poolId) view returns (bool decommissioned)",
    "function poolRegistration(bytes32 poolId) view returns ((address currency0,address currency1,uint8 kind,address creator,bool registered) registration)",
    "function pendingPermanentLiquidity(bytes32 poolId,address currency) view returns (uint256 amount)",
    "function lockedLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
    "function seedPermanentLiquidity(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint128 liquidity)[] seeds)",
    "function compoundPermanentLiquidity((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key) returns (uint128 liquidityAdded)",
    "function releasePermanentLiquidity((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,address receiver) returns (uint256 amount0,uint256 amount1)",
    "event PoolRegistered(bytes32 indexed poolId,address indexed currency0,address indexed currency1,uint8 kind,address creator)",
    "event SwapLegFeeAccrued(bytes32 indexed poolId,address indexed currency,bool indexed specifiedLeg,uint256 realizedAmount,uint256 chargedAmount,uint256 polAmount,uint256 liquidityProviderAmount,uint256 basketStakerAmount,uint256 staticsStakerAmount,uint256 creatorAmount,uint256 treasuryAmount)",
    "event PermanentLiquidityAdded(bytes32 indexed poolId,uint128 liquidity,uint256 amount0,uint256 amount1,uint256 pending0,uint256 pending1)",
    "event PermanentLiquiditySeeded(bytes32 indexed poolId,uint128 liquidity,uint256 amount0,uint256 amount1)",
    "event PermanentLiquidityFeesCollected(bytes32 indexed poolId,address indexed currency,uint256 amount,uint256 pendingAmount)",
    "event PermanentLiquidityReleased(bytes32 indexed poolId,address indexed receiver,uint128 liquidity,uint256 amount0,uint256 amount1)",
    "event PoolDecommissioned(bytes32 indexed poolId)",
    "event PoolFeeRateSet(bytes32 indexed poolId,uint16 inputFeeBps,uint16 outputFeeBps,bool overridden)",
    "event DefaultFeeRateSet(uint16 inputFeeBps,uint16 outputFeeBps)",
    "event BasketFeeAllocationSet(uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 basketStakerShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps)",
    "event GeneralFeeAllocationSet(uint16 polShareBps,uint16 liquidityProviderShareBps,uint16 staticsStakerShareBps,uint16 treasuryShareBps)",
]);
export const staticsTokenAbi = parseAbi([
    "function FIXED_SUPPLY() view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 amount) returns (bool)",
    "function transfer(address to,uint256 amount) returns (bool)",
    "function burn(uint256 amount)",
    "function nonces(address owner) view returns (uint256)",
    "event Transfer(address indexed from,address indexed to,uint256 amount)",
    "event Approval(address indexed owner,address indexed spender,uint256 amount)",
]);
export const staticsLiquidityManagerAbi = parseAbi([
    "function staticsDiamond() view returns (address)",
    "function positionManager() view returns (address)",
    "function poolManager() view returns (address)",
    "function permit2() view returns (address)",
    "function mintUserPosition(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,int24 tickLower,int24 tickUpper,uint256 liquidity,uint256 amount0Limit,uint256 amount1Limit,uint256 deadline) request,address recipient,address refundRecipient) returns ((uint256 tokenId,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement,uint256 refund0,uint256 refund1)",
    "function increaseUserPosition(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,int24 tickLower,int24 tickUpper,uint256 liquidity,uint256 amount0Limit,uint256 amount1Limit,uint256 deadline) request,uint256 tokenId,address refundRecipient) returns ((uint256 tokenId,uint256 spent0,uint256 received0,uint256 spent1,uint256 received1) movement,uint256 refund0,uint256 refund1)",
    "event UserPositionMinted(bytes32 indexed poolId,uint256 indexed tokenId,address recipient,address refundRecipient,uint256 spent0,uint256 spent1,uint256 refund0,uint256 refund1)",
    "event UserPositionIncreased(bytes32 indexed poolId,uint256 indexed tokenId,address refundRecipient,uint256 liquidity,uint256 spent0,uint256 spent1,uint256 refund0,uint256 refund1)",
]);
export const v4PositionManagerReadAbi = parseAbi([
    "function nextTokenId() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function approve(address to,uint256 tokenId)",
    "function modifyLiquidities(bytes unlockData,uint256 deadline) payable",
    "function getPositionLiquidity(uint256 tokenId) view returns (uint128 liquidity)",
    "function getPoolAndPositionInfo(uint256 tokenId) view returns ((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,uint256 info)",
    "event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)",
]);
export const v4StateViewReadAbi = parseAbi([
    "function poolManager() view returns (address)",
    "function getSlot0(bytes32 poolId) view returns (uint160 sqrtPriceX96,int24 tick,uint24 protocolFee,uint24 lpFee)",
    "function getLiquidity(bytes32 poolId) view returns (uint128 liquidity)",
    "function getPositionInfo(bytes32 poolId,address owner,int24 tickLower,int24 tickUpper,bytes32 salt) view returns (uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128)",
    "function getFeeGrowthInside(bytes32 poolId,int24 tickLower,int24 tickUpper) view returns (uint256 feeGrowthInside0X128,uint256 feeGrowthInside1X128)",
]);
export const v4QuoterAbi = parseAbi([
    "function poolManager() view returns (address)",
    "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
export const universalRouterAbi = parseAbi([
    "function poolManager() view returns (address)",
    "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
export const permit2AllowanceAbi = parseAbi([
    "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
    "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
export const staticsTestnetFaucetAbi = parseAbi([
    "function ASSET_COUNT() view returns (uint256)",
    "function COOLDOWN() view returns (uint256)",
    "function USDG_AMOUNT() view returns (uint256)",
    "function USDSTX_AMOUNT() view returns (uint256)",
    "function STATICS_AMOUNT() view returns (uint256)",
    "function STOCK_AMOUNT() view returns (uint256)",
    "function asset(uint256 index) view returns (address token,uint256 amount)",
    "function lastClaimAt(address account) view returns (uint64)",
    "function nextClaimAt(address account) view returns (uint256)",
    "function claim()",
    "event Claimed(address indexed account,uint64 claimedAt,address[6] assets,uint256[6] amounts)",
]);
export const basketTokenAbi = parseAbi([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 value) returns (bool)",
    "function permit(address owner,address spender,uint256 value,uint256 deadline,uint8 v,bytes32 r,bytes32 s)",
    "function nonces(address owner) view returns (uint256)",
    "function DOMAIN_SEPARATOR() view returns (bytes32)",
]);
export const staticsDollarTokenAbi = basketTokenAbi;
export const staticsBasketErrorAbi = parseAbi([
    "error BasketNotFound(uint256 basketId)",
    "error InvalidBasketDefinition()",
    "error FeeExceedsCap(uint16 feeBps)",
    "error LtvExceedsMaximum(uint16 ltvBps)",
    "error InvalidReceiver()",
    "error InvalidShares()",
    "error InvalidAmountsLength()",
    "error MaximumInputExceeded(address asset,uint256 required,uint256 maximum)",
    "error MinimumOutputNotMet(address asset,uint256 actual,uint256 minimum)",
    "error ActionPaused(uint256 action)",
    "error InsufficientVaultBalance(address asset,uint256 required,uint256 available)",
    "error IncorrectCreationFee(uint256 expected,uint256 actual)",
    "error CreationFeeTransferFailed(address treasury,uint256 amount)",
    "error PermissionlessBasketCreationDisabled()",
    "error LiquidityIntegrationNotInstalled()",
    "error LiquidityManagerNotInstalled()",
    "error InvalidPoolLaunchParameters()",
    "error InvalidPoolLaunchPrice(address asset,uint160 sqrtPriceAssetPerBasketX96)",
    "error InvalidPoolLaunchLiquidity(address asset,uint256 pairedAssetAmount)",
    "error CanonicalPoolAlreadyAssociated(bytes32 poolId,uint256 basketId,address asset)",
    "error LaunchInputExceedsMaximum(address asset,uint256 required,uint256 maximum)",
    "error InsufficientLaunchAssetReceived(address asset,uint256 required,uint256 received)",
    "error LaunchDebitExceedsMaximum(address asset,uint256 actualDebit,uint256 maximum)",
    "error LaunchDeadlineExpired(uint256 deadline,uint256 timestamp)",
    "error InsufficientTransferReceived(address asset,uint256 required,uint256 received)",
    "error BasketNotActive(uint256 basketId,uint8 status)",
]);
export const staticsProtocolPoolErrorAbi = parseAbi([
    "error LiquidityIntegrationNotInstalled()",
    "error InvalidToken(address token)",
    "error IdenticalTokens(address token)",
    "error DeadlineExpired(uint256 deadline)",
    "error InvalidTickSpacing(int24 tickSpacing)",
    "error InvalidPoolPrice(uint160 sqrtPriceBPerAX96)",
    "error InvalidFeeRate(uint16 inputFeeBps,uint16 outputFeeBps)",
    "error PoolAlreadyInitialized(bytes32 poolId)",
    "error PoolAlreadyRegisteredInHook(bytes32 poolId)",
    "error ActionPaused(uint256 action)",
    "error IncorrectCreationFee(uint256 expected,uint256 provided)",
    "error CreationFeeTransferFailed(address treasury,uint256 amount)",
    "error InvalidCreatorAuthorization(address creator)",
    "error PoolCreationNonceAlreadyUsed(address creator,uint256 nonce)",
    "error PoolAlreadyDecommissioned(bytes32 poolId)",
    "error IncompatibleTokenTransfer(address token,uint256 expected,uint256 observed)",
    "error InvalidLiquidityManager(address manager)",
    "error LiquidityManagerBindingMismatch(address manager,address expected,address actual)",
    "error LiquidityManagerUnchanged(address manager)",
    "error LiquidityManagerApprovalMismatch(address manager,bool expected)",
    "error OnlySwapFeeHook(address caller,address expected)",
    "error InvalidRewardAsset(bytes32 poolId,address asset)",
    "error GeneralPoolBasketReward(bytes32 poolId,uint256 amount)",
    "error IncompatibleRevenueAsset(address asset,uint256 expected,uint256 actual)",
    "error InvalidReceiver()",
    "error NoCreatorRevenue(address creator,address asset)",
    "error MinimumOutputNotMet(address asset,uint256 actual,uint256 minimum)",
    "error ProtocolPoolNotRegistered(bytes32 poolId)",
    "error ProtocolPoolAlreadyRegistered(bytes32 poolId,uint8 kind)",
    "error GeneralPoolNotRegistered(bytes32 poolId)",
]);
export const staticsPositionErrorAbi = parseAbi([
    "error OnlyDiamondSelf(address caller)",
    "error IncorrectPositionCreationFee(uint256 required,uint256 provided)",
    "error PositionCreationFeeTransferFailed(address treasury,uint256 amount)",
    "error PositionInitializing(uint256 positionId)",
    "error PositionHasActiveLegs(uint256 positionId,uint256 activeLegCount)",
    "error PositionHasUnresolvedObligations(uint256 positionId,uint256 unresolvedObligationCount)",
    "error PositionLocked(uint256 positionId)",
    "error AlreadyInitialized()",
    "error NotInitialized()",
    "error NotPositionOwnerOrApproved(uint256 positionId,address caller)",
    "error InvalidModuleAuthority()",
    "error InvalidModuleType()",
    "error PositionLegAlreadyActive(uint256 positionId,bytes32 legKey)",
    "error PositionLegNotActive(uint256 positionId,bytes32 legKey)",
    "error NoUnresolvedPositionObligation(uint256 positionId)",
    "error ERC721InvalidOwner(address owner)",
    "error ERC721NonexistentToken(uint256 tokenId)",
    "error ERC721IncorrectOwner(address sender,uint256 tokenId,address owner)",
    "error ERC721InvalidSender(address sender)",
    "error ERC721InvalidReceiver(address receiver)",
    "error ERC721InsufficientApproval(address operator,uint256 tokenId)",
    "error ERC721InvalidApprover(address approver)",
    "error ERC721InvalidOperator(address operator)",
]);
export const staticsCollateralErrorAbi = parseAbi([
    "error BasketNotFound(uint256 basketId)",
    "error BasketNotActive(uint256 basketId,uint8 status)",
    "error InvalidShares()",
    "error InvalidReceiver()",
    "error InsufficientTransferReceived(address token,uint256 required,uint256 received)",
    "error InsufficientPositionShares(uint256 requested,uint256 available)",
    "error PositionSharesLocked(uint256 requested,uint256 unlocked)",
    "error InsufficientLockedShares(uint256 requested,uint256 locked)",
    "error PositionDepositTooRecent(uint256 positionId,uint256 basketId,uint256 withdrawableAfterBlock)",
]);
export const staticsLendingErrorAbi = parseAbi([
    "error BasketNotFound(uint256 basketId)",
    "error LoanNotFound(uint256 loanId)",
    "error InvalidReceiver()",
    "error InvalidShares()",
    "error ZeroPrincipal()",
    "error ActionPaused(uint256 action)",
    "error InsufficientVaultBalance(address asset,uint256 required,uint256 available)",
    "error LoanExpired(uint256 loanId,uint40 maturity)",
    "error LoanNotRecoverable(uint256 loanId,uint256 recoverableAt)",
    "error MaturityOverflow()",
    "error InsufficientTransferReceived(address asset,uint256 required,uint256 received)",
    "error InvalidExtensionInputLength(uint256 provided,uint256 required)",
]);
export const staticsRewardsErrorAbi = parseAbi([
    "error InvalidAmount()",
    "error InvalidReceiver()",
    "error InvalidAmountsLength()",
    "error InvalidRewardAssets()",
    "error InsufficientStake(uint256 requested,uint256 available)",
    "error IncompatibleStakingToken(uint256 requested,uint256 received)",
    "error MinimumOutputNotMet(address asset,uint256 actual,uint256 minimum)",
    "error NoRewards(uint256 positionId)",
    "error OnlySwapFeeHook(address caller,address expected)",
    "error IncompatibleRewardAsset(address asset,uint256 requested,uint256 received)",
    "error InvalidStakingToken()",
    "error InvalidRewardAsset(address asset)",
    "error RewardAssetAlreadyOptedIn(uint256 positionId,address asset)",
    "error RewardAssetNotOptedIn(uint256 positionId,address asset)",
    "error RewardAssetLimitExceeded(uint256 positionId)",
    "error InvalidMaturitySchedule(uint40 eligibleAt)",
]);
export const staticsGenesisErrorAbi = parseAbi([
    "error GenesisIntegrationNotReady()",
    "error NotAssetOwner(uint256 tokenId,address caller,address owner)",
    "error GenesisAlreadyLinked(uint256 genesisId,uint256 positionId)",
    "error PositionAlreadyLinked(uint256 positionId,uint256 genesisId)",
    "error GenesisLinkMismatch(uint256 positionId,uint256 genesisId)",
    "error LinkedOwnerMismatch(uint256 genesisId,uint256 positionId,address genesisOwner,address positionOwner)",
    "error GenesisAlreadyRegistered(uint256 genesisId)",
    "error GenesisHeldByVault(uint256 genesisId)",
    "error NotGenesisOwner(uint256 genesisId,address caller,address owner)",
    "error InvalidRewardAsset(address asset)",
    "error NoRewards()",
]);
export const staticsProtocolRevenueErrorAbi = parseAbi([
    "error InvalidReceiver()",
    "error NoRevenue(address account,address asset)",
    "error MinimumOutputNotMet(address asset,uint256 actual,uint256 minimum)",
    "error IncompatibleRevenueAsset(address asset,uint256 expected,uint256 spent,uint256 received)",
    "error InvalidPartnerTip(uint16 tipBps)",
    "error InvalidPartnerRecipient(address recipient)",
]);
export const staticsTokenErrorAbi = parseAbi([
    "error ERC20InsufficientBalance(address sender,uint256 balance,uint256 needed)",
    "error ERC20InvalidSender(address sender)",
    "error ERC20InvalidReceiver(address receiver)",
    "error ERC20InsufficientAllowance(address spender,uint256 allowance,uint256 needed)",
    "error ERC20InvalidApprover(address approver)",
    "error ERC20InvalidSpender(address spender)",
]);
export const staticsDollarRiskTokenAbi = parseAbi([
    "function balanceOf(address account,uint256 id) view returns (uint256)",
    "function isApprovedForAll(address account,address operator) view returns (bool)",
    "function setApprovalForAll(address operator,bool approved)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "event ApprovalForAll(address indexed account,address indexed operator,bool approved)",
    "event TransferSingle(address indexed operator,address indexed from,address indexed to,uint256 id,uint256 value)",
]);
export const wethAbi = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner,address spender) view returns (uint256)",
    "function approve(address spender,uint256 value) returns (bool)",
    "function deposit() payable",
    "function withdraw(uint256 amount)",
]);
export const staticsDollarCoreAbi = parseAbi([
    "function staticsDollar() view returns (address)",
    "function staticsDollarRisk() view returns (address)",
    "function periphery() view returns (address)",
    "function bootstrapFinalized() view returns (bool)",
    "function seniorLiabilities() view returns (uint256)",
    "function globalImpairmentLatched() view returns (bool)",
    "function collateralProfile(uint256 profileId) view returns ((address collateralToken,address oracle,uint8 decimals,uint16 collateralRatioBps,uint16 priceBandBps,uint16 mintFeeBps,uint16 redemptionFeeBps,uint16 insuranceTargetBps,uint16 insuranceFeeBps,uint8 kind,uint8 mode,uint256 pegMinPriceWad,uint256 pegMaxPriceWad,uint256 activeSeriesId,uint256 accountedCollateral,uint256 insuranceReserve,uint256 seniorOutstanding,uint256 debtCeiling) profile)",
    "function riskSeries(uint256 seriesId) view returns ((uint256 profileId,address collateralToken,uint256 seniorOutstanding,uint256 riskSharesOutstanding,uint256 accountedCollateral,uint256 startPriceWad,uint256 collateralPerPairWad,uint256 seniorCollateralPerUnitWad,uint256 juniorCollateralPerUnitWad,uint256 collateralRatioBps,uint256 priceBandBps,uint256 startedAt,uint256 retiredAt,uint256 successorSeriesId,uint8 status) series)",
    "function previewDeposit(uint256 profileId,uint256 collateralAmount) view returns ((uint256 profileId,uint256 seriesId,uint256 collateralIn,uint256 staticsDollarMinted,uint256 sharesMinted,uint256 feeAmount,uint256 insuranceContribution,uint256 priceWad,uint256 collateralPerPairWad,uint256 collateralRatioBpsAfter) preview)",
    "function previewRecombine(uint256 seriesId,uint256 staticsDollarAmount) view returns ((uint256 profileId,uint256 seriesId,address collateralToken,uint256 staticsDollarBurned,uint256 sharesBurned,uint256 collateralOut,uint256 feeAmount,uint256 priceWad,uint256 collateralRatioBpsAfter) preview)",
    "function profileSolvency(uint256 profileId) view returns ((uint256 collateralValueWad,uint256 seniorLiabilitiesWad,uint256 seniorDeficitWad,bool oracleAvailable,bool healthy) solvency)",
    "function globalImpairment() view returns (uint8 phase,uint256 unhealthyProfileBitmap,uint256 totalSeniorDeficitWad,uint256 recoveryAvailableAt)",
    "function peggedRedemptionStatus() view returns (uint8 status,uint256 unhealthyProfileBitmap,uint256 totalSeniorDeficitWad,uint256 recoveryAvailableAt)",
    "function profileOperationPaused(uint256 profileId,uint256 operation) view returns (bool paused)",
    "function pausedProfileOperations(uint256 profileId) view returns (uint256 operations)",
    "function collateralUsdPriceWad(uint256 profileId) view returns (uint256 priceWad)",
    "function profileSeriesCount(uint256 profileId) view returns (uint256 count)",
    "function profileSeriesAt(uint256 profileId,uint256 index) view returns (uint256 seriesId)",
]);
/**
 * Periphery diamond: consumable Risk Share liquidity and the Dollar-only exit
 * it backs.
 *
 * These live at a different address from the core pool. Read it from
 * `staticsDollarCoreAbi`'s `periphery()` rather than configuring it separately,
 * so the two can never disagree about which periphery is in use.
 *
 * The pairing vault is the reason `recombineManaged` is restricted to the
 * periphery: it burns a redeemer's Dollar against Risk Shares supplied through
 * a PositionNFT, which lets a holder exit without sourcing the junior tranche.
 * Ordinary `recombine` still requires both legs.
 */
export const staticsDollarPeripheryAbi = parseAbi([
    // -- StakingFacet: every staked Risk Share is immediately consumable.
    "function createAndStakeRiskShares(uint256 seriesId,uint256 amount,address receiver) payable returns (uint256 positionId)",
    "function stakeRiskShares(uint256 positionId,uint256 seriesId,uint256 amount)",
    "function unstakeRiskShares(uint256 positionId,uint256 seriesId,uint256 amount,address receiver) returns (uint256 principalOut)",
    "function claimRiskProceeds(uint256 positionId,uint256 seriesId,address receiver) returns (uint256 collateralAmount,uint256 staticsDollarAmount,uint256 staticsAmount)",
    "function fundRiskCollateralIncentives(uint256 seriesId,uint256 amount) returns (uint256 received)",
    "function fundRiskDollarIncentives(uint256 seriesId,uint256 amount) returns (uint256 received)",
    "function fundRiskStaticsIncentives(uint256 seriesId,uint256 amount) returns (uint256 received)",
    "function riskIncentives(uint256 seriesId) view returns ((address collateralToken,address staticsToken,uint256 collateralReserve,uint256 staticsDollarReserve,uint256 staticsReserve,uint256 destinationSeriesId,bool routedGlobal,bool finalized) view_)",
    "function finalizeRiskIncentives(uint256 seriesId) returns (uint256 destinationSeriesId,bool routedGlobal)",
    "function processSeriesTransition(uint256 oldSeriesId) returns (uint256 newSeriesId,uint256 newPrincipal)",
    "function settleSeriesMigration(uint256 positionId,uint256 oldSeriesId) returns (uint256 newSeriesId,uint256 newPrincipal)",
    "function closeRiskLiquidity(uint256 positionId,uint256 seriesId)",
    "function riskLiquidity(uint256 positionId,uint256 seriesId) view returns ((uint256 effectiveShares,uint256 claimableCollateral,uint256 claimableStaticsDollar,uint256 claimableStatics,uint64 epoch,bool exists) view_)",
    "function totalRiskLiquidity(uint256 seriesId) view returns (uint256 effectiveShares)",
    "function riskLiquidityScaleRay(uint256 seriesId) view returns (uint256 scaleRay)",
    "function positionSeriesCount(uint256 positionId) view returns (uint256 count)",
    "function positionSeriesAt(uint256 positionId,uint256 index) view returns (uint256 seriesId)",
    "function seriesMigration(uint256 oldSeriesId) view returns ((uint256 newSeriesId,uint256 oldPrincipal,uint256 remainingOldPrincipal,uint256 remainingNewPrincipal,uint256 remainingStaticsDollar,uint256 remainingCollateral,bool returned,bool claimed) migration)",
    "function reservedBalance(address token) view returns (uint256 amount)",
    "event RiskSharesStaked(uint256 indexed positionId,uint256 indexed seriesId,address indexed supplier,uint256 amount)",
    "event RiskSharesUnstaked(uint256 indexed positionId,uint256 indexed seriesId,address indexed receiver,uint256 amount)",
    "event RiskProceedsClaimed(uint256 indexed positionId,uint256 indexed seriesId,address indexed receiver,address collateralToken,address staticsToken,uint256 collateralAmount,uint256 staticsDollarAmount,uint256 staticsAmount)",
    "event RiskProceedsAccrued(uint256 indexed seriesId,uint64 indexed epoch,address indexed token,uint256 amount,bytes32 source)",
    "event RiskProceedsSettled(uint256 indexed positionId,uint256 indexed seriesId,uint256 collateralAdded,uint256 staticsDollarAdded,uint256 staticsAdded,uint256 accruedCollateral,uint256 accruedStaticsDollar,uint256 accruedStatics)",
    "event RiskIncentivesFunded(uint256 indexed seriesId,address indexed token,address indexed funder,uint256 requestedAmount,uint256 receivedAmount)",
    "event RiskIncentivesReleased(uint256 indexed seriesId,uint64 indexed epoch,uint256 riskSharesConsumed,uint256 collateralAmount,uint256 staticsDollarAmount,uint256 staticsAmount)",
    "event RiskIncentivesRolledOver(uint256 indexed seriesId,uint256 indexed destinationSeriesId,uint256 collateralAmount,uint256 staticsDollarAmount,uint256 staticsAmount)",
    "event RiskIncentivesRoutedGlobal(uint256 indexed seriesId,uint256 collateralAmount,uint256 staticsDollarAmount,uint256 staticsAmount)",
    // -- PairingVaultFacet: redeeming Dollar alone against that liquidity
    "function redeem(uint256 seriesId,uint256 staticsDollarAmount,uint256 minStaticsDollarRedeemed,uint256 minCollateralPerStaticsDollarWad,uint256 deadline,address receiver) returns (uint8 status,uint256 staticsDollarRedeemed,uint256 collateralOut)",
    "function redeemToETH(uint256 seriesId,uint256 staticsDollarAmount,uint256 minStaticsDollarRedeemed,uint256 minCollateralPerStaticsDollarWad,uint256 deadline,address receiver) returns (uint8 status,uint256 staticsDollarRedeemed,uint256 ethOut)",
    "function previewRedeem(uint256 seriesId,uint256 staticsDollarAmount) view returns ((uint256 staticsDollarRedeemed,uint256 grossCollateral,uint256 collateralToRedeemer,uint256 collateralToRiskSuppliers,uint256 collateralToInsurance,uint256 seniorCollateralPerUnitWad) preview)",
    "function redeemableLiquidity(uint256 seriesId) view returns (uint256 staticsDollarAmount)",
    "function redemptionParams() view returns (uint16 redemptionFeeBps,uint16 supplierShareBps)",
    "function setRedemptionParams(uint16 redemptionFeeBps,uint16 supplierShareBps)",
    "event Redeemed(address indexed caller,address indexed receiver,uint256 indexed seriesId,uint256 staticsDollarRedeemed,uint256 collateralToRedeemer,uint256 collateralToRiskSuppliers,uint256 collateralToInsurance)",
    "event RedemptionDeferred(address indexed caller,address indexed receiver,uint256 indexed seriesId,uint8 status,uint256 unhealthyProfileBitmap)",
    "event RedemptionParamsSet(uint16 redemptionFeeBps,uint16 supplierShareBps)",
    "event CustodyReserved(bytes32 indexed account,address indexed token,uint256 amount)",
]);
/**
 * Reverts unique to the periphery facets above.
 *
 * Shared names -- ZeroAmount, ZeroAddress, SeriesNotActive,
 * ProfileOperationPaused, InsufficientTransferReceived, UnexpectedExitStatus,
 * NativeTransferFailed -- are already in `staticsDollarErrorAbi` with identical
 * signatures and are deliberately not repeated, because a duplicate selector in
 * one array makes the decode ambiguous. Decode against both.
 */
export const staticsDollarPeripheryErrorAbi = parseAbi([
    "error NotPositionOwnerOrApproved(uint256 positionId,address caller)",
    "error UnknownRiskLiquidity(uint256 positionId,uint256 seriesId)",
    "error InsufficientRiskLiquidity(uint256 requested,uint256 available)",
    "error NoRiskProceeds(uint256 positionId,uint256 seriesId)",
    "error SeriesNotIncentiveEligible(uint256 seriesId)",
    "error SeriesIncentivesNotFinalizable(uint256 seriesId)",
    "error RiskLiquidityHasValue(uint256 positionId,uint256 seriesId)",
    "error RiskLiquidityAmountTooSmall(uint256 requested)",
    "error NoRiskLiquidity()",
    "error FillBelowMinimum(uint256 fill,uint256 minimum)",
    "error RateBelowMinimum(uint256 rateWad,uint256 minimumRateWad)",
    "error InvalidRedemptionParams(uint16 feeBps,uint16 supplierShareBps)",
    "error SeriesTransitionPending(uint256 seriesId)",
    "error NotWETHCollateral()",
    "error DeadlineExpired(uint256 deadline,uint256 currentTimestamp)",
    "error FixedAllocationExceedsGross(uint256 fixedSeniorCollateral,uint256 grossCollateral)",
    "error RiskLiquidityScaleExhausted(uint256 storedUnits)",
    "error ConsumeExceedsLiquidity(uint256 requested,uint256 available)",
    "error InsufficientUnreserved(address token,uint256 requested,uint256 available)",
    "error GlobalReservationShortfall(address token,uint256 reserved,uint256 balance)",
    "error DebitExceedsAuthorization(address token,uint256 spent,uint256 maximum)",
    "error BalanceDecreasedDuringPull(address token,uint256 beforeBalance,uint256 afterBalance)",
    "error SeriesMigrationNotReady(uint256 seriesId)",
    "error SeriesMigrationAlreadyProcessed(uint256 seriesId)",
    "error NotContractOwner(address caller,address owner)",
    // OpenZeppelin reverts these facets inherit. Without them an ordinary
    // transfer failure decodes as an unknown selector.
    "error SafeERC20FailedOperation(address token)",
    "error ReentrancyGuardReentrantCall()",
]);
export const staticsDollarErrorAbi = parseAbi([
    "error ZeroAddress()",
    "error ZeroAmount()",
    "error InvalidProfile(uint256 profileId)",
    "error InvalidSeries(uint256 seriesId)",
    "error InvalidProfileKind(uint256 profileId,uint8 expected,uint8 actual)",
    "error InvalidProfileMode(uint256 profileId,uint8 mode)",
    "error ProfileOperationPaused(uint256 profileId,uint256 operation)",
    "error ProfileImpaired(uint256 profileId,uint256 seniorDeficitWad)",
    "error OutputBelowMinimum(uint256 actual,uint256 minimum)",
    "error SharesAboveMaximum(uint256 required,uint256 maximum)",
    "error CollateralAboveMaximum(uint256 required,uint256 maximum)",
    "error DepositTooSmall()",
    "error RedemptionTooSmall()",
    "error DebtCeilingExceeded(uint256 profileId,uint256 attemptedSeniorOutstanding,uint256 debtCeiling)",
    "error SeriesNotActive(uint256 seriesId)",
    "error TransitionRequired(uint256 profileId,uint256 seriesId,uint256 currentPriceWad)",
    "error CollateralExitUnavailable(uint8 status,uint256 unhealthyProfileBitmap)",
    "error UnexpectedCollateralProfile(uint256 expectedProfileId,uint256 actualProfileId)",
    "error InsufficientTransferReceived(address token,uint256 required,uint256 received)",
    "error UnexpectedOutputAmount(address token,uint256 expected,uint256 observed)",
    "error SeriesUnavailableForOrdinaryRecombination(uint256 seriesId,uint8 status)",
    "error UnexpectedExitStatus(uint8 status)",
    "error UnexpectedRiskIngressState()",
    "error NativeTransferFailed(address receiver,uint256 amount)",
]);
/// Builds a Genesis acquisition. `maxNativeValue` is the maximum native ETH the caller
/// authorizes. During the Genesis Epoch it must cover the native acquisition fee; after the
/// epoch it must cover the reserve buy-in plus that fee. Any excess is refunded on-chain.
/// Read `quoteGenesisPurchase().requiredNative` for the current amount.
export function buildBuyGenesisTransaction(tokenId, receiver, maxNativeValue) {
    if (maxNativeValue < 0n)
        throw new Error("maximum native Genesis acquisition value cannot be negative");
    return {
        data: encodeFunctionData({
            abi: staticsGenesisVaultAbi,
            functionName: "buyGenesis",
            args: [tokenId, receiver],
        }),
        value: maxNativeValue,
    };
}
/// Builds a permissionless reserve capitalization call. The attached native value is added to
/// the permanent Genesis ETH reserve in full and can never be withdrawn.
export function buildDonateGenesisReserveTransaction(nativeAmount) {
    if (nativeAmount <= 0n)
        throw new Error("Genesis reserve donation must be positive");
    return {
        data: encodeFunctionData({
            abi: staticsGenesisVaultAbi,
            functionName: "donate",
        }),
        value: nativeAmount,
    };
}
export function buildRedeemGenesisCall(tokenId, receiver) {
    return encodeFunctionData({
        abi: staticsGenesisVaultAbi,
        functionName: "redeemGenesis",
        args: [tokenId, receiver],
    });
}
/// Builds a permissionless Doppler-native release of all currently vested treasury STATICS.
/// The token contract always sends the assets directly to the committed beneficiary.
export function buildReleaseTreasuryStaticsCall(beneficiary) {
    return encodeFunctionData({
        abi: dopplerERC20V1VestingAbi,
        functionName: "releaseFor",
        args: [beneficiary, 0n, 0n],
    });
}
/// Builds the recipient-admin-only recovery of STATICS retained by the bootstrap contract.
export function buildSweepTreasuryStaticsSurplusCall() {
    return encodeFunctionData({ abi: staticsTreasuryVestingAbi, functionName: "sweepStaticsSurplus" });
}
/// Builds a permissionless release of currently vested treasury Genesis. Values above the
/// onchain batch cap are clamped by the vesting contract; zero is rejected before encoding.
export function buildReleaseTreasuryGenesisCall(maxCount) {
    if (maxCount <= 0n)
        throw new Error("treasury Genesis release count must be positive");
    return encodeFunctionData({
        abi: staticsTreasuryVestingAbi,
        functionName: "releaseGenesis",
        args: [maxCount],
    });
}
/// Builds the governance-only recipient recovery call. This changes only the destination of
/// future releases and cannot change vesting principal or timing.
export function buildSetTreasuryWithdrawalRecipientCall(newRecipient) {
    return encodeFunctionData({
        abi: staticsTreasuryVestingAbi,
        functionName: "setWithdrawalRecipient",
        args: [newRecipient],
    });
}
export function buildActivateGenesisCall(genesisId, targetTier) {
    if (!Number.isInteger(targetTier) || targetTier < 1 || targetTier > 4) {
        throw new Error("target Genesis tier must be between 1 and 4");
    }
    return encodeFunctionData({
        abi: genesisActivationRegistryAbi,
        functionName: "activate",
        args: [genesisId, targetTier],
    });
}
export function buildRegisterGenesisCall(genesisId) {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "registerGenesis",
        args: [genesisId],
    });
}
export function buildClaimGenesisLaunchRewardsCall(genesisId, asset, receiver) {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "claimGenesis",
        args: [genesisId, asset, receiver],
    });
}
export function buildClaimOwnerGenesisLaunchRewardsCall(asset, receiver) {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "claimOwnerRewards",
        args: [asset, receiver],
    });
}
export function buildClaimAllGenesisLaunchRewardsCall(genesisIds, receiver) {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "claimAllGenesisRewards",
        args: [genesisIds, receiver],
    });
}
export function buildClaimAllGenesisLaunchTreasuryRewardsCall(receiver) {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "claimAllGenesisTreasuryRewards",
        args: [receiver],
    });
}
export function buildAccrueGenesisLaunchRewardsCall() {
    return encodeFunctionData({
        abi: genesisLaunchDistributorAbi,
        functionName: "accrue",
    });
}
export function buildRegisterGenesisRewardsCall(genesisId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "registerGenesis", args: [genesisId] });
}
export function buildAccrueGenesisRewardsCall() {
    return encodeFunctionData({ abi: staticsAbi, functionName: "accrueGenesisRewards" });
}
export function buildClaimGenesisRewardsCall(genesisId, asset, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimGenesisRewards",
        args: [genesisId, asset, receiver],
    });
}
export function buildClaimGenesisOwnerRewardsCall(asset, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "claimGenesisOwnerRewards", args: [asset, receiver] });
}
export function buildClaimGenesisTreasuryRewardsCall(asset, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "claimGenesisTreasuryRewards", args: [asset, receiver] });
}
export function buildClaimAllGenesisRewardsCall(genesisIds, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "claimAllGenesisRewards", args: [genesisIds, receiver] });
}
export function buildClaimAllGenesisTreasuryRewardsCall(receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "claimAllGenesisTreasuryRewards", args: [receiver] });
}
export function buildSetGenesisRewardShareBpsCall(newShareBps) {
    if (!Number.isInteger(newShareBps) || newShareBps < 0 || newShareBps > Number(BPS)) {
        throw new Error(`Genesis reward share must be an integer from 0 through ${BPS} BPS`);
    }
    return encodeFunctionData({ abi: staticsAbi, functionName: "setGenesisRewardShareBps", args: [newShareBps] });
}
export function cumulativeGenesisActivationCost(tierCosts, currentTier, targetTier) {
    if (!Number.isInteger(currentTier) || currentTier < 0 || currentTier > 3) {
        throw new Error("Genesis current tier must be an integer from 0 through 3");
    }
    if (!Number.isInteger(targetTier) || targetTier <= currentTier || targetTier > 4) {
        throw new Error("Genesis target tier must be above the current tier and no greater than 4");
    }
    let total = 0n;
    for (let tier = currentTier + 1; tier <= targetTier; tier += 1) {
        const cost = tierCosts[tier];
        if (cost === undefined || cost < 0n)
            throw new Error(`missing or invalid Genesis tier ${tier} cost`);
        total += cost;
    }
    return total;
}
export function buildCreateBasketTransaction(params, pools, maxAmountsIn, launchDeadline, creationFee) {
    return {
        data: encodeFunctionData({
            abi: staticsAbi,
            functionName: "createBasket",
            args: [params, pools, maxAmountsIn, launchDeadline],
        }),
        value: creationFee,
    };
}
export function buildTestnetFaucetClaimCall() {
    return encodeFunctionData({
        abi: staticsTestnetFaucetAbi,
        functionName: "claim",
    });
}
export function buildApproveV4PositionCall(operator, tokenId) {
    return encodeFunctionData({
        abi: v4PositionManagerReadAbi,
        functionName: "approve",
        args: [operator, tokenId],
    });
}
export function buildPermit2ApproveCall(token, spender, amount, expiration) {
    if (amount < 0n || amount > ((1n << 160n) - 1n))
        throw new Error("Permit2 amount exceeds uint160");
    if (!Number.isInteger(expiration) || expiration < 0 || expiration > 0xffff_ffff_ffff) {
        throw new Error("Permit2 expiration exceeds uint48");
    }
    return encodeFunctionData({
        abi: permit2AllowanceAbi,
        functionName: "approve",
        args: [token, spender, amount, expiration],
    });
}
export function buildPermit2PermitTypedData(chainId, permit2, permitSingle) {
    _validatePermit2Permit(permitSingle);
    return {
        domain: {
            name: "Permit2",
            chainId,
            verifyingContract: permit2,
        },
        types: {
            PermitDetails: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint160" },
                { name: "expiration", type: "uint48" },
                { name: "nonce", type: "uint48" },
            ],
            PermitSingle: [
                { name: "details", type: "PermitDetails" },
                { name: "spender", type: "address" },
                { name: "sigDeadline", type: "uint256" },
            ],
        },
        primaryType: "PermitSingle",
        message: permitSingle,
    };
}
export function buildErc20PermitTypedData(params) {
    return {
        domain: {
            name: params.tokenName,
            version: "1",
            chainId: params.chainId,
            verifyingContract: params.token,
        },
        types: {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        primaryType: "Permit",
        message: {
            owner: params.owner,
            spender: params.spender,
            value: params.value,
            nonce: params.nonce,
            deadline: params.deadline,
        },
    };
}
export function buildQuoteV4ExactInputSingleCall(poolKey, zeroForOne, exactAmount, hookData = "0x") {
    _validateUint128(exactAmount, "exact input amount");
    return encodeFunctionData({
        abi: v4QuoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ poolKey, zeroForOne, exactAmount, hookData }],
    });
}
export function v4PoolId(poolKey) {
    return keccak256(encodeAbiParameters(parseAbiParameters("(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)"), [poolKey]));
}
export function buildV4ExactInputSingleSwap(request) {
    _validateUint128(request.amountIn, "swap input amount");
    _validateUint128(request.amountOutMinimum, "minimum swap output");
    const inputCurrency = request.zeroForOne ? request.poolKey.currency0 : request.poolKey.currency1;
    const outputCurrency = request.zeroForOne ? request.poolKey.currency1 : request.poolKey.currency0;
    const hookData = request.hookData ?? "0x";
    const minHopPriceX36 = request.minHopPriceX36 ?? 0n;
    const settlement = request.settlement ?? { input: "erc20", output: "erc20" };
    const nativeInput = settlement.input === "native";
    const nativeOutput = settlement.output === "native";
    if (nativeInput && nativeOutput)
        throw new Error("a single-hop swap cannot use native input and output");
    if (nativeInput && settlement.wrappedNative.toLowerCase() !== inputCurrency.toLowerCase()) {
        throw new Error("native input must be the configured wrapped-native pool currency");
    }
    if (nativeOutput && settlement.wrappedNative.toLowerCase() !== outputCurrency.toLowerCase()) {
        throw new Error("native output must be the configured wrapped-native pool currency");
    }
    if (nativeInput && request.permit)
        throw new Error("native input cannot include a Permit2 permit");
    const msgSender = "0x0000000000000000000000000000000000000001";
    const routerAddress = "0x0000000000000000000000000000000000000002";
    const actions = toHex(new Uint8Array(nativeInput ? [0x06, 0x0b, 0x0f] : nativeOutput ? [0x06, 0x0c, 0x0e] : [0x06, 0x0c, 0x0f]));
    const params = [
        encodeAbiParameters(parseAbiParameters("((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,uint256 minHopPriceX36,bytes hookData)"), [{
                poolKey: request.poolKey,
                zeroForOne: request.zeroForOne,
                amountIn: request.amountIn,
                amountOutMinimum: request.amountOutMinimum,
                minHopPriceX36,
                hookData,
            }]),
        nativeInput
            ? encodeAbiParameters(parseAbiParameters("address currency,uint256 amount,bool payerIsUser"), [inputCurrency, request.amountIn, false])
            : encodeAbiParameters(parseAbiParameters("address currency,uint256 amount"), [inputCurrency, request.amountIn]),
        nativeOutput
            ? encodeAbiParameters(parseAbiParameters("address currency,address recipient,uint256 amount"), [outputCurrency, routerAddress, 0n])
            : encodeAbiParameters(parseAbiParameters("address currency,uint256 minimumAmount"), [outputCurrency, request.amountOutMinimum]),
    ];
    const swapPlan = encodeAbiParameters(parseAbiParameters("bytes actions,bytes[] params"), [actions, params]);
    let commands = toHex(new Uint8Array(nativeInput ? [0x0b, 0x10] : nativeOutput ? [0x10, 0x0c] : [0x10]));
    let inputs = nativeInput
        ? [
            encodeAbiParameters(parseAbiParameters("address recipient,uint256 amount"), [routerAddress, request.amountIn]),
            swapPlan,
        ]
        : nativeOutput
            ? [
                swapPlan,
                encodeAbiParameters(parseAbiParameters("address recipient,uint256 amountMinimum"), [msgSender, request.amountOutMinimum]),
            ]
            : [swapPlan];
    if (request.permit) {
        const { permitSingle, signature } = request.permit;
        _validatePermit2Permit(permitSingle);
        if (permitSingle.spender.toLowerCase() !== request.router.toLowerCase()) {
            throw new Error("Permit2 spender must be the Universal Router");
        }
        if (permitSingle.details.token.toLowerCase() !== inputCurrency.toLowerCase()) {
            throw new Error("Permit2 token must be the swap input currency");
        }
        if (permitSingle.details.amount !== request.amountIn) {
            throw new Error("Permit2 amount must equal the swap input amount");
        }
        commands = toHex(new Uint8Array(nativeOutput ? [0x0a, 0x10, 0x0c] : [0x0a, 0x10]));
        inputs = [
            encodeAbiParameters(parseAbiParameters("((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline) permitSingle,bytes signature"), [permitSingle, signature]),
            swapPlan,
            ...(nativeOutput
                ? [
                    encodeAbiParameters(parseAbiParameters("address recipient,uint256 amountMinimum"), [msgSender, request.amountOutMinimum]),
                ]
                : []),
        ];
    }
    return {
        target: request.router,
        calldata: encodeFunctionData({
            abi: universalRouterAbi,
            functionName: "execute",
            args: [commands, inputs, request.deadline],
        }),
        value: nativeInput ? request.amountIn : 0n,
    };
}
function _validatePermit2Permit(permitSingle) {
    if (permitSingle.details.amount < 0n || permitSingle.details.amount > ((1n << 160n) - 1n)) {
        throw new Error("Permit2 amount exceeds uint160");
    }
    if (!Number.isInteger(permitSingle.details.expiration)
        || permitSingle.details.expiration < 0
        || permitSingle.details.expiration > 0xffff_ffff_ffff
        || !Number.isInteger(permitSingle.details.nonce)
        || permitSingle.details.nonce < 0
        || permitSingle.details.nonce > 0xffff_ffff_ffff) {
        throw new Error("Permit2 expiration or nonce exceeds uint48");
    }
}
function _validateUint128(value, label) {
    if (value < 0n || value > ((1n << 128n) - 1n)) {
        throw new Error(`${label} exceeds uint128`);
    }
}
export function buildMintV4PositionCall(request) {
    if (request.liquidity <= 0n || request.liquidity > ((1n << 128n) - 1n)) {
        throw new Error("liquidity exceeds uint128");
    }
    if (request.amount0Max < 0n
        || request.amount0Max > ((1n << 128n) - 1n)
        || request.amount1Max < 0n
        || request.amount1Max > ((1n << 128n) - 1n))
        throw new Error("position amount exceeds uint128");
    const position = encodeAbiParameters(parseAbiParameters("(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),int24,int24,uint256,uint128,uint128,address,bytes"), [
        request.poolKey,
        request.tickLower,
        request.tickUpper,
        request.liquidity,
        request.amount0Max,
        request.amount1Max,
        request.recipient,
        "0x",
    ]);
    const unlockData = encodeAbiParameters(parseAbiParameters("bytes,bytes[]"), ["0x021212", [
            position,
            encodeAbiParameters(parseAbiParameters("address"), [request.poolKey.currency0]),
            encodeAbiParameters(parseAbiParameters("address"), [request.poolKey.currency1]),
        ]]);
    return encodeFunctionData({
        abi: v4PositionManagerReadAbi,
        functionName: "modifyLiquidities",
        args: [unlockData, request.deadline],
    });
}
export function buildMintCall(basketId, shares, receiver, maxAmountsIn) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "mint", args: [basketId, shares, receiver, maxAmountsIn] });
}
export function buildRedeemCall(basketId, shares, receiver, minAmountsOut) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "redeem", args: [basketId, shares, receiver, minAmountsOut] });
}
export function buildCreateAndDepositBasketCollateralCall(basketId, shares, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "createAndDepositBasketCollateral", args: [basketId, shares, receiver] });
}
export function buildDepositBasketCollateralCall(positionId, basketId, shares) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "depositBasketCollateral", args: [positionId, basketId, shares] });
}
export function buildWithdrawBasketCollateralCall(positionId, basketId, shares, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "withdrawBasketCollateral", args: [positionId, basketId, shares, receiver] });
}
export function buildCreateAndMintBasketCollateralCall(basketId, shares, receiver, maxAmountsIn) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "createAndMintBasketCollateral", args: [basketId, shares, receiver, maxAmountsIn] });
}
export function buildMintBasketCollateralCall(positionId, basketId, shares, maxAmountsIn) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "mintBasketCollateral", args: [positionId, basketId, shares, maxAmountsIn] });
}
export function buildRedeemBasketCollateralCall(positionId, basketId, shares, receiver, minAmountsOut) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "redeemBasketCollateral",
        args: [positionId, basketId, shares, receiver, minAmountsOut],
    });
}
export function buildClaimRewardsCall(positionId, assets, receiver, minAmountsOut) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimRewards",
        args: [positionId, assets, receiver, minAmountsOut],
    });
}
export function buildClaimBasketRewardsCall(positionId, basketId, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimBasketRewards",
        args: [positionId, basketId, receiver],
    });
}
export function buildCreateAndStakeCall(amount, receiver, rewardAssets) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "createAndStake",
        args: [amount, receiver, rewardAssets],
    });
}
export function buildOptInRewardAssetsCall(positionId, assets) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "optInRewardAssets", args: [positionId, assets] });
}
export function buildOptOutRewardAssetsCall(positionId, assets) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "optOutRewardAssets", args: [positionId, assets] });
}
export function buildStakeCall(positionId, amount) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "stake", args: [positionId, amount] });
}
export function buildUnstakeCall(positionId, amount, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "unstake", args: [positionId, amount, receiver] });
}
export function buildCheckpointRewardAssetsCall(assets) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "checkpointRewardAssets", args: [assets] });
}
export function buildLinkGenesisCall(positionId, genesisId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "linkGenesis", args: [positionId, genesisId] });
}
export function buildUnlinkGenesisCall(positionId, genesisId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "unlinkGenesis", args: [positionId, genesisId] });
}
export function buildDeployMorphoCollateralCall(positionId, marketId, assets) {
    if (assets <= 0n)
        throw new Error("Morpho collateral amount must be positive");
    return encodeFunctionData({ abi: staticsAbi, functionName: "deployMorphoCollateral", args: [positionId, marketId, assets] });
}
export function buildRecallMorphoCollateralCall(positionId, marketId, assets) {
    if (assets <= 0n)
        throw new Error("Morpho collateral amount must be positive");
    return encodeFunctionData({ abi: staticsAbi, functionName: "recallMorphoCollateral", args: [positionId, marketId, assets] });
}
export function buildWithdrawUntrackedMorphoCollateralCall(positionId, marketId, assets, receiver) {
    if (assets <= 0n)
        throw new Error("Morpho surplus amount must be positive");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "withdrawUntrackedMorphoCollateral",
        args: [positionId, marketId, assets, receiver],
    });
}
export function buildBorrowMorphoUsdCall(positionId, marketId, assets, maxBorrowShares, receiver) {
    if (assets <= 0n || maxBorrowShares <= 0n)
        throw new Error("Morpho borrow bounds must be positive");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "borrowMorphoUsd",
        args: [positionId, marketId, assets, maxBorrowShares, receiver],
    });
}
export function buildRepayMorphoUsdCall(positionId, marketId, assets, shares, maxAssets) {
    if ((assets === 0n) === (shares === 0n))
        throw new Error("Choose Morpho repay assets or shares");
    if (maxAssets <= 0n)
        throw new Error("Morpho maximum repay assets must be positive");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "repayMorphoUsd",
        args: [positionId, marketId, assets, shares, maxAssets],
    });
}
export function buildSyncMorphoCall(positionId, marketId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "syncMorpho", args: [positionId, marketId] });
}
export function buildClaimMorphoSyncBountiesCall(assets, receiver) {
    if (assets.length === 0)
        throw new Error("Choose at least one Morpho bounty asset");
    return encodeFunctionData({ abi: staticsAbi, functionName: "claimMorphoSyncBounties", args: [assets, receiver] });
}
function validateMorphoAssetsOrShares(assets, shares, action) {
    if (assets < 0n || shares < 0n || (assets === 0n) === (shares === 0n)) {
        throw new Error(`Choose Morpho ${action} assets or shares`);
    }
}
export function buildMorphoSupplyCall(marketParams, assets, shares, onBehalf) {
    validateMorphoAssetsOrShares(assets, shares, "supply");
    return encodeFunctionData({
        abi: morphoBlueAbi,
        functionName: "supply",
        args: [marketParams, assets, shares, onBehalf, "0x"],
    });
}
export function buildMorphoWithdrawCall(marketParams, assets, shares, onBehalf, receiver) {
    validateMorphoAssetsOrShares(assets, shares, "withdrawal");
    return encodeFunctionData({
        abi: morphoBlueAbi,
        functionName: "withdraw",
        args: [marketParams, assets, shares, onBehalf, receiver],
    });
}
export function buildDistributePartnerRevenueCall(recipient, asset) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "distributePartnerRevenue",
        args: [recipient, asset],
    });
}
export function buildBorrowCall(positionId, basketId, sharesIn, receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "borrow", args: [positionId, basketId, sharesIn, receiver] });
}
export function buildRepayCall(loanId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "repay", args: [loanId] });
}
export function buildExtendCall(loanId, grossAmountsIn) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "extend", args: [loanId, grossAmountsIn] });
}
export function buildRecoverCall(loanId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "recover", args: [loanId] });
}
export function buildFlashLoanCall(basketId, shares, receiver, data) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "flashLoan", args: [basketId, shares, receiver, data] });
}
export function buildCreatePositionCall(receiver) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "createPosition", args: [receiver] });
}
export function buildSetPositionCreationFeeCall(amount) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "setPositionCreationFee", args: [amount] });
}
export function buildClosePositionCall(positionId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "closePosition", args: [positionId] });
}
export function buildQuarantineBasketCall(basketId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "quarantineBasket", args: [basketId] });
}
export function buildReleaseBasketQuarantineCall(basketId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "releaseBasketQuarantine", args: [basketId] });
}
export function buildDecommissionBasketCall(basketId) {
    return encodeFunctionData({ abi: staticsAbi, functionName: "decommissionBasket", args: [basketId] });
}
function toUint16(value, field) {
    if (value < 0n || value > 65535n)
        throw new Error(`${field} exceeds uint16`);
    return Number(value);
}
function coerceSwapFeeConfiguration(configuration) {
    return {
        inputFeeBps: toUint16(configuration.inputFeeBps, "inputFeeBps"),
        outputFeeBps: toUint16(configuration.outputFeeBps, "outputFeeBps"),
        polShareBps: toUint16(configuration.polShareBps, "polShareBps"),
        liquidityProviderShareBps: toUint16(configuration.liquidityProviderShareBps, "liquidityProviderShareBps"),
        basketStakerShareBps: toUint16(configuration.basketStakerShareBps, "basketStakerShareBps"),
        staticsStakerShareBps: toUint16(configuration.staticsStakerShareBps, "staticsStakerShareBps"),
        treasuryShareBps: toUint16(configuration.treasuryShareBps, "treasuryShareBps"),
    };
}
function validatedPoolFeeConfiguration(configuration) {
    if (configuration.inputFeeBps + configuration.outputFeeBps > 200n) {
        throw new Error("combined pool fee rate exceeds 200 BPS");
    }
    if (configuration.polShareBps + configuration.liquidityProviderShareBps
        + configuration.basketStakerShareBps + configuration.staticsStakerShareBps
        + configuration.treasuryShareBps !== CONFIGURABLE_SHARE_BPS) {
        throw new Error("pool fee shares must sum to 9500 BPS");
    }
    return coerceSwapFeeConfiguration(configuration);
}
export function buildSetSwapFeeConfigurationCall(configuration) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setSwapFeeConfiguration",
        args: [coerceSwapFeeConfiguration(configuration)],
    });
}
export function buildSetCanonicalPoolFeeConfigurationCall(basketId, asset, configuration) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setCanonicalPoolFeeConfiguration",
        args: [basketId, asset, validatedPoolFeeConfiguration(configuration)],
    });
}
// --- Protocol pool helpers ---
/// @dev Uniswap v4 TickMath price bounds; a normalized initial price must be within [MIN, MAX).
export const MIN_SQRT_PRICE = 4295128739n;
export const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;
/// @dev Canonical Statics protocol-pool policy bounds, mirroring `LibProtocolPoolFee`.
export const PROTOCOL_LP_FEE = 0;
export const MIN_TICK_SPACING = 1;
export const MAX_TICK_SPACING = 32_767;
export const MAX_COMBINED_FEE_BPS = 200n;
export const CONFIGURABLE_SHARE_BPS = 9500n;
export const CREATOR_SHARE_BPS = 500n;
/// @dev Statics Protocol Pools EIP-712 domain name and version, matching `ProtocolPoolCreationFacet`.
export const PROTOCOL_POOLS_DOMAIN_NAME = "Statics Protocol Pools";
export const PROTOCOL_POOLS_DOMAIN_VERSION = "1";
function _lowerAddress(value) {
    return BigInt(value.toLowerCase());
}
/// @notice Returns v4-sorted (currency0, currency1) for a token pair, mirroring the Solidity
/// `tokenA < tokenB` numeric address comparison.
export function sortPoolCurrencies(tokenA, tokenB) {
    if (tokenA.toLowerCase() === tokenB.toLowerCase())
        throw new Error("identical pool tokens");
    const tokenAIsCurrency0 = _lowerAddress(tokenA) < _lowerAddress(tokenB);
    return tokenAIsCurrency0
        ? { currency0: tokenA, currency1: tokenB, tokenAIsCurrency0 }
        : { currency0: tokenB, currency1: tokenA, tokenAIsCurrency0 };
}
/// @notice Normalizes a raw B-per-A sqrt price (X96) into the v4 sorted (currency1-per-currency0)
/// sqrt price. When tokenA sorts first the price is used directly; otherwise it is reciprocated
/// as `Q96 * Q96 / sqrtPriceBPerAX96`, matching `ProtocolPoolCreationFacet._sortedSqrtPrice`.
export function normalizeSqrtPriceBPerAX96(tokenA, tokenB, sqrtPriceBPerAX96) {
    if (sqrtPriceBPerAX96 <= 0n)
        throw new Error("invalid pool price");
    const { tokenAIsCurrency0 } = sortPoolCurrencies(tokenA, tokenB);
    const sorted = tokenAIsCurrency0 ? sqrtPriceBPerAX96 : (Q96 * Q96) / sqrtPriceBPerAX96;
    if (sorted > ((1n << 160n) - 1n))
        throw new Error("invalid pool price");
    if (sorted < MIN_SQRT_PRICE || sorted >= MAX_SQRT_PRICE)
        throw new Error("invalid pool price");
    return sorted;
}
function _validateTickSpacing(tickSpacing) {
    if (!Number.isInteger(tickSpacing) || tickSpacing < MIN_TICK_SPACING || tickSpacing > MAX_TICK_SPACING) {
        throw new Error("tick spacing outside protocol bounds");
    }
    return tickSpacing;
}
/// @notice Builds the sorted zero-native-fee Statics protocol PoolKey for a pair.
export function buildProtocolPoolKey(tokenA, tokenB, tickSpacing, hook) {
    _validateTickSpacing(tickSpacing);
    const { currency0, currency1 } = sortPoolCurrencies(tokenA, tokenB);
    return { currency0, currency1, fee: PROTOCOL_LP_FEE, tickSpacing, hooks: hook };
}
/// @notice Computes the v4 PoolId as `keccak256(abi.encode(poolKey))`, matching `PoolIdLibrary.toId`.
export function computePoolId(key) {
    return keccak256(encodeAbiParameters(parseAbiParameters("address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks"), [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]));
}
function validatedPoolSwapFeeRate(feeRate) {
    const inputFeeBps = toUint16(feeRate.inputFeeBps, "inputFeeBps");
    const outputFeeBps = toUint16(feeRate.outputFeeBps, "outputFeeBps");
    if (BigInt(inputFeeBps) + BigInt(outputFeeBps) > MAX_COMBINED_FEE_BPS) {
        throw new Error("combined pool fee rate exceeds 200 BPS");
    }
    return { inputFeeBps, outputFeeBps };
}
function validatedBasketFeeAllocation(allocation) {
    const polShareBps = toUint16(allocation.polShareBps, "polShareBps");
    const liquidityProviderShareBps = toUint16(allocation.liquidityProviderShareBps, "liquidityProviderShareBps");
    const basketStakerShareBps = toUint16(allocation.basketStakerShareBps, "basketStakerShareBps");
    const staticsStakerShareBps = toUint16(allocation.staticsStakerShareBps, "staticsStakerShareBps");
    const treasuryShareBps = toUint16(allocation.treasuryShareBps, "treasuryShareBps");
    const total = BigInt(polShareBps) + BigInt(liquidityProviderShareBps) + BigInt(basketStakerShareBps)
        + BigInt(staticsStakerShareBps) + BigInt(treasuryShareBps);
    if (total !== CONFIGURABLE_SHARE_BPS)
        throw new Error("basket fee allocation must sum to 9500 BPS");
    return { polShareBps, liquidityProviderShareBps, basketStakerShareBps, staticsStakerShareBps, treasuryShareBps };
}
function validatedGeneralFeeAllocation(allocation) {
    const polShareBps = toUint16(allocation.polShareBps, "polShareBps");
    const liquidityProviderShareBps = toUint16(allocation.liquidityProviderShareBps, "liquidityProviderShareBps");
    const staticsStakerShareBps = toUint16(allocation.staticsStakerShareBps, "staticsStakerShareBps");
    const treasuryShareBps = toUint16(allocation.treasuryShareBps, "treasuryShareBps");
    const total = BigInt(polShareBps) + BigInt(liquidityProviderShareBps)
        + BigInt(staticsStakerShareBps) + BigInt(treasuryShareBps);
    if (total !== CONFIGURABLE_SHARE_BPS)
        throw new Error("general fee allocation must sum to 9500 BPS");
    return { polShareBps, liquidityProviderShareBps, staticsStakerShareBps, treasuryShareBps };
}
function _validateUint256(value, label) {
    if (value < 0n || value > MAX_UINT256)
        throw new Error(`${label} exceeds uint256`);
    return value;
}
function coerceCreatePoolParams(params) {
    if (params.sqrtPriceBPerAX96 <= 0n || params.sqrtPriceBPerAX96 > ((1n << 160n) - 1n)) {
        throw new Error("sqrtPriceBPerAX96 exceeds uint160");
    }
    return {
        tokenA: params.tokenA,
        tokenB: params.tokenB,
        tickSpacing: _validateTickSpacing(params.tickSpacing),
        sqrtPriceBPerAX96: params.sqrtPriceBPerAX96,
        feeRate: validatedPoolSwapFeeRate(params.feeRate),
        creator: params.creator,
        nonce: _validateUint256(params.nonce, "nonce"),
        deadline: _validateUint256(params.deadline, "deadline"),
    };
}
/// @notice Builds the EIP-712 typed data for a `CreatePool` creator authorization, bound to the
/// Statics Protocol Pools domain and the Diamond `verifyingContract`. `poolId` and `sqrtPriceX96`
/// are the normalized, sorted values the Diamond derives during quoting.
export function buildCreatePoolAuthorizationTypedData(chainId, diamond, message) {
    return {
        domain: {
            name: PROTOCOL_POOLS_DOMAIN_NAME,
            version: PROTOCOL_POOLS_DOMAIN_VERSION,
            chainId,
            verifyingContract: diamond,
        },
        types: {
            CreatePool: [
                { name: "poolId", type: "bytes32" },
                { name: "sqrtPriceX96", type: "uint160" },
                { name: "inputFeeBps", type: "uint16" },
                { name: "outputFeeBps", type: "uint16" },
                { name: "creator", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        },
        primaryType: "CreatePool",
        message: {
            poolId: message.poolId,
            sqrtPriceX96: message.sqrtPriceX96,
            inputFeeBps: toUint16(message.inputFeeBps, "inputFeeBps"),
            outputFeeBps: toUint16(message.outputFeeBps, "outputFeeBps"),
            creator: message.creator,
            nonce: _validateUint256(message.nonce, "nonce"),
            deadline: _validateUint256(message.deadline, "deadline"),
        },
    };
}
/// @notice Computes the EIP-712 digest for a `CreatePool` authorization without a wallet, mirroring
/// `ProtocolPoolCreationFacet._authorizationDigest` (domain separator + struct hash + 0x1901 prefix).
export function computeCreatePoolAuthorizationDigest(chainId, diamond, message) {
    const domainTypeHash = keccak256(toHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
    const domainSeparator = keccak256(encodeAbiParameters(parseAbiParameters("bytes32,bytes32,bytes32,uint256,address"), [
        domainTypeHash,
        keccak256(toHex(PROTOCOL_POOLS_DOMAIN_NAME)),
        keccak256(toHex(PROTOCOL_POOLS_DOMAIN_VERSION)),
        BigInt(chainId),
        diamond,
    ]));
    const createPoolTypeHash = keccak256(toHex("CreatePool(bytes32 poolId,uint160 sqrtPriceX96,uint16 inputFeeBps,uint16 outputFeeBps,address creator,uint256 nonce,uint256 deadline)"));
    const structHash = keccak256(encodeAbiParameters(parseAbiParameters("bytes32,bytes32,uint160,uint16,uint16,address,uint256,uint256"), [
        createPoolTypeHash,
        message.poolId,
        message.sqrtPriceX96,
        toUint16(message.inputFeeBps, "inputFeeBps"),
        toUint16(message.outputFeeBps, "outputFeeBps"),
        message.creator,
        _validateUint256(message.nonce, "nonce"),
        _validateUint256(message.deadline, "deadline"),
    ]));
    return keccak256(concatHex(["0x1901", domainSeparator, structHash]));
}
/// @notice Off-chain quoting of the sorted PoolKey, PoolId, normalized price, creation fee, and
/// EIP-712 authorization digest for a pool creation, matching `ProtocolPoolCreationFacet.quotePool`.
/// The returned digest equals the on-chain `quote.authorizationDigest` a creator must sign.
export function quoteProtocolPool(chainId, diamond, hook, params, creationFee = 0n) {
    const feeRate = validatedPoolSwapFeeRate(params.feeRate);
    const sqrtPriceX96 = normalizeSqrtPriceBPerAX96(params.tokenA, params.tokenB, params.sqrtPriceBPerAX96);
    const key = buildProtocolPoolKey(params.tokenA, params.tokenB, params.tickSpacing, hook);
    const poolId = computePoolId(key);
    const authorizationDigest = computeCreatePoolAuthorizationDigest(chainId, diamond, {
        poolId,
        sqrtPriceX96,
        inputFeeBps: BigInt(feeRate.inputFeeBps),
        outputFeeBps: BigInt(feeRate.outputFeeBps),
        creator: params.creator,
        nonce: params.nonce,
        deadline: params.deadline,
    });
    return {
        key,
        poolId,
        sqrtPriceX96,
        feeRate: { inputFeeBps: BigInt(feeRate.inputFeeBps), outputFeeBps: BigInt(feeRate.outputFeeBps) },
        creationFee: _validateUint256(creationFee, "creationFee"),
        authorizationDigest,
    };
}
export function buildQuotePoolCall(params) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "quotePool",
        args: [coerceCreatePoolParams(params)],
    });
}
export function buildCreatePoolTransaction(params, creationFee, creatorAuthorization = "0x") {
    return {
        data: encodeFunctionData({
            abi: staticsAbi,
            functionName: "createPool",
            args: [coerceCreatePoolParams(params), creatorAuthorization],
        }),
        value: _validateUint256(creationFee, "creationFee"),
    };
}
export function buildInvalidatePoolCreationNonceCall(nonce) {
    if (nonce < 0n || nonce > MAX_UINT256)
        throw new Error("nonce exceeds uint256");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "invalidatePoolCreationNonce",
        args: [nonce],
    });
}
export function buildSetPoolCreationFeeCall(amount) {
    if (amount < 0n || amount > MAX_UINT256)
        throw new Error("creation fee exceeds uint256");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setPoolCreationFee",
        args: [amount],
    });
}
export function buildSetProtocolPoolFeeRateCall(poolId, feeRate) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setProtocolPoolFeeRate",
        args: [poolId, validatedPoolSwapFeeRate(feeRate)],
    });
}
export function buildSetBasketFeeAllocationCall(allocation) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setBasketFeeAllocation",
        args: [validatedBasketFeeAllocation(allocation)],
    });
}
export function buildSetGeneralFeeAllocationCall(allocation) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "setGeneralFeeAllocation",
        args: [validatedGeneralFeeAllocation(allocation)],
    });
}
export function buildDecommissionGeneralPoolCall(poolId) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "decommissionGeneralPool",
        args: [poolId],
    });
}
export function buildClaimCreatorRevenueCall(asset, receiver, minReceived) {
    if (minReceived < 0n || minReceived > MAX_UINT256)
        throw new Error("minReceived exceeds uint256");
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimCreatorRevenue",
        args: [asset, receiver, minReceived],
    });
}
export function buildReplaceLiquidityManagerCall(newManager) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "replaceLiquidityManager",
        args: [newManager],
    });
}
export function buildClearCanonicalPoolFeeConfigurationCall(basketId, asset) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "clearCanonicalPoolFeeConfiguration",
        args: [basketId, asset],
    });
}
export function buildUnwindBasketLiquidityCall(basketId, asset) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "unwindBasketLiquidity",
        args: [basketId, asset],
    });
}
export function buildBorrowAndProvideLiquidityCall(positionId, basketId, sharesIn, pools, lpRecipient) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "borrowAndProvideLiquidity",
        args: [positionId, basketId, sharesIn, pools, lpRecipient],
    });
}
export function buildBorrowAndStakeLiquidityCall(positionId, basketId, sharesIn, pools) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "borrowAndStakeLiquidity",
        args: [positionId, basketId, sharesIn, pools],
    });
}
export function buildStakeLiquidityPositionCall(positionId, tokenId) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "stakeLiquidityPosition",
        args: [positionId, tokenId],
    });
}
export function buildActivateLiquidityPositionCall(tokenId) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "activateLiquidityPosition",
        args: [tokenId],
    });
}
export function buildIncreaseStakedLiquidityCall(positionId, tokenId, request, refundReceiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "increaseStakedLiquidity",
        args: [positionId, tokenId, request, refundReceiver],
    });
}
export function buildUnstakeLiquidityPositionCall(positionId, tokenId, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "unstakeLiquidityPosition",
        args: [positionId, tokenId, receiver],
    });
}
export function buildClaimLiquidityRewardsCall(positionId, tokenId, receiver, minAmount0, minAmount1) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimLiquidityRewards",
        args: [positionId, tokenId, receiver, minAmount0, minAmount1],
    });
}
export function buildDepositETHTransaction(ethAmount, staticsDollarReceiver, shareReceiver, minStaticsDollar, minShares) {
    return {
        data: encodeFunctionData({
            abi: staticsAbi,
            functionName: "depositETH",
            args: [staticsDollarReceiver, shareReceiver, minStaticsDollar, minShares],
        }),
        value: ethAmount,
    };
}
export function buildDepositWETHCall(wethAmount, staticsDollarReceiver, shareReceiver, minStaticsDollar, minShares) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "depositWETH",
        args: [wethAmount, staticsDollarReceiver, shareReceiver, minStaticsDollar, minShares],
    });
}
export function buildRecombineToWETHCall(seriesId, staticsDollarAmount, maxSharesIn, receiver, minWETHOut) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "recombineToWETH",
        args: [seriesId, staticsDollarAmount, maxSharesIn, receiver, minWETHOut],
    });
}
export function buildRecombineToWETHWithPermitCall(seriesId, staticsDollarAmount, maxSharesIn, receiver, minWETHOut, permitSignature) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "recombineToWETHWithPermit",
        args: [seriesId, staticsDollarAmount, maxSharesIn, receiver, minWETHOut, permitSignature],
    });
}
export function buildRecombineToETHCall(seriesId, staticsDollarAmount, maxSharesIn, receiver, minETHOut) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "recombineToETH",
        args: [seriesId, staticsDollarAmount, maxSharesIn, receiver, minETHOut],
    });
}
export function buildRecombineToETHWithPermitCall(seriesId, staticsDollarAmount, maxSharesIn, receiver, minETHOut, permitSignature) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "recombineToETHWithPermit",
        args: [seriesId, staticsDollarAmount, maxSharesIn, receiver, minETHOut, permitSignature],
    });
}
export function buildMintPeggedCall(profileId, staticsDollarAmount, maximumCollateralIn, staticsDollarReceiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "mintPegged",
        args: [profileId, staticsDollarAmount, maximumCollateralIn, staticsDollarReceiver],
    });
}
export function buildMintPeggedWithPermitCall(profileId, staticsDollarAmount, maximumCollateralIn, staticsDollarReceiver, permitSignature) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "mintPeggedWithPermit",
        args: [
            profileId,
            staticsDollarAmount,
            maximumCollateralIn,
            staticsDollarReceiver,
            permitSignature,
        ],
    });
}
export function buildQuoteMintPeggedAndRecombineCall(peggedProfileId, volatileProfileId, seriesId, riskAmount) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "quoteMintPeggedAndRecombine",
        args: [peggedProfileId, volatileProfileId, seriesId, riskAmount],
    });
}
export function buildMintPeggedAndRecombineCall(peggedProfileId, volatileProfileId, seriesId, riskAmount, maximumPeggedCollateralIn, minimumVolatileCollateralOut, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "mintPeggedAndRecombine",
        args: [
            peggedProfileId,
            volatileProfileId,
            seriesId,
            riskAmount,
            maximumPeggedCollateralIn,
            minimumVolatileCollateralOut,
            receiver,
        ],
    });
}
export function buildMintPeggedAndRecombineWithPermitCall(peggedProfileId, volatileProfileId, seriesId, riskAmount, maximumPeggedCollateralIn, minimumVolatileCollateralOut, receiver, permitSignature) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "mintPeggedAndRecombineWithPermit",
        args: [
            peggedProfileId,
            volatileProfileId,
            seriesId,
            riskAmount,
            maximumPeggedCollateralIn,
            minimumVolatileCollateralOut,
            receiver,
            permitSignature,
        ],
    });
}
export function buildRedeemPeggedCall(profileId, staticsDollarAmount, minimumCollateralOut, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "redeemPegged",
        args: [profileId, staticsDollarAmount, minimumCollateralOut, receiver],
    });
}
export function buildRedeemPeggedWithPermitCall(profileId, staticsDollarAmount, minimumCollateralOut, receiver, permitSignature) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "redeemPeggedWithPermit",
        args: [profileId, staticsDollarAmount, minimumCollateralOut, receiver, permitSignature],
    });
}
export function buildClaimPeggedProtocolRevenueCall(profileId, amount, receiver) {
    return encodeFunctionData({
        abi: staticsAbi,
        functionName: "claimPeggedProtocolRevenue",
        args: [profileId, amount, receiver],
    });
}
export async function planMintUnderlyingRoutes(sourceToken, mintQuote, adapter) {
    return Promise.all(mintQuote.map(async ({ asset, amountIn }) => {
        if (asset.toLowerCase() === sourceToken.toLowerCase()) {
            return { asset, amount: amountIn, sourceOrDestinationAmount: amountIn };
        }
        const route = await adapter.quoteExactOutput({ tokenIn: sourceToken, tokenOut: asset, amountOut: amountIn });
        return { asset, amount: amountIn, sourceOrDestinationAmount: route.maxAmountIn, execution: route.execution };
    }));
}
export async function planRedeemUnderlyingRoutes(destinationToken, redeemQuote, adapter) {
    return Promise.all(redeemQuote.map(async ({ asset, amountOut }) => {
        if (asset.toLowerCase() === destinationToken.toLowerCase()) {
            return { asset, amount: amountOut, sourceOrDestinationAmount: amountOut };
        }
        const route = await adapter.quoteExactInput({ tokenIn: asset, tokenOut: destinationToken, amountIn: amountOut });
        return { asset, amount: amountOut, sourceOrDestinationAmount: route.minAmountOut, execution: route.execution };
    }));
}
