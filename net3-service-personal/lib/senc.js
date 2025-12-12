// Symmetric encryption with AES GCM
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';


function encrypt(text, key) {
   let iv = crypto.randomBytes(16); // Initialization Vector (128 bits)
   const cipher = crypto.createCipheriv(algorithm, Buffer.from(key,"hex"), iv);
   let encrypted = cipher.update(text, 'utf8', 'hex');
   encrypted += cipher.final('hex');
   let authTag = cipher.getAuthTag();
   iv=iv.toString("hex");
   authTag=authTag.toString("hex")
   return iv+authTag+encrypted;
 }
 
 function decrypt(text,key) {
      var iv=text.substring(0,32);
      var authTag=text.substring(32,64);
      var encryptedData=text.substring(64,text.length);
      
     const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key,"hex"), Buffer.from(iv, 'hex'));
     decipher.setAuthTag(Buffer.from(authTag, 'hex'));
     let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     return decrypted;
     
 }

module.exports = { encrypt, decrypt };

/*
(async () => 
{
   var enc = encrypt("Yo Yo","75b12b18c6f33adbd90ec43e15e1338a389fd46fff66b2bd29eeed83ad8acd86");
   console.log(enc);
   var dec= decrypt(enc,"75b12b18c6f33adbd90ec43e15e1338a389fd46fff66b2bd29eeed83ad8acd86");
   console.log(dec);
})();
*/