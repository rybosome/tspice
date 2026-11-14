"""Call the locked toolkit on the workflow's existing caller-owned cells."""

import ctypes as ct

import spiceypy as sp
from spiceypy.utils.libspicehelper import libspice
from spiceypy.utils.support_types import SpiceCell


def copy_cell(source: SpiceCell, target: SpiceCell) -> None:
    # sp.copy allocates an empty same-sized destination, hiding real capacity
    # failures and the set flag of the caller's existing destination.
    if source.dtype != target.dtype:
        raise ValueError("copy requires cells of the same kind")
    api = ct.CDLL(libspice._name).copy_c
    api.argtypes = [ct.POINTER(SpiceCell), ct.POINTER(SpiceCell)]
    api.restype = None
    api(ct.byref(source), ct.byref(target))
    sp.check_for_spice_error(None)


def check_text(value: str, cell: SpiceCell, *, append: bool = False) -> None:
    data = value.encode("utf-8", "strict")
    if b"\0" in data or len(data) >= 2**31:
        raise ValueError("Expected a representable UTF-8 C string")
    # If full, CSPICE reports CELLTOOSMALL before putting bytes in the row.
    if append and cell.card < cell.size:
        data[:cell.length - 1].decode("utf-8", "strict")
