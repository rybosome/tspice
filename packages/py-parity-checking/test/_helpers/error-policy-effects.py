"""Write real diagnostics to a caller-owned device in a disposable toolkit process."""
import ctypes
import sys
import spiceypy as sp

device, mask = sys.argv[1:3]
lib = ctypes.CDLL(sp.libspice._name)
fn = lib.errprt_c
fn.argtypes = [ctypes.c_char_p, ctypes.c_int, ctypes.POINTER(ctypes.c_char)]
fn.restype = None
sp.errdev("SET", len(device.encode()) + 1, device)
fn(b"SET", 0, ctypes.create_string_buffer(mask.encode()))
sp.check_for_spice_error(None)
count = int(sys.argv[3]) if len(sys.argv) > 3 else 1
for _ in range(count):
    sp.setmsg("A B07 diagnostic with a second field.")
    sp.sigerr("SPICE(B07DISPOSITION)")
    assert sp.failed() and sp.getmsg("SHORT",80) == "SPICE(B07DISPOSITION)"
    sp.reset()
