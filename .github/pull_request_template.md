## Summary
<!-- What does this PR change and why? -->

## Testing
<!-- What did you run? If not run, explain why. -->
- [ ] Tests / CI: <!-- e.g. pnpm test, affected packages, etc. -->

## Compliance / downloads (SPICE kernels / CSPICE)
- [ ] This PR does **not** add or change any downloading of SPICE kernels (e.g. LSK/SPK) or CSPICE(-derived) artifacts.
- [ ] If this PR **does** add/change downloads, I’ve explained below why it does **not** change this project’s export/compliance posture or introduce redistributed / export-controlled material (kernels are fetched from NAIF public servers at test/runtime, cached locally, and not committed or shipped).

If downloads changed, please describe:
- What is downloaded (kernel types/artifacts) and from where (URL/source)
- When it happens (test/runtime/CI) and where it is cached locally
- Why this is still limited to **publicly available NAIF generic kernels** fetched from NAIF public servers and **not redistributed** by this repo (not committed, not packaged/shipped)

References:
- `docs/cspice-naif-disclosure.md`
- `THIRD_PARTY_NOTICES.md`
- `packages/backend-node/NOTICE`
- `packages/backend-wasm/NOTICE`
