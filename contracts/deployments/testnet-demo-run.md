# Cascade vault — Arc testnet deployment and demo run

Chain: Arc testnet (chain id `5042002`), RPC `https://rpc.testnet.arc.io`, explorer `https://testnet.arcscan.app`.
USDC: `0x3600000000000000000000000000000000000000` (6 decimals; native and ERC-20 USDC are one balance).

## Deployment

- Vault address: `0x57838A35f05a43aD519204D7A6Ce63F52d7C1987`
- Checkpoint owner / deployer: `0x9C2069b5b510E548963E98474CA08F72E26Fe3f4`
- Deployment tx: https://testnet.arcscan.app/tx/0xeec1fa5a6c47902e2a10b953f809262f52b2759eb88642e14622a7d2204b275e
- Block: 61711424
- Compiler: 0.8.30, EVM `prague`, optimizer runs 200
- Source revision: `6f4413300087f045303e931a727b8718747df1fc`
- Artifact SHA-256: `cf84157d5f7585589a95070374096c17f5f3be1f65e5e93568305f4479df10aa`

## Verification

- Status: Verified (Blockscout, "Pass - Verified")
- Explorer (verified source): https://testnet.arcscan.app/address/0x57838a35f05a43ad519204d7a6ce63f52d7c1987#code

## Demo story (10 USDC principal, four invoices totaling 40 USDC)

Apple → Foxconn → TSMC → Corning at day+90; Corning extends to day+120 and pays the glass supplier.

Actor addresses (testnet-only, generated for this run):

- Apple: `0x4A06663381bBee7Fe7fD4aF86C3B13ac51dAEe91`
- Foxconn: `0xA3CB8560a162Aae9eF7E8083BA42E0fdb984F56b`
- TSMC: `0x33Bd599E985dA5B1ea6C37B9d269Cb60Cc106A12`
- Corning: `0xDfe6dAB7944ba2be53eC9eAA18bAff246829775F`
- Glass supplier: `0x9610Fe61dFa03A3A8e4b1e8256d15dA5c9648f16`

### Transactions (in order)

| # | Step | Tx link |
|---|------|---------|
| 1 | Gas funding Apple | https://testnet.arcscan.app/tx/0x340778307387a8a1166a450d7ef03f3a133af2c135dacdce2808b80d2a7f940b |
| 2 | Gas funding Foxconn | https://testnet.arcscan.app/tx/0xbc679225f2c55ff62e2b575a4c8c601c43f157ded361fce930f2afa8a7ec4146 |
| 3 | Gas funding TSMC | https://testnet.arcscan.app/tx/0xdd11b8e065943a0aa75f3fd8293de946e00d6a4e951778be782705165e838289 |
| 4 | Gas funding Corning | https://testnet.arcscan.app/tx/0x179c2c6317a3eded42266ced87813d5cbf2d7d9689806980b664977792d5f497 |
| 5 | Gas funding Glass supplier | https://testnet.arcscan.app/tx/0x9e17ecde8c66ddfbee87cd4975eeea9e779fe3db840847e19494460b3fa8a891 |
| 6 | Principal funding Apple (10 USDC) | https://testnet.arcscan.app/tx/0x1cee0ca01e7dd43145c0054c141c7e5850d283987cbeea23546e1b1464b5f550 |
| 7 | Apple approves vault (10 USDC) | https://testnet.arcscan.app/tx/0x838828e20eb4e437e97a9b35e07ee937cb0c67c16ec3c8e75b52868d79d62880 |
| 8 | Foxconn registers invoice | https://testnet.arcscan.app/tx/0x6aa880f17608748d4f42823004507e520d110738c00d67f51935fa4ba4d6ad0d |
| 9 | TSMC registers invoice | https://testnet.arcscan.app/tx/0x169d9702675335a09adc307bf51ccb25b8f789f55bdd05f00a8fad5190ce20c6 |
| 10 | Corning registers invoice | https://testnet.arcscan.app/tx/0xa301e3ce6412b2a276177e348570a5fec42b6d74d13e7ffee15638109ac95162 |
| 11 | Glass supplier registers invoice | https://testnet.arcscan.app/tx/0x5c272ef37c1490a6e318b443626fa09ac6dc2d7de5859fccbdfcdc4e140b49a0 |
| 12 | Apple issues to Foxconn | https://testnet.arcscan.app/tx/0x70fa7b0e7a2f77dd51c8e23f41919e4e909c5f54230b4b590db8bf2017f6ef2c |
| 13 | Foxconn pays TSMC | https://testnet.arcscan.app/tx/0x7d95fb4b18b0b0ae616c665408cab1304606219b3e675abe71426123df3d1619 |
| 14 | TSMC pays Corning | https://testnet.arcscan.app/tx/0xb43e2d93ca18c142c1e252910c80f5eebbadd7d7598e282c078687461283542c |
| 15 | Corning extends +90 to +120 | https://testnet.arcscan.app/tx/0x76128b8bd8775bc693248770e7250b4bda0a66e50026a9bcffbfcf94e1ec8ff7 |
| 16 | Corning pays glass supplier | https://testnet.arcscan.app/tx/0xc7ab543c8b736e254b37516c74e566502721af1f68de6ca36b51028b84660b46 |

Steps 8-16 were executed as a resumed continuation of the same funded/approved on-chain state
after step 7 hit a transient RPC `502 Bad Gateway`; no funds beyond the original plan were spent.
Full JSON manifests: `deployments/demo-5042002-1789207039198.json` (steps 1-7) and
`deployments/demo-5042002-resume-1789207225619.json` (steps 1-16, restated).

### Result

Settled 40.0 USDC across four invoices using 10.0 USDC principal. Final balance-sheet check
(`deficit == 0`) and final principal balance passed on-chain.

## Deployer balances after the run

- Native (gas) USDC: 9.425783368 USDC (started at 20)
- ERC-20 USDC: 9.425783 USDC (started at 20)

Native and ERC-20 balances move together on Arc testnet (one underlying balance at 18 vs 6
decimals); the ~10.57 USDC spent covered the 10 USDC principal transfer, 0.5 USDC in actor gas
funding (5 × 0.1), and transaction fees for deployment plus the demo's initial 7 transactions.

## Run 2 — 2026-09-12 — vault `0x4E7D5b438d38b93b811F7f847613100023d7DafE`

Redeployed from current `main` (source revision `b177dda9c0ae61d5925dc774aad4d632ed1080a6`) so the
vault, its `uri()` metadata, demo actors and receipts all reflect the same source. The demo story on
current `main` renamed the supply chain: Apple → Samsung Display (folding OLED panels) → Corning
(ultra-thin cover glass) → Silica supplier (silica feedstock), which extends and pays Freight
carrier (freight) at day+120.

### Deployment

- Vault address: `0x4E7D5b438d38b93b811F7f847613100023d7DafE`
- Checkpoint owner / deployer: `0x9C2069b5b510E548963E98474CA08F72E26Fe3f4`
- Deployment tx: https://testnet.arcscan.app/tx/0x5eddc93f8088e2262d420e184f2347c87b21cd0fcdc0d928fd95ac842811527f
- Block: 61837510
- Compiler: 0.8.30, EVM `prague`, optimizer runs 200
- Source revision: `b177dda9c0ae61d5925dc774aad4d632ed1080a6`
- Artifact SHA-256: `d4c08e78cef57fc829c934a35643f91ff04a8622d2f220293fc0e90e8806fff2`
- Verification: Verified (Blockscout, "Pass - Verified") — https://testnet.arcscan.app/address/0x4e7d5b438d38b93b811f7f847613100023d7dafe#code

### Live metadata check

`uri(today)` and `uri(today+30)` were read directly off the new vault before the demo ran:

- `uri(today)` → name `"USD spot"`, description `"Cascade dated dollar. Maturity: 2026-09-13 (UTC)."`
- `uri(today+30)` → name `"USD+30"`, description `"Cascade dated dollar. Maturity: 2026-10-13 (UTC)."`

Both returned non-empty `data:application/json;base64,...` URIs with a nested base64 SVG image.

### Demo story (10 USDC principal, four invoices totaling 40 USDC)

Actor addresses (testnet-only, generated for this run):

- Apple: `0xbbaDACbfbd9A513f0aE1f1d6A780154D1bF1d684`
- Samsung Display: `0xC219C4C0FC9Daa0906b5bE33154CED051e273D8B`
- Corning: `0xEb8678dC23E979Eb7D5b96ebf0774b60CD89B351`
- Silica supplier: `0xaCA76f0D109E848ed80E55b37116Abd4c64C04b7`
- Freight carrier: `0xF9d828799C7724638D3bA8ecdFF7D99DD1811F71`

### Transactions (in order)

| # | Step | Tx link |
|---|------|---------|
| 1 | Gas funding Apple | https://testnet.arcscan.app/tx/0x94dcfa7a4d6c40175dc2b0e69dda6b672ea608d8dd9f1bae1ee4ebd0f6c24aef |
| 2 | Gas funding Samsung Display | https://testnet.arcscan.app/tx/0xd75ad59ea3e3d02eec3400b62184bea41cac399a4023fad304819d82daa63cd9 |
| 3 | Gas funding Corning | https://testnet.arcscan.app/tx/0xffc12bf1763264a6d2c6252e77c08d809549d02d7b640bbe2c8efaf3cea39012 |
| 4 | Gas funding Silica supplier | https://testnet.arcscan.app/tx/0x186f00f3aa9218709dd72bbc2a67132a78c14aa993028bea11ea42945c504195 |
| 5 | Gas funding Freight carrier | https://testnet.arcscan.app/tx/0x71a05a8916815eb7ed1153469760ab21d7864706cf18005ef02ee1a436bd85ff |
| 6 | Principal funding Apple (10 USDC) | https://testnet.arcscan.app/tx/0x0324aa6f5b2c6961632e6870163efd335c59b909d5b0f3df6964c2dcd17ab147 |
| 7 | Apple approves vault (10 USDC) | https://testnet.arcscan.app/tx/0x69dc27e09389b5338963328da9842618126fb9e238ff8eb992d2bc37444d7278 |
| 8 | Samsung Display registers invoice: folding OLED panels | https://testnet.arcscan.app/tx/0x11db70573c8cd96cf1d2a902094d655d12abc414245e74e81815c97e4f3db61b |
| 9 | Corning registers invoice: ultra-thin cover glass | https://testnet.arcscan.app/tx/0xb162056429b5e6ba89a8aebb7f4777e49f322e9a56e8431a40bb1af9036f452a |
| 10 | Silica supplier registers invoice: silica feedstock | https://testnet.arcscan.app/tx/0xe305c7bffbaf00def1550a4eaf885cc4900db35cde80c2a719da744e6a04c84a |
| 11 | Freight carrier registers invoice: freight | https://testnet.arcscan.app/tx/0x41d2de16b32fa3b3abbdf82ed26c99d5f3c3446556a8647037d0d3e321172b92 |
| 12 | Apple issues to Samsung Display | https://testnet.arcscan.app/tx/0xddb123f602e2f1fa4ada0f28e475c36d1b5af9c1b0c2bde64c75cbdf2b2ef6b6 |
| 13 | Samsung Display pays Corning | https://testnet.arcscan.app/tx/0xc6e86f75cbfecbfdf1bd0699384ef3a8a8bbd882b8969136d121f66a4bbfdcd9 |
| 14 | Corning pays Silica supplier | https://testnet.arcscan.app/tx/0x3fa20bb3082861f4eed5c1ada2e94e6b4edbbe9a2c0d53b556245d4ee2cd2047 |
| 15 | Silica supplier extends +90 to +120 | https://testnet.arcscan.app/tx/0xf79dd29e18d2d70e5c6c3382459105d2937e66e685df2fb47e589033463d891f |
| 16 | Silica supplier pays Freight carrier | https://testnet.arcscan.app/tx/0xb164443044cbc0be3b1acb6b8f004e25aa5407960f9a141f15f94fd8edce0369 |

Ran end-to-end in one pass (no resume needed). Full JSON manifest:
`deployments/demo-5042002-1789271683695.json`.

### Result

Settled 40.0 USDC across four invoices using 10.0 USDC principal. Final balance-sheet check
(`deficit == 0`) and final principal balance passed on-chain: `balanceSheet()` returned
backing `10000000`, principal `10000000`, accrued `0`, reserve `0`, deficit `0`.

### Faucet top-up before this run

The deployer's balance from Run 1 (9.425783 USDC-equivalent) was short of the ~10.7 USDC needed
for a fresh deploy + 10 USDC-principal demo. Topped up with one Circle testnet faucet request
(20 USDC) to `0x9C2069b5b510E548963E98474CA08F72E26Fe3f4`, bringing the balance to 29.425783368
before this run.

## Deployer balances after Run 2

- Native (gas) USDC: 18.792706293 USDC
- ERC-20 USDC: 18.792706 USDC

The ~10.633 USDC spent covered contract deployment + verification, the 10 USDC principal
transfer, 0.5 USDC in actor gas funding (5 × 0.1), and transaction fees for all 16 demo steps.
