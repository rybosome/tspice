from __future__ import annotations

import json
import sys
from dataclasses import asdict

from .decode import decode_case_request
from .handlers import run_workflow
from .models import CaseError, CaseResponse
from .runtime import (
    before_case_lifecycle,
    create_default_runtime_paths,
    create_runtime_context,
    finalize_case_lifecycle,
)


def _normalize_error(exc: BaseException) -> CaseError:
    return CaseError(type=type(exc).__name__, message=str(exc))


def main() -> int:
    raw = json.load(sys.stdin)
    request = decode_case_request(raw)

    runtime_paths = request.runtime.paths if request.runtime is not None else create_default_runtime_paths(request.caseId)
    context = create_runtime_context(runtime_paths)

    before_case_lifecycle()

    response: CaseResponse
    exit_code = 0

    try:
        outputs = run_workflow(request, context)
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
        finalize_case_lifecycle(context)

    json.dump(asdict(response), sys.stdout)
    sys.stdout.write("\n")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
