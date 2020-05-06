const WebSocket = require("ws");
const fs = require("fs");
const segmentsFolder = "./media/segments2";
const LENGTH_SIZE = 3166152;
const getSegmentsList = () =>
  new Promise((res, rej) => {
    fs.readdir(segmentsFolder, (err, files) => {
      const segmentsList = files
        .filter(file => file.includes(".m4s"))
        .map(file => ({ name: file, loaded: false }))
        .sort(
          (file1, file2) =>
            getSegmentNumberFromName(file1.name) -
            getSegmentNumberFromName(file2.name)
        );
      const initialFile = files.filter(file => file.includes(".mp4"))[0];
      res({ segmentsList, initialFile });
      if (err) rej(err);
    });
  });

getSegmentsList().then(({ segmentsList, initialFile }) => {
  const wss = new WebSocket.Server({ port: 8080 });
  console.log("Initial file name", initialFile);
  wss.on("connection", function connection(ws, req) {
    const key = req.headers["sec-websocket-key"];
    console.log("############ OPENED ###########", `\n ${key}`);
    ws.send(JSON.stringify({ method: "open", segmentsList }));
    ws.on("message", function incoming(message) {
      console.log("received: %s", message);
      data = JSON.parse(message);
      switch (data.method) {
        case "getInitial":
          console.log(initialFile);
          const initialStreamPath = `${segmentsFolder}/${initialFile}`;
          const initialStream = fs.createReadStream(initialStreamPath, {
            encoding: "base64",
            highWaterMark: LENGTH_SIZE
          });
          initialStream.on("data", chunk => {
            ws.send(
              JSON.stringify({
                method: "initial",
                data: chunk
              })
            );
          });
          break;
        case "getSegment":
          const segmentFilePath = `${segmentsFolder}/${data.segment}`;
          const segmentStream = fs.createReadStream(segmentFilePath, {
            encoding: "base64",
            highWaterMark: LENGTH_SIZE
          });
          segmentStream.on("data", chunk => {
            ws.send(
              JSON.stringify({
                method: "reserve",
                data: chunk,
                segment: data.segment
              })
            );
          });
          break;
      }

      //TODO: Close WS some condition
    });
  });
});

const getSegmentNumberFromName = name =>
  parseInt(name.match(new RegExp(/(\d+)(\w+.\w+)/))[1]);
