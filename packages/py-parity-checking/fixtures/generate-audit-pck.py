"""Create the synthetic binary PCK with the repository's locked SpiceyPy."""
from pathlib import Path
from tempfile import TemporaryDirectory

import spiceypy as sp


def write_fixture(path: Path) -> None:
    h = sp.pckopn(str(path), "TSPICE INDEPENDENT TYPE TWO", 0)
    sp.pckw02(h, 3000, "J2000", -20, 0, "EARLY", 10, 2, 2,
              [.12,.05,-.015, .7,-.04,.01, -.9,.08,.02,
               .33,-.07,.025, .42,.025,-.045, .17,.11,-.027], -20)
    sp.pckw02(h, 3000, "J2000", 10, 20, "LATE", 10, 1, 1,
              [-.3,.13,.81,.11,1.25,-.18], 10)
    sp.pckw02(h, 301, "B1950", 4, 8, "LUNAR CLASS", 4, 1, 0, [.5,.25,-.125], 4)
    sp.pckcls(h)


if __name__ == "__main__":
    with TemporaryDirectory() as directory:
        path = Path(directory) / "fixture.bpc"
        write_fixture(path)
        (Path(__file__).parent / "kernels" / "audit-orientation.bpc").write_bytes(path.read_bytes())
