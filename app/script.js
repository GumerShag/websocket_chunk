const videoElement = document.querySelector("video");
const wrapper = document.getElementById('playerWrapper');

const player = new Plyr("#player");
let sourceBuffer;

let pack = 0;
let socket;
let streamStarted = false;
let BYTES_IN_SECOND;
let queue = [];
let BUFFERED_BYTES = 0;
let startBytes = 0;
// This requires correct MIME type. MP4Box.js can be used I guess
const MIME_CODEC = 'video/webm; codecs="vorbis,vp8"';
const CHUNK_SIZE = 256 * 1024;
const BUFFER_SIZE =  4 * CHUNK_SIZE;
const mediaSource = new MediaSource();
let timeOut;
wrapper.addEventListener('click', () => {
  createWebSocketConnection().then(socket => {
    socket.onopen = () => {
      console.log("Socket is opened");
      videoElement.src = URL.createObjectURL(mediaSource);
    };

    socket.onmessage = e => {
      const data = JSON.parse(e.data);

      if (data.method === "open") {
        fileSize = data.fileSize;
        console.log("File Size", fileSize);
        getNextSegment();
      }

      if (data.method === "reserve") {
        pack = data.pack;
        encodedChunk = data.data;
        let decoded = Base64Binary.decode(encodedChunk);
        if (!streamStarted && !sourceBuffer.updating) {
          streamStarted = true;
          if (videoElement.error) {
            console.log(videoElement.error)
          }
          sourceBuffer.appendBuffer(decoded);
          return;
        }
        queue.push(decoded);
      }
      if (data.method === "end") {
        socket.close();
      }
    };

    socket.onclose = e => {
      console.log("Socket is closed");
    };  
  })
})

mediaSource.addEventListener(
    "sourceopen",
    () => {
      sourceBuffer = mediaSource.addSourceBuffer(MIME_CODEC);
      sourceBuffer.addEventListener("updateend", () => {
        if (!sourceBuffer.updating) {
          if (queue.length > 0 && queue.shift()) {
            sourceBuffer.appendBuffer(queue.shift());
            console.log(videoElement.error);
          } else {
            streamStarted = false;
          }
        }
      });

      sourceBuffer.appendWindowStart = 0
    },
    false
  );  

const getNextSegment = () => {
  socket.send(JSON.stringify({ method: "getData", start: BUFFERED_BYTES + startBytes }));
  BUFFERED_BYTES += CHUNK_SIZE;
}
player.on('timeupdate', () => {
  getNextSegment();
})
player.on('seeking', () => {
   console.log('Seeking', videoElement.currentTime)
  if (mediaSource.readyState === 'open') {
    sourceBuffer.abort();
    debugger
    BUFFERED_BYTES = 0;
    startBytes = Math.ceil((fileSize / videoElement.duration) * videoElement.currentTime)
    getNextSegment()
  }
})

const createWebSocketConnection = () => {
  return new Promise((res, rej) => {
    if(!socket) {
      socket = new WebSocket("ws://localhost:8080");
      res(socket);
    }
  });
}
const decodeFromBase64ToBuffer = chunk => {
  const decodedChunk = atob(chunk);
  var len = decodedChunk.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = decodedChunk.charCodeAt(i);
  }
  return bytes.buffer;
};

var Base64Binary = {
  _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  /* will return a  Uint8Array type */
  decodeArrayBuffer: function(input) {
    var bytes = (input.length / 4) * 3;
    var ab = new ArrayBuffer(bytes);
    this.decode(input, ab);

    return ab;
  },

  removePaddingChars: function(input) {
    var lkey = this._keyStr.indexOf(input.charAt(input.length - 1));
    if (lkey == 64) {
      return input.substring(0, input.length - 1);
    }
    return input;
  },

  decode: function(input, arrayBuffer) {
    //get last chars to see if are valid
    input = this.removePaddingChars(input);
    input = this.removePaddingChars(input);

    var bytes = parseInt((input.length / 4) * 3, 10);

    var uarray;
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    var j = 0;

    if (arrayBuffer) uarray = new Uint8Array(arrayBuffer);
    else uarray = new Uint8Array(bytes);

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    for (i = 0; i < bytes; i += 3) {
      //get the 3 octects in 4 ascii chars
      enc1 = this._keyStr.indexOf(input.charAt(j++));
      enc2 = this._keyStr.indexOf(input.charAt(j++));
      enc3 = this._keyStr.indexOf(input.charAt(j++));
      enc4 = this._keyStr.indexOf(input.charAt(j++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      uarray[i] = chr1;
      if (enc3 != 64) uarray[i + 1] = chr2;
      if (enc4 != 64) uarray[i + 2] = chr3;
    }

    return uarray;
  }
};
