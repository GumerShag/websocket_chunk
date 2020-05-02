const videoElement = document.querySelector("video");
const mediaSource = new MediaSource();
const player = new Plyr("#player");
videoElement.src = URL.createObjectURL(mediaSource);
let sourceBuffer;
let pack = 0;
let streamStarted = false;
let queue = [];
const LENGTH_SIZE = 256 * 1024;
window.addEventListener(
  "load",
  () => {
    mediaSource.addEventListener(
      "sourceopen",
      () => {
        const socket = new WebSocket("ws://localhost:8080");
        // This requires correct MIME type. MP4Box.js can be used I guess
        sourceBuffer = mediaSource.addSourceBuffer(
          'video/webm; codecs="vorbis,vp8"'
        );
        sourceBuffer.addEventListener("updateend", () => {
          if (!sourceBuffer.updating) {
            if (queue.length > 0) {
              sourceBuffer.appendBuffer(queue.shift());
            } else {
              streamStarted = false;
            }
          }
        });

        socket.onopen = () => {
          console.log("Socket is opened");
        };

        socket.onmessage = e => {
          const data = JSON.parse(e.data);

          if (data.method === "open") {
            fileSize = data.fileSize;
            console.log("File Size", fileSize);
            for (i = 0; i <= fileSize; i = i + LENGTH_SIZE) {
              socket.send(JSON.stringify({ method: "getData", start: i }));
            }
          }

          if (data.method === "reserve") {
            pack = data.pack;
            encodedChunk = data.data;
            let decoded = decodeFromBase64ToBuffer(encodedChunk);
            if (!streamStarted) {
              streamStarted = true;
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
      },
      false
    );
  },
  false
);

const decodeFromBase64ToBuffer = chunk => {
  const decodedChunk = atob(chunk);
  var len = decodedChunk.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = decodedChunk.charCodeAt(i);
  }
  return bytes.buffer;
};
