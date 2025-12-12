function hexToStr(str1)
 {
	var hex  = str1.toString();
	var str = '';
	for (var n = 0; n < hex.length; n += 2) {
		str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
	}
	return str;
 }

function strToHex(str) {
    var result = '';
    for (var i=0; i<str.length; i++) {
      result += str.charCodeAt(i).toString(16);
    }
    return result;
  }


  const hexToArray = hexString =>
  new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const arrayToHex = bytes =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

  function isBase64(str){
	var toTest; //otherwise, becomes too taxing. This samples it
	if (str.length>256) toTest=str.substr(0,256);
	else toTest=str;
	var base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
	return base64regex.test(toTest);
  }

  /*
  function isHex(str){
	  var toTest; //otherwise, becomes too taxing. This samples it
	  if (str.length>256) toTest=str.substr(0,256);
	  else toTest=str;
	var re = /[0-9A-Fa-f]{6}/g;
	return re.test(toTest);
  }
  */
  var isHex = (str) => /^[0-9a-fA-F]+$/.test(str);
  
  function isArray(d){
	  return d instanceof Uint8Array;
  }


  // Hex to Base64
function hexToBase64(str) {
  return btoa(String.fromCharCode.apply(null,
    str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" "))
  );
}

// Base64 to Hex
function base64ToHex(str) {
  for (var i = 0, bin = atob(str.replace(/[ \r\n]+$/, "")), hex = []; i < bin.length; ++i) {
      let tmp = bin.charCodeAt(i).toString(16);
      if (tmp.length === 1) tmp = "0" + tmp;
      hex[hex.length] = tmp;
  }
  return hex.join(" ");
}

   function appendArrays(arrays) {
    // sum of individual array lengths
    let totalLength = arrays.reduce((acc, value) => acc + value.length, 0);
  
    if (!arrays.length) return null;
  
    let result = new Uint8Array(totalLength);
  
    // for each array - copy it over result
    // next array is copied right after the previous one
    let length = 0;
    for(let array of arrays) {
      result.set(array, length);
      length += array.length;
    }
  
    return result;
  }
  
  function xor(hex1, hex2) {
    const buf1 = Buffer.from(hex1, 'hex');
    const buf2 = Buffer.from(hex2, 'hex');
    const bufResult = buf1.map((b, i) => b ^ buf2[i]);
    return bufResult.toString('hex');
  }


var MAP = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

var to_b58 = function(B,A){var d=[],s="",i,j,c,n;for(i in B){j=0,c=B[i];s+=c||s.length^i?"":1;while(j in d||c){n=d[j];n=n?n*256+c:c;c=n/58|0;d[j]=n%58;j++}}while(j--)s+=A[d[j]];return s};
var from_b58 = function(S,A){var d=[],b=[],i,j,c,n;for(i in S){j=0,c=A.indexOf(S[i]);if(c<0)return undefined;c||b.length^i?i:b.push(0);while(j in d||c){n=d[j];n=n?n*58+c:c;c=n>>8;d[j]=n%256;j++}}while(j--)b.push(d[j]);return new Uint8Array(b)};

function hexToBase58(hex){
  arr=hexToArray(hex);
  return to_b58(arr,MAP);
}

function base58ToHex(b58){
  arr=from_b58(b58,MAP);
  return arrayToHex(arr);
}

module.exports = { hexToStr, strToHex, hexToArray, arrayToHex, isHex, isArray, xor, appendArrays, hexToBase64, base64ToHex, hexToBase58, base58ToHex};

/*
(async () => 
{
    b58=hexToBase58("73ae23ddd6bae4aaa22aaaee773602d1ecdd4d795af8281e649feed216bc6e15");
    console.log(b58);
    hex=base58ToHex(b58);
    console.log(hex);
})();
*/