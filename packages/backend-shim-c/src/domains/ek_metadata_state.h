#ifndef TSPICE_EK_METADATA_STATE_H
#define TSPICE_EK_METADATA_STATE_H
/* Called with the process CSPICE lock, around KEEPER membership changes. */
void tspice_ek_saved_keeper(void);
void tspice_ek_changed_keeper(void);
#endif
