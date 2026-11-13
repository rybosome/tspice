#include "tspice_backend_shim.h"
#include "SpiceUsr.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
static void *live[16];
static int liveCount=0,allocations=0,failAt=0;
static void track(void*p){if(p)live[liveCount++]=p;}
void *audit_malloc(size_t n){if(++allocations==failAt)return NULL;void*p=malloc(n);track(p);return p;}
void *audit_calloc(size_t n,size_t size){if(++allocations==failAt)return NULL;void*p=calloc(n,size);track(p);return p;}
void audit_free(void*p){if(!p)return;for(int i=0;i<liveCount;i++)if(live[i]==p){live[i]=live[--liveCount];free(p);return;}fprintf(stderr,"untracked free\n");abort();}
void *audit_realloc(void*p,size_t n){if(++allocations==failAt)return NULL;int i=0;while(i<liveCount&&live[i]!=p)i++;void*q=realloc(p,n);if(q){if(i<liveCount)live[i]=q;else track(q);}return q;}
void audit_clear_workspace(void);
static int forwarded=0;
void observe_ekacli(SpiceInt h,SpiceInt s,ConstSpiceChar*c,ConstSpiceInt*v,ConstSpiceInt*e,ConstSpiceBoolean*n,ConstSpiceInt*r,SpiceInt*w){forwarded++;}
void observe_ekacld(SpiceInt h,SpiceInt s,ConstSpiceChar*c,ConstSpiceDouble*v,ConstSpiceInt*e,ConstSpiceBoolean*n,ConstSpiceInt*r,SpiceInt*w){forwarded++;}
void observe_ekaclc(SpiceInt h,SpiceInt s,ConstSpiceChar*c,SpiceInt width,const void*v,ConstSpiceInt*e,ConstSpiceBoolean*n,ConstSpiceInt*r,SpiceInt*w){
 if(strcmp(c,"V")==0){for(int i=0;i<3;i++)if(e[i]!=1||!n[i]||((const char*)v)[i*width]!=0){fprintf(stderr,"unsafe NULL backing\n");abort();}}
 forwarded++;
}
void observe_ekffld(SpiceInt h,SpiceInt s,SpiceInt*r){forwarded++;}
static int invoke(int kind,int h,int s,const int *rc,int rows,int size,int good){
 int ints[6]={1,2,3,4,5,6},ent[3]={size,size,size},nulls[3]={0};double doubles[6]={1,2,3,4,5,6};char chars[6][3]={"A","B","C","D","E","F"};char err[1841]={0};int before=forwarded,code;
 if(kind==0)code=tspice_ekacli(h,s,"I",rows,ints,rows*size,ent,nulls,(int*)rc,err,sizeof(err));
 else if(kind==1)code=tspice_ekacld(h,s,"D",rows,doubles,rows*size,ent,nulls,(int*)rc,err,sizeof(err));
 else code=tspice_ekaclc(h,s,"C",rows,rows*size,3,sizeof(chars),(const char*)chars,ent,nulls,(int*)rc,err,sizeof(err));
 if(good?(code!=0||forwarded!=before+1):(code==0||forwarded!=before)){
  fprintf(stderr,"kind=%d rows=%d size=%d code=%d forwarded=%d expected_ok=%d error=%s\n",kind,rows,size,code,forwarded-before,good,err);return 1;
 }return 0;
}
int main(int argc,char**argv){
 if(argc!=2)return 2;int h=0,s=0,rc[3]={0};char err[1841]={0};char names[4][2]={"I","D","C","V"};char decls[4][64]={"DATATYPE=INTEGER,SIZE=2","DATATYPE=DOUBLE PRECISION,SIZE=2","DATATYPE=CHARACTER*(20),SIZE=2","DATATYPE=CHARACTER*(20),SIZE=VARIABLE,NULLS_OK=TRUE"};
 if(tspice_ekopn(argv[1],"AUTHORED_BOUNDS",0,&h,err,sizeof(err))||tspice_ekifld(h,"BOUNDS",4,3,2,(char*)names,64,(char*)decls,&s,rc,err,sizeof(err))){fprintf(stderr,"setup: %s\n",err);return 1;}
 int failed=0;for(int k=0;k<3;k++)failed|=invoke(k,h,s,rc,1,2,0)||invoke(k,h,s,rc,3,1,0)||invoke(k,h,s,rc,3,2,1);
 int before=forwarded;
 if(tspice_ekffld(h,s,1,rc,err,sizeof(err))==0||forwarded!=before)failed=1;
 if(tspice_ekffld(h,s,3,rc,err,sizeof(err))!=0||forwarded!=before+1)failed=1;
 int zeros[3]={0},nulls[3]={1,1,1};
 for(int position=1;position<=2;position++){
  int baseline=liveCount;before=forwarded;allocations=0;failAt=position;
  int code=tspice_ekaclc(h,s,"V",3,0,2,0,NULL,zeros,nulls,rc,err,sizeof(err));
  if(code==0||forwarded!=before||liveCount!=baseline){fprintf(stderr,"NULL allocation failure position=%d code=%d live=%d baseline=%d\n",position,code,liveCount,baseline);failed=1;}
 }
 failAt=0;before=forwarded;
 if(tspice_ekaclc(h,s,"V",3,0,2,0,NULL,zeros,nulls,rc,err,sizeof(err))!=0||forwarded!=before+1){fprintf(stderr,"NULL recovery: %s\n",err);failed=1;}
 audit_clear_workspace();if(liveCount!=0)failed=1;
 tspice_ekcls(h,err,sizeof(err));
 if(failed)return 1;puts("validated actual segment row counts and fixed column backing");return 0;
}
