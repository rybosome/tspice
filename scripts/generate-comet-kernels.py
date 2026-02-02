#!/usr/bin/env python3
"""Generate SPICE SPK kernels for a curated set of comets.

This script exists because `@rybosome/tspice` currently focuses on *reading*
SPICE kernels (WASM + native) and does not yet expose SPK writer routines
(`spkopn`, `spkw08/09`, `spkcls`).

As a pragmatic fallback, we generate the viewer's comet kernels using the
SPICE Toolkit via SpiceyPy (Python bindings).

Data source: JPL Horizons API (vectors table).
API: https://ssd.jpl.nasa.gov/api/horizons.api

Default coverage matches the viewer's other baseline kernels: 1950-01-01 .. 2050-01-01.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Iterable, List, Tuple

JD_J2000 = 2451545.0
DAY_SEC = 86400.0


@dataclass(frozen=True)
class CometSpec:
    label: str
    designation: str


COMETS: Tuple[CometSpec, ...] = (
    CometSpec("1P/Halley", "1P"),
    CometSpec("2P/Encke", "2P"),
    CometSpec("9P/Tempel 1", "9P"),
    CometSpec("10P/Tempel 2", "10P"),
    CometSpec("12P/Pons-Brooks", "12P"),
    CometSpec("17P/Holmes", "17P"),
    CometSpec("19P/Borrelly", "19P"),
    CometSpec("21P/Giacobini-Zinner", "21P"),
    CometSpec("45P/Honda–Mrkos–Pajdušáková", "45P"),
    CometSpec("46P/Wirtanen", "46P"),
    CometSpec("55P/Tempel-Tuttle", "55P"),
    CometSpec("67P/Churyumov–Gerasimenko", "67P"),
    CometSpec("73P/Schwassmann–Wachmann 3", "73P"),
    CometSpec("81P/Wild 2", "81P"),
    CometSpec("96P/Machholz 1", "96P"),
    CometSpec("103P/Hartley 2", "103P"),
    CometSpec("C/1995 O1 (Hale–Bopp)", "C/1995 O1"),
    CometSpec("C/1996 B2 (Hyakutake)", "C/1996 B2"),
    CometSpec("C/2006 P1 (McNaught)", "C/2006 P1"),
    CometSpec("C/2020 F3 (NEOWISE)", "C/2020 F3"),
)


def _fetch_horizons_result_text(*, designation: str, start_utc: str, stop_utc: str, step_size: str) -> str:
    # Notes:
    # - We quote the COMMAND value so Horizons accepts spaces/slashes in designations.
    # - We let urlencode percent-encode '=' and ';' per Horizons' recommendations.
    # Horizons is picky about whitespace in some fields (notably STEP_SIZE).
    # Use single quotes to keep the API from treating `5 d` as multiple tokens.
    def q(v: str) -> str:
        v = str(v)
        if v.startswith("'") and v.endswith("'"):
            return v
        return f"'{v}'"

    params = {
        "format": "json",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "VECTORS",
        "CENTER": "500@10",  # Sun
        "OUT_UNITS": "KM-S",
        "VEC_TABLE": "2",
        "CSV_FORMAT": "YES",
        "OBJ_DATA": "YES",
        "STEP_SIZE": q(step_size),
        "START_TIME": q(start_utc),
        "STOP_TIME": q(stop_utc),
        "COMMAND": f"'DES={designation};CAP;NOFRAG'",
    }

    query = urllib.parse.urlencode(params)
    url = f"https://ssd.jpl.nasa.gov/api/horizons.api?{query}"

    with urllib.request.urlopen(url) as resp:
        raw = resp.read().decode("utf-8")

    payload = json.loads(raw)

    if "result" not in payload:
        raise RuntimeError(f"Unexpected Horizons response (missing result): keys={list(payload.keys())}")

    return str(payload["result"])


def _parse_horizons_vectors(result_text: str) -> Tuple[int, List[float], List[List[float]]]:
    # Determine a stable numeric ID for the target.
    #
    # Horizons sometimes includes a NAIF ID in the Target-body header, but for
    # comets the API frequently omits it and only provides a Horizons record
    # number ("Rec #:9000....").
    #
    # For our generated kernels, the ID only needs to be stable + consistent
    # between the kernel segment body IDs and the viewer's BodyRegistry.
    m = re.search(r"^\s*Target body name:\s*.*\(([-0-9]+)\)\s*$", result_text, re.MULTILINE)
    if m:
        naif_id = int(m.group(1))
    else:
        m2 = re.search(r"^\s*Rec #:(\d+)\b", result_text, re.MULTILINE)
        if not m2:
            raise RuntimeError(
                "Failed to parse comet numeric ID from Horizons result (expected 'Target body name: ... (ID)' or 'Rec #:<id>')"
            )
        naif_id = int(m2.group(1))

    # Extract vector rows between $$SOE/$$EOE.
    start = result_text.find("$$SOE")
    end = result_text.find("$$EOE")
    if start == -1 or end == -1 or end <= start:
        raise RuntimeError("Failed to locate $$SOE/$$EOE block in Horizons result")

    block = result_text[start + len("$$SOE") : end]
    epochs_et: List[float] = []
    states: List[List[float]] = []

    for raw_line in block.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # CSV_FORMAT=YES gives comma-separated values. We extract the numeric columns.
        parts = [p.strip() for p in line.split(",")]
        nums: List[float] = []
        for p in parts:
            try:
                v = float(p)
            except ValueError:
                continue
            if v != v:  # NaN
                continue
            nums.append(v)

        # Expected numeric columns: [JDTDB, X, Y, Z, VX, VY, VZ]
        if len(nums) < 7:
            raise RuntimeError(f"Unexpected vector row format (expected >=7 numeric columns): {line}")

        jd = nums[0]
        vec = nums[1:7]

        et = (jd - JD_J2000) * DAY_SEC
        epochs_et.append(et)
        states.append(vec)

    if len(epochs_et) < 4:
        raise RuntimeError(f"Too few ephemeris rows parsed: n={len(epochs_et)}")

    return naif_id, epochs_et, states


def _chunked(items: List[CometSpec], size: int) -> Iterable[List[CometSpec]]:
    if size <= 0:
        yield items
        return
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _mk_segid(label: str, designation: str, naif_id: int) -> str:
    # Segment IDs must be <= 40 chars.
    base = f"COMET {designation} ({naif_id})"
    if len(base) <= 40:
        return base
    # Fallback: shorten.
    base = f"COMET {designation}".replace(" ", "")
    return base[:40]


def generate_kernels(*, start_utc: str, stop_utc: str, step_size: str, out_dir: str, file_prefix: str, max_comets_per_kernel: int) -> None:
    try:
        import numpy as np  # type: ignore
        import spiceypy as sp  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "Missing Python deps for SPK writing. Install with: python3 -m pip install --user spiceypy numpy"
        ) from e

    os.makedirs(out_dir, exist_ok=True)

    all_mappings = []
    parts = list(_chunked(list(COMETS), max_comets_per_kernel))

    for part_index, group in enumerate(parts, start=1):
        suffix = f"-part{part_index}" if len(parts) > 1 else ""
        out_path = os.path.join(out_dir, f"{file_prefix}{suffix}.bsp")

        # SPKCLS errors if no segments exist. Fetch/parse upfront so we only
        # create a kernel file when we know we can write at least one segment.
        fetched: List[Tuple[CometSpec, int, "np.ndarray", "np.ndarray"]] = []
        for comet in group:
            txt = _fetch_horizons_result_text(
                designation=comet.designation,
                start_utc=start_utc,
                stop_utc=stop_utc,
                step_size=step_size,
            )
            naif_id, epochs_et, states = _parse_horizons_vectors(txt)

            epochs = np.asarray(epochs_et, dtype=np.float64)
            st = np.asarray(states, dtype=np.float64)
            if st.ndim != 2 or st.shape[1] != 6:
                raise RuntimeError(f"Unexpected states array shape for {comet.label}: {st.shape}")
            fetched.append((comet, naif_id, epochs, st))

        if len(fetched) == 0:
            raise RuntimeError("No comets in kernel group")

        # Open SPK for write.
        handle = sp.spkopn(out_path, "TSPICE COMETS", 0)
        segments_written = 0
        try:
            for comet, naif_id, epochs, st in fetched:
                first = float(epochs[0])
                last = float(epochs[-1])

                segid = _mk_segid(comet.label, comet.designation, naif_id)

                # Type 9 (Lagrange interpolation), uneven spacing supported.
                # Degree is a tradeoff: higher degree smooths but can overshoot.
                degree = 3

                sp.spkw09(
                    handle,
                    naif_id,  # body
                    10,  # center = Sun
                    "J2000",
                    first,
                    last,
                    segid,
                    degree,
                    int(epochs.shape[0]),
                    st,
                    epochs,
                )
                segments_written += 1

                all_mappings.append(
                    {
                        "label": comet.label,
                        "designation": comet.designation,
                        "naifId": naif_id,
                        "kernel": os.path.basename(out_path),
                        "rows": int(epochs.shape[0]),
                    }
                )
        finally:
            # `spkcls` errors if no segments exist, so fall back to the
            # generic DAF close for early failures.
            if segments_written > 0:
                sp.spkcls(handle)
            else:
                sp.dafcls(handle)

        size_bytes = os.path.getsize(out_path)
        print(f"Wrote {out_path} ({size_bytes / (1024 * 1024):.2f} MB)")

    # Emit mapping summary to stdout (useful for updating viewer registry).
    print("\nNAIF mapping summary (copy/paste into viewer):")
    print(json.dumps(all_mappings, indent=2, sort_keys=True))


def main(argv: List[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--start-utc", default="1950-01-01", help="Start UTC (default: 1950-01-01)")
    p.add_argument("--stop-utc", default="2050-01-01", help="Stop UTC (default: 2050-01-01)")
    p.add_argument("--step-size", default="5 d", help="Horizons step size (default: '5 d')")
    p.add_argument(
        "--out-dir",
        default=os.path.join("apps", "tspice-viewer", "public", "kernels", "comets"),
        help="Output directory for .bsp files",
    )
    p.add_argument("--file-prefix", default="comets_1950_2050_step5d", help="Output filename prefix (no extension)")
    p.add_argument(
        "--max-comets-per-kernel",
        type=int,
        default=0,
        help="If >0, split kernels to keep file sizes down (default: 0 = all comets in one kernel)",
    )

    args = p.parse_args(argv)

    generate_kernels(
        start_utc=args.start_utc,
        stop_utc=args.stop_utc,
        step_size=args.step_size,
        out_dir=args.out_dir,
        file_prefix=args.file_prefix,
        max_comets_per_kernel=args.max_comets_per_kernel,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
