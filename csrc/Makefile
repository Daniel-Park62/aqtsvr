CC = gcc 
INC = -I${MARIADB_HOME}/include/mysql -I${TMAXDIR} -I. 

CFLAGS = -m64 -O2 -g -Wall -W -D__TMAX__ ${INC} 
BDIR= ${AQTHOME}/cbin
TMAXDIR = /tmax

LDFLAGS = 
LDLIBS = -L${MARIADB_HOME}/lib -lmariadb -L${BDIR} -laqtcom
TARGETS = libaqtcom.so aqt_sendS aqt_sendM aqt_sendM_new aqt_request aqt_reqsub aqt_sendM2 aqt_rnsend2 aqt_realsend 
.PHONY: all clean
all : $(TARGETS:%=$(BDIR)/%)

${BDIR}/libaqtcom.so: aqt_comm.c
	${CC} ${CFLAGS} -c $? 
	${CC} -shared -o $@ aqt_comm.o

${BDIR}/aqt_rnsend2: aqt_rnsend2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB -pthread ${LDLIBS} -L${TMAXDIR}/lib64 -lcli 

${BDIR}/aqt_sendM2: aqt_sendM2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB -pthread ${LDLIBS} -L${TMAXDIR}/lib64 -lcli

${BDIR}/aqt_sendS: aqt_sendS.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS}

${BDIR}/aqt_realsend: aqt_realsend.c
	${CC} ${CFLAGS} -o $@ $? 

${BDIR}/aqt_request: aqt_request.c 
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS}

${BDIR}/aqt_sendM: aqt_sendM.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} -L${TMAXDIR}/lib64 -lcli

${BDIR}/aqt_sendM_new: aqt_sendM_new.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB -pthread  ${LDLIBS} -L${TMAXDIR}/lib64  -lcli

${BDIR}/aqt_reqsub: aqt_reqsub.c 
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} -L${TMAXDIR}/lib64 -lcli

aqt_dbpool.o: aqt_dbpool.c 
	${CC} ${CFLAGS} -c $? ${LDLIBS}

.c.o:

clean:
	rm $(TARGETS:%=$(BDIR)/%)

#%.o: %.c aqt2.h