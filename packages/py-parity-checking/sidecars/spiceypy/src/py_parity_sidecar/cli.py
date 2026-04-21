from __future__ import annotations

import json
import sys
from dataclasses import asdict

import spiceypy as sp

from .decode import decode_case_request
from .handlers import run_workflow
from .models import CaseError, CaseResponse


def _normalize_error(exc: BaseException) -> CaseError:
    return CaseError(type=type(exc).__name__, message=str(exc))


def main() -> int:
    raw = json.load(sys.stdin)
    request = decode_case_request(raw)

    # Ensure CSPICE starts in a clean state for this process.
    try:
        sp.reset()
    except BaseException:
        pass
    try:
        sp.kclear()
    except BaseException:
        pass

    response: CaseResponse
    exit_code = 0

    try:
        outputs = run_workflow(request)
        response = CaseResponse(
            caseId=request.caseId,
            ok=True,
            outputs=outputs,
            error=None,
        )
    except BaseException as exc:
        response = CaseResponse(
            caseId=request.caseId,
            ok=False,
            outputs=[],
            error=_normalize_error(exc),
        )
        exit_code = 1
    finally:
        # CSPICE must be reset after failures before additional toolkit calls.
        try:
            sp.reset()
        except BaseException:
            pass
        try:
            sp.kclear()
        except BaseException:
            pass

    json.dump(asdict(response), sys.stdout)
    sys.stdout.write("\n")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
