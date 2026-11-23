"""Independent exact-byte adapters for the locked N0067 C library."""
import ctypes as ct
import os
from pathlib import Path

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice

from .models import PathRef
from .runtime.path_refs import resolve_path_ref

# Keep these declarations separate from SpiceyPy's process-wide prototypes,
# which describe putcml_c's argv as char*, not char**.
_library = ct.CDLL(libspice._name)
I, T = ct.c_int, ct.c_char_p
P, Args = ct.POINTER(I), ct.POINTER(T)


def _symbol(name, arguments, result=None):
    fn = getattr(_library, name)
    fn.argtypes, fn.restype = arguments, result
    return fn


_open = _symbol("txtopr_", [T, P, I], I)
_close = _symbol("ftncls_c", [I])
_read = _symbol("rdtext_c", [T, I, T, P])
_store = _symbol("putcml_c", [I, Args])
_observe = _symbol("getcml_c", [P, ct.POINTER(Args)])


def store_command(argv):
    encoded = [arg.encode() for arg in argv]
    if any(b"\x00" in arg for arg in encoded):
        raise ValueError("Invalid embedded NUL in a command argument")
    # Provide writable caller storage so the independent readback observes
    # the toolkit's ownership after the caller overwrites its original bytes.
    storage = [ct.create_string_buffer(arg) for arg in encoded]
    table = (T * max(1, len(encoded)))()
    for i, buffer in enumerate(storage):
        table[i] = ct.cast(buffer, T)
    _store(len(encoded), table)
    sp.check_for_spice_error(None)
    for buffer in storage:
        ct.memset(ct.addressof(buffer), ord("!"), len(buffer) - 1)
    count, actual = I(), Args()
    _observe(ct.byref(count), ct.byref(actual))
    sp.check_for_spice_error(None)
    if count.value != len(encoded) or list(actual[:count.value]) != encoded:
        raise AssertionError("Canonical command storage did not retain the exact argument bytes")


def _read_exact(filename, width):
    if not -2**31 <= width <= 256 * 1024**2:
        raise ValueError("Invalid oracle line buffer capacity")
    data, eof = ct.create_string_buffer(max(1, width)), I()
    _read(filename, width, data, ct.byref(eof))
    sp.check_for_spice_error(None)
    return dict(line=data.value.decode(), eof=bool(eof.value))


def read_record(context, step):
    # These C string checks return before RDTEXT touches an unconnected unit.
    if not step.fileId or step.lineln < 2:
        return _read_exact(b"record" if step.fileId else b"", step.lineln)
    path = Path(resolve_path_ref(context.paths, PathRef("scratch", step.fileId)))
    text = step.text.encode()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text)
    elif path.read_bytes() != text:
        raise ValueError("A staged text fixture changed while reading")
    filename = os.fsencode(path)
    if len(filename) > 255:
        raise ValueError("Oracle path exceeds pinned RDTEXT storage")
    active = context.state.fileIo.activeTextReaders
    witness = None
    if str(path) not in active:
        # The original f2c inquiry computes a unit offset even for a
        # disconnected file. Establish a real independent read-only unit
        # first. RDTEXT allocates its own unit and performs its ordinary read.
        witness = I()
        _open(filename, ct.byref(witness), len(filename))
        sp.check_for_spice_error(None)
    try:
        result = _read_exact(filename, step.lineln)
    finally:
        if witness is not None:
            _close(witness.value)
            sp.check_for_spice_error(None)
    if result["eof"]:
        active.discard(str(path))
    else:
        active.add(str(path))
    return result


def finish_readers(context):
    # Only bounded, authored regular files enter this oracle. Reach the
    # canonical EOF before scratch removal, including after a workflow error.
    for filename in list(context.state.fileIo.activeTextReaders):
        path = Path(filename)
        for _ in range(path.read_bytes().count(b"\n") + 2):
            if _read_exact(os.fsencode(path), 512)["eof"]:
                context.state.fileIo.activeTextReaders.discard(filename)
                break
        else:
            raise AssertionError("The oracle did not reach the authored file's EOF")
