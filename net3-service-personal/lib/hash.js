//SHA-512 and folded hash
var crypto = require('crypto');
var util=require("./util.js");


function createHash(str){
var hash = crypto.createHash('sha3-512');
var data=hash.update(str);
gen_hash= data.digest('hex');
return gen_hash;
}

function createFoldedHash(str){
    var hash = crypto.createHash('sha3-512'); 
    var data=hash.update(str);
    var gen_hash= data.digest('hex');
    //now break in two
    b1=gen_hash.substring(0,64);
    b2=gen_hash.substring(64,128);
   // console.log("b1 "+b1);
   // console.log("b2 "+b2);
    var mid=util.xor(b1,b2);
    //return mid;
    b1=mid.substring(0,32);
    b2=mid.substring(32,64)
    var final=util.xor(b1,b2);
    return final;
}

module.exports = { createHash, createFoldedHash };

/*
(async () => 
{
    h=createHash("testing");
    console.log(h, h.length);
    fh=createFoldedHash("testing");
    console.log(fh, fh.length);
    console.log(util.hexToBase58(fh));
})();
*/