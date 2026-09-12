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
