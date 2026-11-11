# CSPICE routine planning

The former proposed-domain list is retired because it duplicated the routine inventory and continued to label already implemented routines as planned.

Use the [generated CSPICE function inventory](./cspice-function-inventory.md) for current implemented, planned, and excluded routines. Its canonical input is [`data/cspice-functions.json`](../data/cspice-functions.json), reconciled with the backend contract by:

```bash
node scripts/generate-cspice-inventory.mjs
```

Derive new implementation batches from that current inventory and actual routine dependencies. The [reset and coverage plan](./project-reset-and-coverage-plan.md) describes the completion requirements and suggested dependency waves. Backend support and meaningful parity coverage need their own evidence; inventory membership alone does not establish them.
