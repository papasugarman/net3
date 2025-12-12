async function reply(json,from,thisId){
    result={};
    
    if (json.method==0 || json.method=="0"){//function list
        result=[0,1,2,3,{"getJoke":[]}];
    }

    if (json.method==1 || json.method=="1"){//owner info
        //await new Promise(resolve => setTimeout(resolve, 3000));
        result= {"owner":"Joke Machine", "myID": thisId, "yourId":from, "time":new Date()}
    }

    if(json.method==2 || json.method=="2"){ //main page
        html=`<!DOCTYPE html><html><body><div style="height:100vh; width:100%;display: flex;justify-content: center;align-items: center;flex-direction: column;">
<h1>This is the Joke Service on net3</h1>
<div>Enjoy non-AI adult jokes here.</div>
<strong>Please use the function (getJoke) or load the webapp(<a style="cursor:pointer; text-decoration:underline" onclick="webappGoTo({'jsonrpc':'2.0','method': '3', 'id': '0'})">~3</a>)</strong>
</div></body></html>`
        result={
  "contentType": "text/html",
  //"content": "PGRpdiBzdHlsZT0iaGVpZ2h0OjEwMHZoOyB3aWR0aDoxMDAlO2Rpc3BsYXk6IGZsZXg7anVzdGlmeS1jb250ZW50OiBjZW50ZXI7YWxpZ24taXRlbXM6IGNlbnRlcjtmbGV4LWRpcmVjdGlvbjogY29sdW1uOyI+CjxoMT5UaGlzIGlzIHRoZSBuZXQzIHJlZ2lzdHJ5PC9oMT4KPHN0cm9uZz5QbGVhc2UgdXNlIHRoZSBmdW5jdGlvbnMgb3IgbG9hZCB0aGUgd2ViYXBwKH4zKTwvc3Ryb25nPgo8L2Rpdj4="
    "content":Buffer.from(html).toString('base64')
    }
    }

    if(json.method==3 || json.method=="3"){//webapp

    // Method 2: Reading from a file (synchronous)
    const fs = require('fs');
    const htmlContent = fs.readFileSync('./net3-service-joke/webapp.html', 'utf8');
    const base64 = Buffer.from(htmlContent).toString('base64');
    result={
    "contentType": "text/html",
    "content": base64
    }
    }

    if(json.method==4 || json.method=="4"){//message

    }

    if(json.method=="getJoke"){
       var jokes=[
    "What is the difference between 'ooooooh' and 'aaaaaaah'? About three inches.",
    "I'm emotionally constipated. I haven't given a shit in days.",
    "What did the elephant say to the naked man? 'How do you breathe through that tiny thing?'",
    "Why men's voice is louder than women? Men have an antenna.",
    "Women might be able to fake orgasms. But men can fake a whole relationship.",
    "If a guy remembers the color of your eyes after the first date, chances are... you have small boobs.",
    "What's worse than waking up at a party and finding a penis drawn on your face? Finding out it was traced.",
    "Isn't it scary that doctors call what they do 'practice'?",
    "What's the difference between your wife and your job? After five years your job will still suck.",
    "Crowded elevators smell different to midgets.",
    "Did you hear about the guy who died of a Viagra overdose? They couldn't close his casket.",
    "If you really want to know about mistakes, you should ask your parents.",
    "Did you get those yoga pants on sale? Because at my house they're 100% off",
    "Did you know that your body is made 70% of water? And now I'm thirsty.",
    "Unexpected sex is a great way to be woken up... If you're not in prison.",
    "Today a fortune cookie told me that every exit is an entrance. Long story short, my girlfriend said no.",
    "She gave me an Australian kiss. It's the same as a French kiss, but down under.",
    "Erotic is using a feather, kinky is using the whole chicken...",
    "FRIDAY is my second favorite F word."
    ];
  const randomIndex = Math.floor(Math.random() * jokes.length);
  result= jokes[randomIndex];
    }


    return {"jsonrpc":json.jsonrpc,"result":result,"id":json.id}
}

module.exports={reply};