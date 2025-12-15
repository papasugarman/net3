// connect.js
const net = require('net');
const crypto=require("crypto");
const aenc=require("./lib/aenc.js");
const senc=require("./lib/senc.js");
const hash=require("./lib/hash.js");
const sign=require("./lib/sign.js");
const util=require("./lib/util.js");

var TIMEOUT=5000;
var HOST="127.0.0.1"
var PORT=15160;

var keys; 
var templates=new Object();
var connKeys=new Object();
var pass;


const client = new net.Socket();

client.on('data',async function(data){
    if (data=="") return;

    //console.log(`Pass ${pass}`);

    try{
        if (pass==0){
            received=JSON.parse(data.toString().trim());
            connKeys=await aenc.genCypher(received.pub);
            client.write(JSON.stringify({cypher:connKeys.cypher})+"\n");
        }//0

        if(pass==1){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(!received.status || received.status!="OK")
                throw Error("Asymmetric encryption couldn't be agreed upon");
            client.write(senc.encrypt(JSON.stringify(templates.auth),connKeys.secret)+"\n");
        }//1

        if(pass==2){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(received.status=="NOKAY") throw Error(received.reason);
            signed=await sign.sign(received.challenge,keys.priv);
            client.write(senc.encrypt(JSON.stringify({pub:keys.pub,signed:signed}),connKeys.secret)+"\n");
        }//2

        if(pass==3){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(!received.status || received.status!="OK")
                throw Error("I failed proving my ID "+received.reason);
            challenge=crypto.randomBytes(32);
            connKeys.challenge=challenge.toString("hex");
            client.write(senc.encrypt(JSON.stringify({challenge:connKeys.challenge}),connKeys.secret)+"\n");
        }//3

        if(pass==4){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(util.hexToBase58(hash.createFoldedHash(received.pub))!=templates.auth.id.yours){
                client.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Pub doesn't match stated ID"}),connKeys.secret)+"\n");
                throw Error("Connecting party's Pub was wrong.");
                        }
            if(! await sign.verify(received.signed,connKeys.challenge,received.pub)){
                client.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Signed challange failed"}),connKeys.secret)+"\n");
                throw Error("Connecting party couldn't prove ID.");
                        }
            client.write(senc.encrypt(JSON.stringify({status:"OK"}),connKeys.secret)+"\n");
            console.log("Now Connected to "+templates.auth.id.yours);
        }//4

        if (pass>=5) {
            // Handle peer response
            received = senc.decrypt(data.toString().trim(), connKeys.secret);
            received = JSON.parse(received);
            await handleMsg(templates.auth.id.yours,received);
        }

        pass++;
    }
    catch(e){
        console.log("Protocol Error: "+e);
        client.end();
    }

});

client.on('close', () => {
  console.log('Connection closed.');
});

client.on('error', (err) => {
    console.error("Connection error:", err);
});

async function send(msg){
    client.write(senc.encrypt(JSON.stringify(msg),connKeys.secret)+"\n");
}

async function handleMsg(id,received){
    console.log("Peer "+id+" said ",received);
    client.write(senc.encrypt(JSON.stringify({status:"1"}),connKeys.secret)+"\n");
}

function disconnect(){
    client.end();
}

function initConnection(){

    keys=require("./account1.json");

    connJ=require("./templates/conn.json");
    authJ=require("./templates/auth.json");
    templates.connection=connJ;
    templates.auth=authJ;
    templates.auth.id.mine=keys.id;
}


async function connect(intended){
    initConnection();
    HOST=intended.host;
    PORT=intended.port;
    templates.auth.id.yours=intended.id;
    connKeys.otherParty=intended.id;
    client.setTimeout(TIMEOUT);

    client.connect(PORT, HOST, async function() {
        //console.log("Connected");
        pass=0;
        client.write(JSON.stringify(templates.connection)+'\n');
    });
}

////////////////////////////////////
(async () => 
    {

        var intended={host:"127.0.0.1",port:"15160",id:"KRjhttJN14rMLzSRo5oBNC"};
        await connect(intended);
        
        /**/
        setInterval(async function(){
            console.log("Sending message");
            await send({msg:"hi"});
        },3000);
        

    })();