"""Generate MIT-licensed authored EK query/column fixtures; locked SpiceyPy N0067."""
from pathlib import Path
import spiceypy as sp

output=Path(__file__).parent/'kernels'/'audit-query.ek'
output.unlink(missing_ok=True)
names=['KEY','CV','DV','IV','CF','DF','IFIX']
decls=['DATATYPE=INTEGER, INDEXED=TRUE', 'DATATYPE=CHARACTER*(1024), SIZE=VARIABLE, NULLS_OK=TRUE', 'DATATYPE=DOUBLE PRECISION, SIZE=VARIABLE, NULLS_OK=TRUE', 'DATATYPE=INTEGER, SIZE=VARIABLE, NULLS_OK=TRUE', 'DATATYPE=CHARACTER*(40), SIZE=2, NULLS_OK=TRUE', 'DATATYPE=DOUBLE PRECISION, SIZE=2, NULLS_OK=TRUE', 'DATATYPE=INTEGER, SIZE=2, NULLS_OK=TRUE']
h=sp.ekopn(str(output),'AUTHORED_QUERY_FIXTURE',0)
try:
 seg,rc=sp.ekifld(h,'AUDIT_QUERY',len(names),3,max(map(len,names))+1,names,max(map(len,decls))+1,decls)
 sp.ekacli(h,seg,'KEY',[30,10,20],[1,1,1],[False]*3,rc,[0]*3)
 sizes=[2,0,1];nulls=[False,True,False]
 sp.ekaclc(h,seg,'CV',1025,['  leading','Beta','X'*1024],sizes,nulls,rc,[0]*3)
 sp.ekacld(h,seg,'DV',[-3.25,2000000,-0.0000001],sizes,nulls,rc,[0]*3)
 sp.ekacli(h,seg,'IV',[-2147483648,2147483647,73],sizes,nulls,rc,[0]*3)
 sp.ekaclc(h,seg,'CF',41,['A one','A two','ignored1','ignored2','C one','C two'],[2]*3,nulls,rc,[0]*3)
 sp.ekacld(h,seg,'DF',[-7.25,8.5,0,0,77.75,-99.125],[2]*3,nulls,rc,[0]*3)
 sp.ekacli(h,seg,'IFIX',[-7,8,0,0,77,-99],[2]*3,nulls,rc,[0]*3)
 sp.ekffld(h,seg,rc)
finally:sp.ekcls(h)
sp.furnsh(str(output))
try:
 assert sp.ekfind('SELECT CV,DV,IV,CF,DF,IFIX FROM AUDIT_QUERY')[0]==3
 with sp.no_found_check():
  assert sp.ekgc(0,0,0,2048)==('  leading',0,True),sp.ekgc(0,0,0,2048)
  assert sp.ekgc(0,2,0,2048)==('X'*1024,0,True)
  assert sp.ekgi(2,0,0)==(-2147483648,0,True)
  assert sp.ekgi(2,0,1)==(2147483647,0,True)
  for col,fn in [(0,lambda a,b,c:sp.ekgc(a,b,c,2048)),(1,sp.ekgd),(2,sp.ekgi)]:
   assert fn(col,1,0)[1:]==(1,True)
   assert fn(col,1,9)[1:]==(1,True)
 print('Authored query fixture validated:',output.stat().st_size,'bytes')
finally:sp.kclear();sp.reset()
