const crypto = require('crypto');

// 암호화 메서드
const cipher = (text, key, algor) => {
    return new Promise((resolve, reject) => {
        const encrypt = crypto.createCipher(algor, key) // des알고리즘과 키를 설정
        // const encryptResult = encrypt.update(text, 'utf8', 'hex') // 암호화
        //     + encrypt.final('hex') // 인코딩
        const encryptResult =    Buffer.concat([encrypt.update(text), encrypt.final()]).toString('hex').toUpperCase() ;
        resolve(encryptResult)
    })
}

// 복호화 메서드
const decipher = (text, key, algor) => {
    return new Promise((resolve, reject) => {
        const decode = crypto.createDecipher(algor, key)
        const decodeResult = decode.update(Buffer.from(text, 'hex')) ; // 암호화된 문자열, 암호화 했던 인코딩 종류, 복호화 할 인코딩 종류 설정
            // + decode.final('utf8') // 복호화 결과의 인코딩
            
        resolve(Buffer.concat([decodeResult,decode.final() ]).toString() ) ;
    })
}

const IV_LENGTH = 16 // For AES, this is always 16

const encryptiv = (text, key, algor) => {
  return new Promise((resolve,reject) => {
  const iv = crypto.randomBytes(IV_LENGTH) ;
  const cipher = crypto.createCipheriv( algor,  Buffer.from(key),  iv  ) ;
  const encrypted = cipher.update(text)

  resolve (iv.toString('hex').toUpperCase() + ':' +   Buffer.concat([encrypted, cipher.final()]).toString('hex').toUpperCase()  );
  });
}

const decryptiv = (text, key, algor) => {
  return new Promise((resolve,reject) => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv( algor,   Buffer.from(key),   iv,  );
  const decrypted = decipher.update(encryptedText) ;
  resolve( Buffer.concat([decrypted, decipher.final()]).toString() );
  });
}

module.exports = {
    cipher,
    decipher,
    encryptiv,
    decryptiv
}