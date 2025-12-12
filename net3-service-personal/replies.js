async function reply(json,from,thisId){
    result={};
    
    if (json.method==0 || json.method=="0"){//function list
        result=[0,1,2]
    }

    if (json.method==1 || json.method=="1"){//owner info
        //await new Promise(resolve => setTimeout(resolve, 3000));
        result= {"owner":"Abdullah Sheikh", "myID": thisId, "yourId":from, "time":new Date()}
    }

    if(json.method==2 || json.method=="2"){ //main page
        html=`<!DOCTYPE html><html><body><div style="height:100vh; width:100%;display: flex;justify-content: center;align-items: center;flex-direction: column;">
<h1>This is the personal page for Abdullah Sheikh on net3</h1>
<strong>2021 to date: The most hacked person in the world</strong>
<div>I am a seasoned computer scientist who loves inventing things. I am a mold breaker, a visionary and have worked on a number of groundbreaking technologies.</div>
<div>I am currently working on three projects:
<ul>
<li><strong>DID:</strong> Decentralized ID. A global ID system based on crypto principles. Works with public keys and face scans.</li>
<li><strong>Statechain:</strong> A new type of DLT technology that does away with the scalability issues of blockchains.</li>
<li><strong>Net3:</strong> A new network for the users, by the users. Net3 rivals the internet and is a trusted network.</li>
</ul>
</div>
</div></body></html>`
        result={
  "contentType": "text/html",
    "content":Buffer.from(html).toString('base64')
    }
    }

    if(json.method==3 || json.method=="3"){//webapp
    
    }

    if(json.method==4 || json.method=="4"){//message

    }


    return {"jsonrpc":json.jsonrpc,"result":result,"id":json.id}
}

module.exports={reply};