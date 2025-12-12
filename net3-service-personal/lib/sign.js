const dilithiumPromise = require('dilithium-crystals-js');
var util=require("./util.js");

const DILITHIUM_KIND = 2; // Using Dilithium2 (can be 0-3 for different security levels)

async function keyGen(){
    const dilithium = await dilithiumPromise;
    var keypair = dilithium.generateKeys(DILITHIUM_KIND);
    var kp=new Object();
    kp.pub=util.arrayToHex(keypair.publicKey);
    kp.priv=util.arrayToHex(keypair.privateKey);
    kp.seed=""; // Dilithium doesn't expose seed in this API
    return kp;
}

async function keyGenFromSeed(seed){
    const dilithium = await dilithiumPromise;
    var Seed=util.hexToArray(seed);
    var keypair = dilithium.generateKeys(DILITHIUM_KIND, Seed);
    var kp=new Object();
    kp.pub=util.arrayToHex(keypair.publicKey);
    kp.priv=util.arrayToHex(keypair.privateKey);
    kp.seed=seed;
    return kp;
}

/*
async function pubFromPriv(priv){
    // Note: Dilithium doesn't support deriving public key from private key alone
    // This function may need to be refactored depending on how keys are stored
    var Priv=util.hexToArray(priv);
    // You may need to store the public key separately or restructure key storage
    throw new Error("pubFromPriv not directly supported by dilithium-crystals-js");
}
*/    

async function sign(text,priv){
    const dilithium = await dilithiumPromise;
    priv=util.hexToArray(priv);
    var message = typeof text === 'string' ? Buffer.from(text, 'hex') : text;
    var result = dilithium.sign(message, priv, DILITHIUM_KIND);
    return util.arrayToHex(result.signature);
}

async function verify(sign,text,pub){
    const dilithium = await dilithiumPromise;
    pub=util.hexToArray(pub);
    sign=util.hexToArray(sign);
    var message = typeof text === 'string' ? Buffer.from(text, 'hex') : text;
    var result = dilithium.verify(sign, message, pub, DILITHIUM_KIND);
    return result.result === 0; // Returns true if valid (result === 0 means valid)
}

module.exports={keyGen, keyGenFromSeed, sign, verify}


/*
(async () => 
{
    var kp=await keyGen();
    console.log(kp);
    kp = await keyGenFromSeed("e2d4c9338154f1002163e5a23871bcd3db2fce31e8d96bf3c08681b399b6b02a009f5d5e902158b7685b036b8e65a9be");
    console.log(kp);
    
    var signed=await sign("882b63c46b915516118d61a3fcdf7d70726474c402f681b529215ece1f2ac55f",kp.priv);
    console.log(signed);
    var verified=await verify(signed,"882b63c46b915516118d61a3fcdf7d70726474c402f681b529215ece1f2ac55f",kp.pub);
    console.log(verified);
})();

*/