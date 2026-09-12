# Local validation

Completed with standard Foundry 1.5.1, Solidity 0.8.30, Prague EVM, optimizer 200 runs.

| Check | Result |
| --- | --- |
| `forge build --sizes` | Pass |
| `forge test -vv` | **46 passed, 0 failed, 0 skipped**, across five suites |
| Stateful invariant tests | Four properties, each 128 runs × 64 calls; zero reverts |
| Solidity fuzz tests | 256 runs each for entitlement arithmetic and arbitrary heap add/remove |
| `node scripts/demo.test.mjs` | 3 passed, 0 failed |
| Shell and JavaScript syntax checks | Pass |
| Offline `demo.mjs --amount 10` plan | Pass; no RPC calls |
| Chrome architecture render | Blocked by sandbox socket permissions; PNG not generated |

Vault runtime: **14,301 bytes**; initcode before constructor arguments: **15,090 bytes**.
Runtime margin below EIP-170: **10,275 bytes**. Imported helper libraries are internal/inlined;
no separately deployed or linked library is needed.

## Gas report

Command: `forge test --match-contract CascadeVaultGasTest --gas-report --isolate`.
Fixed 10-USDC principal, EOA recipients, mock six-decimal USDC, one payment bucket, positive funded
yield for claim. The issue row includes successful fixture issuance as well as the benchmark issuance.
These are local EVM measurements, not a quote of Arc transaction fees.

| Function | Minimum | Average | Median | Maximum | Calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| issue | 276,598 | 319,629 | 287,919 | 362,098 | 9 |
| pay (expectedOutstanding overload) | 149,986 | 149,986 | 149,986 | 149,986 | 1 |
| extend | 248,104 | 248,104 | 248,104 | 248,104 | 1 |
| claim | 158,125 | 158,125 | 158,125 | 158,125 | 1 |

The suite covers every vault operation, the 32-bucket boundaries, original/extended yield intervals,
empty intervals, daily checkpoint ordering, rounding, failed token transfers, callback reentrancy,
invoice conservation, retry protection, backing shortfalls, and maturity without maintenance.
The extend → transfer → pay against early M regression reverts while the token remains unmatured.
The complete Apple story settles 40 USDC of invoices using 10 USDC of principal in a local test.

No deployment, live demo, live RPC preflight, or Blockscout submission was run. Arc deployment-guard
tests are offline mocks, not a live integration claim. Positive checkpoint funding, native USDC behavior,
and explorer verification still need the explicitly separate funded deployment run.

The render command uses existing Chrome through Playwright's pipe transport. Desktop Chrome failed
at a crash-handler socket operation, and existing headless Chrome failed at a sandbox-host socket
operation. Both were denied by the outer execution sandbox; neither browser nor a system package
was downloaded. The Mermaid source and render script are present, but browser output is unverified.
