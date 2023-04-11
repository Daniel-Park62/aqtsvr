/*
 *  LAYOUT
 */

#ifndef _AQT2_H
#define _AQT2_H

#define L_PACKET_LENGTH 8
#define L_REPLY_NEEDED 1
#define L_UUID 32
#define L_TR_CODE 32
#define L_MSG_CODE 4
#define L_TIME 8
#define L_MAIN_MSG 80

#define TP_ENV_FILE "./tmax.env"
#define LOG_PATH "./logs"

#define VNAME_SZ 128
#define FNAME_SZ 256

#define DBHOST "192.168.0.27"
#define DBUSER "aqtdb"
#define DBNAME "aqtdb2"
#define DBPASS "Dawinit1!"
#define DBPORT 3306
#define DBSOCKET NULL // "/tmp/mysql.sock"

typedef struct
{
	long msg_type;
	struct Data
	{
		short dbu;
		unsigned long pkey;
	} data;
} MSGREC;

static key_t msgkey = 5972;

#define MemCopy(D, S, N)                  \
	do {                                     \
		int i = (N)-1;                        \
		while (i >= 0 && isblank(*((S) + i))) \
			*((D) + i--) = 0;                   \
		memcpy((D), (S), i + 1);              \
	} while (0)

/*  field buffer 
typedef struct {
	union  {
		uint32_t ltype ;
	char ctype[4] ;
	}  ;
	char data[ 1024 * 32 ] ;
} TR_FLD ;

typedef struct {
	uint32_t lfix ;
	uint32_t llen ;
	union  {
		uint32_t ltype ;
	char ctype[4] ;
	}  ;
	char data[ 1024 * 32 ] ;
} TR_REC ;

typedef union {
	uint64_t u64 ;
	uint8_t  u8[8] ;
} TDF ;

typedef union {
	uint32_t u32 ;
	uint8_t  u8[4] ;
} TLF ;


void chg_buff(  TR_REC *target, TR_REC * ldata, uint32_t slen) ;

void chg_buff(  TR_REC *target, TR_REC * ldata, uint32_t slen) {

	TDF  *tdf, *tdft ;
	uint32_t *tlf, *tlft ;
	target->lfix = ntohl(ldata->lfix) ;
	target->llen = slen ;
	TR_FLD *lfld = (TR_FLD *)ldata->ctype ;
	TR_FLD *tfld = (TR_FLD *)target->ctype ;
//	target->ltype = ntohl(ldata->ltype) ;
	uint32_t ipos = 12 ;
	while (1) {
		tfld->ltype = ntohl(lfld->ltype) ;
//		printf("(%u)[%s]\n", tfld->ltype, Fname(tfld->ltype) );
		if (lfld->ctype[0] == 0x1c) {
			int ii = 0 ;
			while (lfld->data[ii] != 0 && ipos+1 < slen) {
				tfld->data[ii] = lfld->data[ii] ;
				ipos++ ;
				ii++ ;
			}
			ii += 4;
			ipos+= (ii/8 + 1) * 8 - ii ;
		} else if (lfld->ctype[0] == 0x18) {
			ipos += 4 ;
			tdf = ldata->data+ipos ;
			tdft = target->data+ipos ;
			tdft->u64 = be64toh(tdf->u64) ;
			ipos += 8 ;
		} else {
			tlf = ldata->data+ipos ;
			tlft = target->data+ipos ;
			*tlft = be32toh(*tlf) ;
			ipos += 4 ;
		}
		lfld = (TR_FLD*)((char *)ldata+ipos) ;
		tfld = (TR_FLD*)((char *)target+ipos) ;
		ipos+=4;
		if (ipos >= slen ) break ;

	}

}

void chg_buff2(  TR_REC *target, TR_REC * ldata, uint32_t len) ;

void chg_buff2(  TR_REC *target, TR_REC * ldata, uint32_t len) {

	TDF  *tdf, *tdft ;
	uint32_t *tlf, *tlft ;
	target->lfix = htobe32(ldata->lfix) ;
	target->llen = htobe32(ldata->llen) ;
	TR_FLD *lfld = (TR_FLD *)ldata->ctype ;
	TR_FLD *tfld = (TR_FLD *)target->ctype ;
//	target->ltype = ntohl(ldata->ltype) ;
	uint32_t ipos = 12 ;
	while (1) {
		tfld->ltype = htobe32(lfld->ltype) ;
//		printf("(%u)[%s]\n", tfld->ltype, Fname(tfld->ltype) );
		if (tfld->ctype[0] == 0x1c) {
			int ii = 0 ;
			while (lfld->data[ii] != 0 && ipos+1 < len) {
				tfld->data[ii] = lfld->data[ii] ;
				ipos++ ;
				ii++ ;
			}
			ii += 4;
			ipos+= (ii/8 + 1) * 8 - ii ;
		} else if (tfld->ctype[0] == 0x18) {
			ipos += 4 ;
			tdf = ldata->data+ipos ;
			tdft = target->data+ipos ;
			tdft->u64 = htobe64(tdf->u64) ;
			ipos += 8 ;
		} else {
			tlf = ldata->data+ipos ;
			tlft = target->data+ipos ;
			*tlft = htobe32(*tlf) ;
			ipos += 4 ;
		}
		lfld = (TR_FLD*)((char *)ldata+ipos) ;
		tfld = (TR_FLD*)((char *)target+ipos) ;
		ipos+=4;
		if (ipos >= len ) break ;

	}

}
*/

#endif
