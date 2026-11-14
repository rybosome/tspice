"""Create authored MIT EK lifecycle fixtures using locked SpiceyPy/N0067.

Invented integer rows and table names, with no external observations. Run from
this package: uv run --locked --project sidecars/spiceypy python
fixtures/generate-audit-ek.py.
"""
from pathlib import Path
import spiceypy as sp

root=Path(__file__).resolve().parent/'kernels'
inputs=[('audit-tables-one.ek',[('AUDIT_SHARED',[11,12]),('AUDIT_ALPHA',[21]),('AUDIT_SHARED',[13])]),('audit-tables-two.ek',[('AUDIT_SHARED',[14]),('AUDIT_BETA',[31])])]
for name,segments in inputs:
    output=root/name;output.unlink(missing_ok=True)
    h=sp.ekopn(str(output),'AUTHORED_STEP7_EK',0)
    try:
        for table,rows in segments:
            decl='DATATYPE=INTEGER'
            seg,ptrs=sp.ekifld(h,table,1,len(rows),3,['ID'],len(decl)+1,[decl])
            sp.ekacli(h,seg,'ID',rows,[1]*len(rows),[False]*len(rows),ptrs,[0]*len(rows))
            sp.ekffld(h,seg,ptrs)
    finally:sp.ekcls(h)
    h=sp.ekopr(str(output))
    try:assert sp.eknseg(h)==len(segments)
    finally:sp.ekcls(h)
    sp.furnsh(str(output))
    try:
        assert sp.ekntab()==len(set(table for table,_ in segments))
        for table in sorted(set(table for table,_ in segments)):
            expected=sorted(value for tab,rows in segments if tab==table for value in rows)
            count,error,message=sp.ekfind('SELECT ID FROM '+table+' ORDER BY ID')
            assert not error and count==len(expected),message
            assert [sp.ekgi(0,i,0)[0] for i in range(count)]==expected
    finally:sp.kclear()
    print(name,output.stat().st_size)
