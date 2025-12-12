//Asymmetric encryption using ML-KEM (Kyber)
var util=require("./util.js");
//var ntru= require("ntru");
const { MlKem1024 } = require('mlkem');

const mlkem = new MlKem1024();

async function keyGen(){
    let keyPair = await mlkem.generateKeyPair();
    //console.log(keyPair)
    var kp=new Object();
    kp.pub=util.arrayToHex(keyPair[0]);
    kp.priv=util.arrayToHex(keyPair[1]);
    return kp;
}

async function genCypher(pub){
    pub=util.hexToArray(pub);
    let cypher_secret = await mlkem.encap(pub);
    cypher=util.arrayToHex(cypher_secret[0]);
    secret=util.arrayToHex(cypher_secret[1]);
    var obj=new Object();
    obj.cypher=cypher;
    obj.secret=secret;
    return obj;
}

async function getSecret(cypher,priv){
    priv=util.hexToArray(priv);
    cypher=util.hexToArray(cypher);
    var secret = await mlkem.decap(cypher,priv);
    return util.arrayToHex(secret);
}

module.exports={keyGen, genCypher, getSecret}

    /*
    kp= keyGen();
    //console.log(kp);
    
    var obj=genCypher(kp.pub);
    console.log(obj.secret);
    
    var otherSecret=getSecret(obj.cypher,kp.priv);
    console.log(otherSecret);
    */

