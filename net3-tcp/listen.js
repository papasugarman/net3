// listener.js
const net = require('net');
const crypto=require("crypto");
const aenc=require("./lib/aenc.js");
const senc=require("./lib/senc.js");
const hash=require("./lib/hash.js");
const sign=require("./lib/sign.js");
const util=require("./lib/util.js");

var TIMEOUT=5000;
var HOST="0.0.0.0"
var PORT=15160;

var keys; 
var templates=new Object();
var connKeys=new Object();

var connections=[];

const listener = net.createServer((socket) => {
  var pass=0;

  //console.log('Client connected.');

  socket.on('data', async (data) => {
    if (data=="") return;

    //console.log(`Pass ${pass}`);

    try{
        if(pass==0){
            if(validateConnJSON(data.toString().trim())){
                connKeys=await aenc.keyGen();
                socket.write(JSON.stringify({pub:connKeys.pub})+"\n");
            }
            else throw Error("Initial connection JSON didn't meet expectations");
        }//0

        if(pass==1){
            cypher=JSON.parse(data.toString().trim()).cypher;
            connKeys.secret=await aenc.getSecret(cypher,connKeys.priv);
            socket.write(senc.encrypt(JSON.stringify({status:"OK"}),connKeys.secret)+"\n");
        }//1

        if(pass==2){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(received.id.yours!=keys.id){
                socket.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Not intended party"}),connKeys.secret)+"\n");
                socket.end();
            }
            /*
            if(!validateIncoming(received.id.mine)){
                socket.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Barred party"}),connKeys.secret)+"\n");
                socket.end();
            }
            */
            connKeys.otherParty=received.id.mine;
            challenge=crypto.randomBytes(32);
            connKeys.challenge=challenge.toString("hex");
            socket.write(senc.encrypt(JSON.stringify({challenge:connKeys.challenge}),connKeys.secret)+"\n");
        }//2

        if(pass==3){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(util.hexToBase58(hash.createFoldedHash(received.pub))!=connKeys.otherParty){
                socket.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Pub doesn't match stated ID"}),connKeys.secret)+"\n");
                throw Error("Connecting party's Pub was wrong.");
            }
            if(! await sign.verify(received.signed,connKeys.challenge,received.pub)){
                socket.write(senc.encrypt(JSON.stringify({status:"NOKAY",reason:"Signed challange failed"}),connKeys.secret)+"\n");
                throw Error("Connecting party couldn't prove ID");
            }
            socket.write(senc.encrypt(JSON.stringify({status:"OK"}),connKeys.secret)+"\n");
        }//3

        if(pass==4){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            signed=await sign.sign(received.challenge,keys.priv);
            socket.write(senc.encrypt(JSON.stringify({pub:keys.pub,signed:signed}),connKeys.secret)+"\n");
        }//4

        if(pass==5){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            if(!received.status || received.status!="OK")
                throw Error("I failed proving my ID "+received.reason);
            //console.log("Now Connected to "+connKeys.otherParty);
            regNewConnection(connKeys.otherParty,socket,connKeys.secret);
        }//5

        if(pass>=6){
            received=senc.decrypt(data.toString().trim(),connKeys.secret);
            received=JSON.parse(received);
            await handleMsg(connKeys.otherParty,received);
            //await send({msg:"cmd"});
        }
    
        pass++;
    }
    catch(e){
        console.log("Protocol error: "+e);
        socket.end();
    }
    

  });

  socket.on('end', () => {
    console.log('Client disconnected.');
  });
    socket.on('error', (err) => {
        console.error("Socket error:", err);
    });



});

async function send(id, msg) {
        var connection = connections[id];
        if (connection != undefined) {
            connection.socket.write(senc.encrypt(JSON.stringify(msg), connection.secret) + "\n");
        }
    }

function regNewConnection(id, socket, secret) {
        console.log("Now connected to :", id);
        connections[id] = { socket: socket, secret: secret };
    }

async function handleMsg(id,received){
    console.log("The peer "+id+ " said: ",received);
}
async function stopListening(){
    //also close each socket separetly
    listener.close();
}

async function startListening(host,port,timeout){
    initConnection();

    listener.timeout=timeout;
    listener.listen(port, host, () => {
        console.log(`Listening on port ${PORT}`);
      });
}


function initConnection(){

    keys=require("./account.json");

    connJ=require("./templates/conn.json");
    authJ=require("./templates/auth.json");
    templates.connection=connJ;
    templates.auth=authJ;
    templates.auth.id.mine=keys.id;
}

////////////////////////////////////
function validateConnJSON(j){
    if (JSON.stringify(templates.connection)==j)
        return true;
    return false;
}

////////////////////////////////////
(async () => 
    {

        await startListening("0.0.0.0",15160,5000);
        setInterval(async function(){
            send("QCbUpzoiUNc4BLHJW6DBQP",{msg:"cmd"})
        },3500)

    })();