import { getAddress } from "viem";
import { describe, expect, it } from "vitest";

import {
  parseIndexedManagedLiquidity,
  parseIndexedPositions,
  parseIndexedPublicPools,
  parsePhaseOneCandles,
  parseGaugeReserve,
  parsePhaseOneProtocolActivity,
} from "@/lib/indexer/phase-one";

const address = (byte: string) => `0x${byte.repeat(40)}`;
const hash = (byte: string) => `0x${byte.repeat(64)}`;

describe("Phase 1 indexed read models", () => {
  it("parses deployment-scoped public PoolKeys without losing bigint precision", () => {
    const result = parseIndexedPublicPools(
      {
        deploymentId: "phase-one",
        indexedAtBlock: "9007199254740993",
        items: [
          {
            poolId: hash("1"),
            creator: address("1"),
            poolKey: {
              currency0: address("2"),
              currency1: address("3"),
              fee: 3_000,
              tickSpacing: 60,
              hooks: address("4"),
            },
            initialSqrtPriceX96: "79228162514264337593543950336",
            initialTick: 0,
            inputFeePips: 5,
            outputFeePips: 5,
            feeRateOverridden: false,
            quarantined: false,
            rewardRestrictions: { token0: false, token1: true },
            decommissioned: false,
            polActivated: true,
            createdAtBlock: "100",
            updatedAtBlock: "101",
          },
        ],
      },
      "phase-one"
    );
    expect(result.indexedAtBlock).toBe(9_007_199_254_740_993n);
    expect(result.items[0]?.initialSqrtPriceX96).toBe(2n ** 96n);
    expect(result.items[0]?.poolKey.tickSpacing).toBe(60);
    expect(result.items[0]?.rewardRestrictions.token1).toBe(true);
  });

  it("parses deployment-scoped MarketTape candles", () => {
    const result = parsePhaseOneCandles(
      {
        deploymentId: "phase-one",
        poolId: hash("1"),
        indexedAtBlock: "101",
        resolution: 5,
        items: [
          {
            timestamp: "60",
            openSqrtPriceX96: "10",
            highSqrtPriceX96: "12",
            lowSqrtPriceX96: "9",
            closeSqrtPriceX96: "11",
            volume0: "100",
            volume1: "200",
            zeroForOneCount: 1,
            oneForZeroCount: 2,
            swapCount: 3,
            firstBlock: "99",
            lastBlock: "101",
          },
        ],
      },
      "phase-one"
    );
    expect(result.poolId).toBe(hash("1"));
    expect(result.items[0]?.volume1).toBe(200n);
    expect(result.items[0]?.swapCount).toBe(3);
  });

  it("rejects cross-deployment and malformed position responses", () => {
    expect(() =>
      parseIndexedPositions({ deploymentId: "other", indexedAtBlock: "1", items: [] }, "phase-one")
    ).toThrow("different deployment");
    expect(() =>
      parseIndexedPositions(
        {
          deploymentId: "phase-one",
          indexedAtBlock: "1",
          items: [
            {
              positionId: "1",
              owner: "bad",
              stakedBalance: "0",
              activeLegCount: "0",
              unresolvedObligationCount: "0",
              updatedAtBlock: "1",
            },
          ],
        },
        "phase-one"
      )
    ).toThrow("position owner");
  });
  it("discovers managed liquidity with owner, deployment and position isolation", () => {
    const response = {
      deploymentId: "phase-one",
      position: { positionId: "34", owner: address("1") },
      managedLiquidity: [
        {
          poolId: hash("2"),
          posmTokenId: "9007199254740993",
          tickLower: -60,
          tickUpper: 60,
          liquidity: "12345678901234567890",
          active: true,
        },
      ],
    };
    const owner = getAddress(address("1"));
    expect(parseIndexedManagedLiquidity(response, 34n, "phase-one", owner)[0]).toMatchObject({
      positionId: 34n,
      posmTokenId: 9007199254740993n,
      liquidity: 12345678901234567890n,
      tickLower: -60,
    });
    expect(
      parseIndexedManagedLiquidity(response, 34n, "phase-one", getAddress(address("3")))
    ).toEqual([]);
    expect(() => parseIndexedManagedLiquidity(response, 35n, "phase-one", owner)).toThrow(
      "different position"
    );
    expect(() => parseIndexedManagedLiquidity(response, 34n, "other", owner)).toThrow(
      "different deployment"
    );
  });
});

describe("protocol overview indexer responses", () => {
  const event = {
    kind: "global-reward-claimed",
    positionId: "9007199254740993",
    poolId: null,
    asset: address("1"),
    amount: "1234567890123456789",
    actor: address("2"),
    transactionHash: hash("3"),
    blockNumber: "42",
    blockTimestamp: "100",
    logIndex: 0,
  };
  it("accepts empty activity and retains exact event amounts and nullable fields", () => {
    expect(
      parsePhaseOneProtocolActivity(
        { deploymentId: "local", indexedAtBlock: null, items: [] },
        "local"
      )
    ).toEqual([]);
    const [row] = parsePhaseOneProtocolActivity({ deploymentId: "local", items: [event] }, "local");
    expect(row?.amount).toBe(1234567890123456789n);
    expect(row?.positionId).toBe(9007199254740993n);
    expect(row?.poolId).toBeNull();
    expect(() =>
      parsePhaseOneProtocolActivity({ deploymentId: "other", items: [event] }, "local")
    ).toThrow(/different deployment/);
    expect(() =>
      parsePhaseOneProtocolActivity(
        { deploymentId: "local", items: [{ ...event, amount: "-1" }] },
        "local"
      )
    ).toThrow(/activity amount/);
  });
  it("parses a missing or populated reserve, rejecting malformed stream times", () => {
    const empty = { deploymentId: "local", reserve: null, rewardSlots: [] };
    expect(parseGaugeReserve(empty, "local")).toEqual({ reserve: null, streamFinishes: [] });
    const reserve = {
      activated: true,
      available: "1234567890123456789",
      deferred: "2",
      committed: "3",
      periodBudget: "4",
      periodFinish: "604800",
    };
    expect(
      parseGaugeReserve({ ...empty, reserve, rewardSlots: [{ periodFinish: "1000" }] }, "local")
    ).toMatchObject({
      reserve: { available: 1234567890123456789n, committed: 3n },
      streamFinishes: [1000n],
    });
    expect(() => parseGaugeReserve({ ...empty, deploymentId: "other" }, "local")).toThrow(
      /different deployment/
    );
    expect(() =>
      parseGaugeReserve({ ...empty, rewardSlots: [{ periodFinish: -1 }] }, "local")
    ).toThrow(/stream finish/);
  });
});
