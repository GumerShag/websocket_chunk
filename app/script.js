const videoElement = document.querySelector("video");
videoElement.duration = 183;
const wrapper = document.getElementById("playerWrapper");
let sourceBuffer;
let pack = 0;
let socket;
let streamStarted = false;
let queue = [];
let BUFFERED_BYTES = 0;
let segments = [];
const SEGMENT_DURATION = 10;
let videoDuration = 0;
let segmentLoadStartFrom = 0;

// This requires correct MIME type. MP4Box.js can be used I guess
const MIME_CODEC = 'video/mp4; codecs="avc1.64001e,mp4a.40.2"';
const mediaSource = new MediaSource();
let buffered = 0;

const player = new Plyr("#player");
player.on("timeupdate", () => {
  getNextVideoSegment();
});
player.on("seeking", ev => {
  if (mediaSource.readyState === "open") {
    sourceBuffer.abort();
    const segmentNumber = getSegmentAccordingToTime(videoElement.currentTime);
    const segmentName = `${segmentNumber}segment.m4s`;
    const isLoaded = segments.find(
      segment => segment.name === segmentName && segment.loaded === true
    );
    console.log("Loaded", isLoaded);
    if (!isLoaded) {
      segmentLoadStartFrom = segmentNumber;
      getNextVideoSegment();
    }
  }
});
wrapper.addEventListener("click", () => {
  createWebSocketConnection()
    .then(socket => {
      socket.onopen = () => {
        console.log("Socket is opened");
        videoElement.src = URL.createObjectURL(mediaSource);
      };

      socket.onmessage = e => {
        const data = JSON.parse(e.data);

        if (data.method === "open") {
          segments = data.segmentsList;
          videoDuration = SEGMENT_DURATION * (segments.length - 1);
          getInitialSegment();
        }

        if (data.method === "reserve") {
          pack = data.pack;
          encodedChunk = data.data;
          let decoded = decodeFromBase64ToBuffer(encodedChunk);
          if (!streamStarted && !sourceBuffer.updating) {
            streamStarted = true;
            if (videoElement.error) {
              console.log(videoElement.error);
            }
            sourceBuffer.appendBuffer(decoded);
            buffered += decoded.byteLength / 1024 / 1024;
            return;
          }
          queue.push(decoded);
        }

        if (data.method === "initial") {
          pack = data.pack;
          encodedChunk = data.data;
          let decoded = decodeFromBase64ToBuffer(encodedChunk);
          sourceBuffer.appendBuffer(decoded);
          getNextVideoSegment();
        }
        if (data.method === "end") {
          socket.close();
        }
      };

      socket.onclose = e => {
        console.log("Socket is closed");
      };
    })
    .catch(err => {
      console.error("Can't connect to socket", err);
    });
});

mediaSource.addEventListener(
  "sourceopen",
  () => {
    console.log("Video duration", videoDuration);

    if (!sourceBuffer) {
      sourceBuffer = mediaSource.addSourceBuffer(MIME_CODEC);
      if (!sourceBuffer.updating) {
        mediaSource.duration = videoDuration;
      }
    }
    sourceBuffer.addEventListener("updateend", () => {
      if (buffered > 100 && mediaSource.readyState === "open") {
        sourceBuffer.abort();
        buffered = 0;
        return;
      }
      if (!sourceBuffer.updating) {
        if (queue.length > 0) {
          if (videoElement.error) {
            console.log(videoElement.error);
          }
          const decoded = queue.shift();
          sourceBuffer.appendBuffer(decoded);
          buffered += decoded.byteLength / 1024 / 1024;
        } else {
          streamStarted = false;
        }
      }
    });
  },
  false
);
const getNextVideoSegment = () => {
  segmentLoadStartFrom;
  const segmentName = `${segmentLoadStartFrom}segment.m4s`;
  const unloadedSegment = segments.find(
    segment => segment.name === segmentName && !segment.loaded
  );
  if (unloadedSegment) {
    socket.send(
      JSON.stringify({
        method: "getSegment",
        segment: unloadedSegment.name
      })
    );
    if (unloadedSegment) {
      unloadedSegment.loaded = true;
    }
    if (segmentLoadStartFrom < segments.length - 1) {
      segmentLoadStartFrom++;
    }
  }
};

const getInitialSegment = () => {
  socket.send(JSON.stringify({ method: "getInitial" }));
};

const createWebSocketConnection = () => {
  return new Promise((res, rej) => {
    if (!socket) {
      try {
        socket = new WebSocket("ws://localhost:8080");
        res(socket);
      } catch (err) {
        rej(err);
      }
    }
  });
};

const decodeFromBase64ToBuffer = chunk => {
  const decodedChunk = atob(chunk);
  var len = decodedChunk.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = decodedChunk.charCodeAt(i);
  }
  return bytes.buffer;
};

const getSegmentAccordingToTime = time => {
  return Math.floor(time / SEGMENT_DURATION);
};
