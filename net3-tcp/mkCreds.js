const fs = require('fs');
var sign=require("./lib/sign.js");
var hash=require("./lib/hash.js");
var util=require("./lib/util.js");
var filename="account.json";


(async () => 
{
    var j=new Object();
    var kp=await sign.keyGen();
    j.priv=kp.priv;
    j.pub=kp.pub;
    j.id=util.hexToBase58(hash.createFoldedHash(kp.pub));
    //console.log(j);
    fs.writeFileSync(filename,JSON.stringify(j,null,2));
    console.log("Done! Keypair successfully generated for id: "+j.id);
})();