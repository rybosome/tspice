"""Read/write an independent N0067 subset for cross-runtime file tests."""
import json
import math
import sys

import spiceypy as sp


def report(path):
    handle = sp.spklef(path)
    try:
        actual, descr, ident = sp.spksfs(-100011, 1, 41)
        assert actual == handle
        fields = sp.spkuds(descr)
        states = []
        for t in [-5.0, 0.125, 10.0]:
            ref, state, center = sp.spkpvn(handle, descr, t)
            states.append(dict(ref=ref, state=state.tolist(), center=center))
        r = sp.dafopr(path)
        try:
            sp.dafbfs(r)
            summaries = []
            while sp.daffna():
                summaries.append(list(sp.spkuds(sp.dafgs(5))))
        finally:
            sp.dafcls(r)
        return dict(ident=ident, fields=list(fields), summaries=summaries, states=states)
    finally:
        sp.spkuef(handle)


def write(source, output):
    h = sp.spklef(source)
    try:
        _, descriptor, _ = sp.spksfs(-100011, 1, 41)
        w = sp.spkopn(output, "INDEPENDENT SUBSET", 0)
        try:
            sp.spksub(h, descriptor, "SYNTHETIC SUBSET", -5.0, 10.0, w)
        finally:
            sp.spkcls(w)
    finally:
        sp.spkuef(h)


def numeric_tag(value):
    if math.isnan(value):
        return "NaN"
    if not math.isfinite(value):
        return "+Infinity" if value > 0 else "-Infinity"
    return value


def coefficient_file(path, extreme):
    coefficients = (
        [1e308, 1e308, -1e308, -1e308, 10.0, 1.0]
        if extreme else [5.0, -2.0, 3.0, 100.0, 8.0, -4.0, -30.0, 12.0, 5.0]
    )
    writer = sp.spkopn(path, "AUTHORED TYPE 2", 0)
    try:
        sp.spkw02(writer, -100011, -100010, "J2000", -10.0, 10.0, "ASYMMETRIC",
                  20.0, 1, 1 if extreme else 2, coefficients, -10.0)
    finally:
        sp.spkcls(writer)
    handle = sp.spklef(path)
    try:
        _, descriptor, _ = sp.spksfs(-100011, 0.0, 41)
        samples = []
        for t in ([10.0] if extreme else [-10.0, -3.125, 10.0, 12.0]):
            ref, state, center = sp.spkpvn(handle, descriptor, t)
            samples.append(dict(ref=ref, state=[numeric_tag(x) for x in state], center=center))
        return samples
    finally:
        sp.spkuef(handle)


def type10_file(path, lsk):
    # Project-authored synthetic synchronous orbit, with an element-set epoch
    # at J2000. The numerical constants are the eight NAIF SGP4 example inputs.
    sp.furnsh(lsk)
    try:
        geophs = [0.001082616, -2.53881e-6, -1.65597e-6, 0.0743669161,
                  120.0, 78.0, 6378.135, 1.0]
        elements = [0.0, 0.0, 0.0, 0.21, 1.6, 0.0023, 3.89, 0.95, 0.0043751, 0.0]
        writer = sp.spkopn(path, "AUTHORED TYPE 10", 0)
        try:
            sp.spkw10(writer, -100011, 399, "J2000", -60.0, 60.0, "SYNTHETIC RELAY",
                      geophs, 1, elements, [0.0])
        finally:
            sp.spkcls(writer)
        handle = sp.spklef(path)
        try:
            _, descriptor, _ = sp.spksfs(-100011, 0.0, 41)
            samples = []
            for t in [-120.0, 0.0, 120.0]:
                ref, state, center = sp.spkpvn(handle, descriptor, t)
                samples.append(dict(ref=ref, state=state.tolist(), center=center))
            return samples
        finally:
            sp.spkuef(handle)
    finally:
        sp.unload(lsk)


if __name__ == "__main__":
    mode, path, *rest = sys.argv[1:]
    if mode in ("coefficient", "ieee"):
        observation = coefficient_file(path, mode == "ieee")
    elif mode == "type10":
        observation = type10_file(path, rest[0])
    else:
        if mode == "write":
            write(path, rest[0])
            path = rest[0]
        observation = report(path)
    print(json.dumps(observation, allow_nan=False))
