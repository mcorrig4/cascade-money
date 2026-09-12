# Cascade: dated dollars on Arc

Solid arrows show the implemented vault path. Dashed arrows identify separate demo/reference components.
The discount window is participant-funded; it never draws on vault reserve. Dates are ERC-1155 IDs,
not separately deployed contracts. The reference implementation feeds the front end independently
of the Solidity build and test suite.

```mermaid
flowchart LR
    APPLE["Debtor / Apple"] -->|"issue: deposit USDC"| USDC
    subgraph ARC["Arc · EVM · USDC gas"]
        USDC["USDC · 6-decimal ERC-20 interface"] --> VAULT
        VAULT["CascadeVault<br/>USDC custody · invoices · backing check"]
        VAULT -->|"issue / claim mint"| DATES["Date mints · ERC-1155<br/>ID = UTC epoch day"]
        DATES -->|"pay / transfer<br/>original date retained"| PAYEE["Creditor / next supplier"]
        DATES --> EXTEND["Extend<br/>burn T1 · mint T2 > T1"]
        EXTEND --> DATES
        VAULT --> LEDGER["Entitlement ledger<br/>account · amount · S · E · claimed"]
        EXTEND -->|"assign added interval"| LEDGER
        OWNER["Checkpoint owner<br/>funds demo yield via allowance"] -->|"checkpoint: publish I(d)"| VAULT
        LEDGER -->|"claim → today-dated spot"| DATES
        DATES -->|"ID ≤ today: spot<br/>withdraw burns matching liability"| VAULT
        VAULT -->|"withdraw USDC"| HOLDER["Holder"]
        DATES -.->|"principal only; entitlement stays"| WINDOW["Separate discount window<br/>participant-funded · outside vault scope"]
    end
    VAULT -->|"events · balances · explorer receipts"| FRONTEND["Cascade front end"]
    WINDOW -.->|"prices / yield curve · shot 7"| FRONTEND
    REF["Independent Python reference implementation<br/>loss waterfall · stress scenarios · event stream"] -.-> FRONTEND
    LOCAL["Foundry tests<br/>UTC time warp · invariant sequences"] -.->|"maturity / claims evidence"| FRONTEND
```

Shot 5 uses real extension events and entitlement intervals. Shot 7 needs the separate discount
window/reference price feed. Shot 9's accelerated maturity and loss stress are labeled reference
or local Foundry runs; public testnet time is never accelerated. Shot 11 uses the PNG rendered
from this Mermaid block by `contracts/scripts/render-architecture.mjs`.
