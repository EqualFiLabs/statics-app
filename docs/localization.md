# Localization

Statics owns its translations in this repository. The site does not send product
copy, wallet data, or protocol state to an automated translation service.

## Supported locales

| Locale             | Catalog               | Review status                                             |
| ------------------ | --------------------- | --------------------------------------------------------- |
| English            | `messages/en.json`    | Source copy                                               |
| Spanish            | `messages/es.json`    | Maintainer-drafted; native review required before mainnet |
| Simplified Chinese | `messages/zh-CN.json` | Maintainer-drafted; native review required before mainnet |

The `statics-locale` preference cookie wins over the browser's
`Accept-Language` header. Without a preference, the server selects the best
supported browser language and falls back to English. Traditional Chinese
preferences do not silently select Simplified Chinese.

Locale changes use the existing URL. They do not add a locale path prefix or
reset wallet/application state.

## Protected terminology

Keep these names unchanged in every language:

- Statics, Statics Protocol, Statics Diamond
- Statics Dollar, USDstx, STATICS, ethLEV
- BasketToken, PositionNFT, USDG, WETH
- Uniswap v4, Across, Jupiter, Robinhood Chain
- contract addresses, transaction hashes, token symbols, and error payloads

Translate the explanation around a term, not the identifier itself. Raw wallet,
RPC, API, simulation, and contract-revert diagnostics remain intact so support
and engineering can match the exact failure.

## Adding or changing copy

1. Add the English source message to `messages/en.json`.
2. Add the same key and interpolation variables to every other catalog.
3. Use `useTranslations` in client components or `getTranslations` in server
   components. Do not embed a translation provider in a wallet or transaction
   utility.
4. Use `useAppLocale` with `parseLocalizedUnits` for decimal inputs, and
   `useFormatter` for dates and human-readable numbers.
5. Run `npm test -- test/i18n`, the focused component tests for the changed
   surface, and `npm run typecheck`.
6. Obtain native-speaker review before describing a non-English catalog as
   production-final.

`test/i18n/catalogs.test.ts` requires identical catalog structure and
interpolation variables. `test/i18n/amounts.test.ts` protects value-moving
decimal parsing across supported locales.

## Adding a locale

Add the locale to `supportedLocales` and `localeLabels` in `i18n/config.ts`,
create its complete catalog, define its browser-language matching rules, and
extend the negotiation, catalog, input, and browser tests. Do not map one
written variant to another unless the catalog was deliberately reviewed for
that variant.
