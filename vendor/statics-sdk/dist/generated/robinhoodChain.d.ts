export declare const robinhoodChain: {
    readonly network: "Robinhood Chain";
    readonly chainId: 4663;
    readonly forkBlock: 14498238;
    readonly forkBlockHash: "0x6aa5df55371aa944352e06703b7905fb0ddf3a58c495833ee7595ef08aa46417";
    readonly inputFeeBps: 50;
    readonly outputFeeBps: 50;
    readonly hookPermissionMask: "0x10cc";
    readonly liquidityCalibration: {
        readonly inputFeeBps: 50;
        readonly outputFeeBps: 50;
        readonly hookPermissionMask: "0x10cc";
        readonly canonicalLpFeePips: 0;
        readonly canonicalTickSpacing: 10;
        readonly polShareBps: 1000;
        readonly liquidityProviderShareBps: 2500;
        readonly basketStakerShareBps: 2500;
        readonly staticsStakerShareBps: 1500;
        readonly treasuryShareBps: 2500;
        readonly hookPermissions: readonly ["afterInitialize", "beforeSwap", "beforeSwapReturnDelta", "afterSwap", "afterSwapReturnDelta"];
    };
    readonly contracts: {
        readonly poolManager: {
            readonly address: "0x8366a39CC670B4001A1121B8F6A443A643e40951";
            readonly runtimeCodeHash: "0xbd3881180b547f5fe817545743cfb4343e96b1bc6640dcd70c106b0066e95626";
        };
        readonly positionManager: {
            readonly address: "0x58daec3116aae6D93017bAAea7749052E8a04fA7";
            readonly runtimeCodeHash: "0xc873e135dc9aaec88489cfbad146b4cb49d6a32e0d80326377784b7ba17670b2";
        };
        readonly quoter: {
            readonly address: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94";
            readonly runtimeCodeHash: "0xd707b1da8cb165e5ea35a3b4450d971eb562ec171e23492aa117036b78a868f6";
        };
        readonly stateView: {
            readonly address: "0xF3334192D15450CdD385c8B70e03f9A6bD9E673b";
            readonly runtimeCodeHash: "0x7d9c591e0956fd89d98feb4ffcfe8bf1f7a62bd485edd979fa21d104b49878a6";
        };
        readonly universalRouter: {
            readonly address: "0x8876789976dEcBfCbBbe364623C63652db8C0904";
            readonly runtimeCodeHash: "0x2ce6aaaf9f4151f5e1cbf774668772f17f532ae11b15e9284fd0a072a8b0fbde";
        };
        readonly permit2: {
            readonly address: "0x000000000022D473030F116dDEE9F6B43aC78BA3";
            readonly runtimeCodeHash: "0x5208783f52488f7d3493e5e38311ab707c1d75457fe472a19b0b4d57d66a7fca";
        };
        readonly weth: {
            readonly address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
        };
    };
};
